# Response foundation — Batch 1

This batch establishes shared definitions and safe draft storage for matrix tick
grids, inline blanks, labelled fields and single/multiple tick-box selections.
It also repairs saving and reloading existing exam inputs. It does **not** enable
the generator to emit the new definitions or install their complete student UI.

## Scope

| Included now | Next batch |
| --- | --- |
| Versioned public definitions with stable option/row/column/field IDs | Accessible renderers for all four formats in exams and practice |
| Validated response envelopes and completeness checks | Shared resource placement and labelled input layout |
| Separate private marking keys with mark-total/target validation | Deterministic marking, partial-credit rules and rubric marking |
| Owner-scoped draft API, revision conflicts and retry IDs | Submit/review/PDF integration for the new definitions |
| Shared draft session and save queue | Carry each completed question's marks into existing mastery analytics |
| Existing exam input save/load/clear/submit repairs | Controlled generation, repair and release of these formats |

Existing Biology plans, marks, tiers, generation budgets, quotas and grade
release rules are unchanged. There is no in-app Gemini rating. Existing legacy
questions still use their original answer representation and marking path.

## Contract and identity

`supabase/functions/_shared/response-contract.ts` is the implementation.
`src/lib/response-contract.ts` intentionally re-exports that file so the frontend
and Edge Functions use exactly the same validators. Install both files; the short
frontend file is not a replacement for the backend implementation.

Every definition carries `version: 1`, a stable `revision` and `resourceIds`.
Resource IDs are references, not duplicated figures or model answers. Binding
them to actual resources is a generation/integration responsibility in Batch 2/3.

| Kind | Definition | Response value |
| --- | --- | --- |
| `text` | Maximum text length | `{ text, working }` |
| `choice` | Stable options, minimum and maximum selection counts | `{ selectedIds }` |
| `grid` | Stable rows/columns, minimum and maximum selections per row | `{ rows: { rowId: [columnId] } }` |
| `cloze` | Ordered text/blank segments and typed fields | `{ fields: { fieldId: value } }` |
| `fields` | Labelled text, number or dropdown fields | `{ fields: { fieldId: value } }` |

The envelope also carries the question ID, definition revision and kind. Labels
and display order never serve as new-format answer identifiers. A grid row with
an explicit empty selection differs from an untouched row. Partial answers may
be saved; invalid or excessive selections are rejected instead of truncated.
Numeric zero is a valid answer. Completeness is an input state, **not a score**.

Public definitions use a strict nested allowlist. Private answer/solution fields
cannot be silently added to a public payload. Private keys define marked units,
their target IDs, marks and exact-set/text/number/rubric rules. Validation checks
target coverage, selection rules and the question's mark total. This batch
validates key structure; it does not execute a new marking algorithm.

## Database boundary

Apply `docs/pending-migrations/20261001090000_response_foundation.sql` once using
the backend's migration tool. Merely adding the review file to GitHub does not
apply it. It creates:

* `question_response_contracts`: one immutable public definition/private key
  pair bound to either an exam question or a practice question.
* `question_response_drafts`: the current unscored response per contract/user,
  with a revision and last request ID.
* An immutability trigger and the service-only `save_question_response_draft`
  function.

Both tables enable RLS and revoke direct access from `PUBLIC`, `anon` and
`authenticated`. Only the trusted service path can read/write them. The draft
endpoint explicitly projects the public definition and the caller's own draft;
it never returns the key. A contract cannot be attached to a question that
already has legacy answers, or rewritten into a different definition afterwards.
Use a new question for a new contract.

The SQL depends on the existing question/answer/set/submission tables,
`auth.users`, `exam_access_info(uuid, uuid)` and the existing marking lock
convention. Check the connected schema before applying it. It does not rewrite
historical answers/grades, add scores to drafts or change existing policies.

## API and concurrency

The new `question-response` Edge Function supports authenticated POST only:

```json
{
  "action": "get",
  "source": "exam",
  "parentId": "EXAM_UUID",
  "questionId": "QUESTION_UUID"
}
```

Use `source: "practice"` with the set UUID for practice. A `save` adds
`response`, `expectedRevision` and a fresh UUID `requestId`. Identity comes from
the verified JWT, never a supplied user ID. The question must belong to the
supplied parent and the user must have access to that parent.

Saves validate the envelope before calling the service-only RPC. The RPC checks
access again, serialises updates and rejects stale revisions. Repeating the same
last request ID and payload acknowledges the original write without incrementing
the revision. Reusing the ID with different content is rejected. A stale write
returns a conflict; the caller must reconcile, not overwrite blindly.

Exam saves acquire the same attempt lock as marking and reject locked submission
states. Practice saves reject answers that already have a score. No new-format
marking is enabled, so a future practice marking path must participate in the
same locking/state transition before it is activated.

`ResponseDraftSession` provides load/edit/flush/error/conflict state for future
exam and practice interfaces. `ResponseSaveQueue` serialises each question's
writes and coalesces pending edits. An uncertain transport failure retries the
same request before sending a newer value. A save acknowledgement compares JSON
data independent of the database's object-key ordering.

## Compatibility and current exam saving

`requireLegacyResponsePath` blocks legacy exam presentation and answer writes,
and exam/practice marking, when a new contract is attached. These guards must
remain until Batch 2 provides the complete route. Normal existing questions
without contracts continue through their original paths. If the new table is
missing, the check fails closed: **apply the migration before deploying these
handlers**.

`ExamInProgress` now uses one synchronous per-question state store behind its
existing input selectors. Saves read the latest text, blank, grid and graph
state, rather than stale callback snapshots. A queued save is acknowledged only
when the current snapshot was actually saved. Final submission, section changes
and Save & Quit wait for pending answers and refuse to continue after a failed
save. Intentionally cleared selections are also saved.

Local recovery snapshots contain the whole legacy response and are scoped to
both exam and user. They are restored only into editable attempts. Old unscoped
browser caches are not imported because they cannot be attributed to a user;
existing server answers remain intact. This uses `sessionStorage`, so it is not
an offline/cross-device store. A closed tab or cleared browser data can remove
unsaved local recovery data.

Legacy API writes still have their existing cross-session behaviour. Revision
conflict protection in this batch applies to the **new draft API**, not every
historical answer type across multiple tabs. Drawing-working uploads and their
existing navigation guard remain separate from these response values.

## Deployment and verification

1. Install the full file set, preserving newer unrelated work. Run `npm ci` and
   `npm run check` on Node 22 or 24 with the existing lockfile.
2. Run `node scripts/audit-biology.mjs`; existing template combinations and
   fingerprints must remain unchanged.
3. Check SQL dependencies, apply the additive migration once, and regenerate
   database types through the platform. Do not hand-edit generated types.
4. Deploy `question-response`, `get-exam-questions`, `submit-student-answer`,
   `submit-exam` and `grade-practice-question`, including their shared imports.
5. Re-run checks after generated types update. Perform preview checks using
   isolated synthetic questions/test records; do not generate a paid paper.

Tests cover strict definitions/keys, all envelope families, SQL privileges and
locked states, owner checks, revision conflicts, retries, API projection, save
queue ordering and the actual exam component's blank/grid/text save flows.
SQL tests execute the proposed migration in in-process Postgres against a
representative schema. Handler tests simulate Supabase; screen tests use jsdom.
They do not verify a deployed backend, a live browser, production concurrency,
every scientific answer or an external Gemini score.

Preview acceptance should include: refresh after saving; immediate submission
through a mocked marking transport; selection clearing; network save failure;
two sessions attempting the same revision; forbidden direct key/draft reads;
exam/practice ownership and locked attempts. Use a temporary test harness and
new synthetic records for the contract API, then remove only those fixtures.
Do not attach test contracts to the user's real existing questions.

## Mastery handoff for Batch 2

Saving an input is not evidence of correct or incorrect knowledge. New drafts
deliberately never write scored answer tables. The next batch should aggregate
validated marked units into one capped score per existing scored question,
preserve that question's topic identity and feed the completed result through
the current graded-answer analytics path. A grid's cells or a paragraph's blanks
must not each become extra attempts or multiply the available marks. Failed or
pending marking must remain ungraded, never a zero masquerading as a result.
