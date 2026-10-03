# Shared responses — Batch 2

Batch 2 connects Batch 1's private contracts and drafts to student inputs,
submission, marking, released review, printable questions and existing mastery
analytics. It does not enable generation of new-format contracts. That is Batch
3, after these paths have been verified in the unpublished development preview.
No existing questions are inferred or converted from their wording.

## Interfaces and persistence

`ResponseInput` renders tick one/tick several, a grid of independently labelled
cells, inline text/dropdown blanks, and labelled fields sharing one stimulus.
The existing text variant also works. Stable IDs identify answers; labels and
visual order do not. Selection caps apply in both UI and server validation.
Numeric drafts allow intermediate typing such as `-` and `1e-`; incomplete
numbers earn no numeric marks. Blank is distinct from zero. A grid row with no
applicable cells requires an explicit None selection; an untouched row does
not accidentally earn credit for an empty expected set.

`useResponseDrafts` uses one revisioned session per question on both exam and
practice screens. Updates autosave through `question-response`; submit and
Save & Quit await pending writes. Failure keeps the entered response and a
Retry control. Conflicts require an explicit choice to load the saved answer.
Session recovery is scoped by source, parent, user and question. It handles a
lost acknowledgement without blindly overwriting a newer server response.
Session storage is a recovery aid, not guaranteed offline storage or recovery
after a tab closes. An account change blocks an old queued transport.

Practice question reads now use `question-response` with
`{action:"questions",source:"practice",parentId:setId,questionId?:id}`.
The existing `get-practice-questions` function is a generation entry point in
this repository. It is left intact; opening a saved quiz no longer invokes it.

## Shared resource representation

A contract's `resourceIds` resolves to exactly one saved resource per reference:

```json
{"type":"response_context","resources":[
  {"id":"experiment","kind":"table","title":"Results",
   "columns":["Tube","Time (s)"],"rows":[["X",20],["Y",30]]}
]}
```

This is stored in the question's existing `diagram_config`. Batch 2 supports
text and data-table context, displayed once above the labelled fields. Tables
have validated headers, finite values and matching row widths. Unknown/private
properties are refused. Missing data is an error, never a generated substitute.
Existing non-contract diagrams and resource rendering retain their old paths.
Future generation must install the definition, matching private key and valid
resource pack together before making a structured question available.

## Marking and mastery

- Exact choices and grid rows use set equality. Accepted words use explicit
  normalized equality; dropdown IDs always use exact equality. Numeric rules
  use the key's absolute tolerance. These rules make no AI calls.
- Rubric units with written answers use one bounded provider call per question,
  behind quotas and a timeout. Unit identities, coverage, numeric score caps
  and feedback are validated. Empty rubric responses receive zero without a
  model call. Provider/schema/storage failure is an error, not a zero.
- Each unit contributes its configured marks. The aggregate produces ONE score
  and ONE answer row for the original question, preserving its existing topic
  and subject identity. Cells and blanks do not multiply mastery attempts.
- Exam marking uses `claim_exam_responses` and `finish_exam_responses`, wrapping
  the established atomic exam claim/finalisation. Drafts are snapshotted under
  the same attempt lock. Private unit results and existing grade rows commit
  together, or roll back together.
- Practice marking claims the exact saved revision, locks further saves, and
  persists the answer, result and progress in one transaction. Duplicate calls
  return the stored grade. Expired leases cannot overwrite a newer claim.
  Progress counting is serialized across questions finishing in the same set.
- Authenticated clients cannot insert, change or delete structured practice
  grades directly. Existing legacy practice policies remain applicable to
  legacy questions. Failed marking remains ungraded. Existing mastery hooks
  consume the normal scored answer tables; no analytics formula is changed.

A graded structured practice question keeps its original attempt. Destructive
Retry/Regenerate/Reset controls are disabled for it; use a new practice set for
another attempt. A proper multi-attempt practice history can be added later.
The existing legacy-question retry behavior is retained.

## Review and printing

The service supplies public definitions, resources and the user's saved draft.
Keys and unit feedback are supplied only after the existing exam release check,
or completed practice marking. A tutor can request a student's exam responses
only when the caller is a manager and the target has access to that exam.
Both student review pages and tutor review render the same structured response.

PDF output draws vector blank boxes, grids, inline blanks and labelled answer
lines. Shared tables print once; long tables repeat headers and wide tables
split into labelled panels. Required context is retained even when optional
legacy diagrams are disabled. Very long cells that cannot fit legibly fail
export rather than overlap. Answer-key content appears only in the separate
key section and only when it was supplied by the authorized service. The
student PDF endpoint always projects questions without solutions.

## Installation

Requires the installed Batch 1 tables and the existing exam marking RPCs.

1. Install the complete incremental source set against base
   `f03ac1f6832deef51715c892fe0ff22c2822c83e`, preserving later unrelated edits.
2. Run `npm ci`, `npm run check`, and `node scripts/audit-biology.mjs` using
   Node 22 or 24 and the unchanged package lock.
3. Review and apply `docs/pending-migrations/20261001150000_response_formats.sql`
   exactly once through the platform's migration tool. Verify actual schema
   dependencies and record the applied migration. Regenerate types normally.
   Merely committing the pending SQL does not apply it.
4. Redeploy these six functions with their updated shared imports:
   `question-response`, `get-exam-questions`, `submit-exam`,
   `grade-practice-question`, `generate-student-pdf`, `submit-student-answer`.
   The last still rejects legacy writes to structured questions and imports
   the updated shared validator. Recompute dependencies if newer work differs.
5. Rerun checks and verify the unpublished preview with isolated synthetic
   fixtures. Do not generate paid papers for this batch.

The migration adds private results, restrictive structured-practice write
policies and service-only marking wrappers; it replaces the draft-save function
to participate in practice marking locks. It does not rewrite historical
questions, answers or grades. No package/lockfile/generated-type edit is supplied.

## Verification and preview acceptance

The tests execute the actual pending SQL with the existing exam claim/finish
functions in in-process PostgreSQL. Real Edge handlers use simulated Supabase
and model transport. Actual student pages are rendered in jsdom. Synthetic
fixtures are in `src/test/fixtures/response-format-cases.ts`; they are neither
predetermined generated exams nor an enabled question bank.

Verify in the connected preview, using new temporary owned exam/practice
questions and service-only test contracts, never converting real saved papers:

- Tick one/two, grid cells and explicit None, typed/dropdown cloze, labelled
  numeric and written fields, and shared data context visible once.
- Save, refresh, clear, immediate submit, save failure/retry, two sessions with
  stale revisions, marking failure/retry and duplicate submission.
- Direct private-key/result reads denied; another user's records denied;
  unreleased reviews hide keys and unit scores; released/tutor review works.
- One capped score per question reaches the existing topic/mastery summaries;
  ungraded work does not lower accuracy. Test a mixed legacy/structured set.
- Light/dark, mobile width, keyboard labels/focus and actual browser PDF download.
  Questions stay blank even with a separate permitted answer-key section.
- Existing AQA and OCR profiles and a legacy saved exam/quiz still open.

Remove temporary UI and only newly created test records after verification.
Offline PDF output has been rendered and visually inspected. No live migration,
function deployment, connected-preview interaction, paid provider call or site
publication was performed by the bundle author. Browser testing remains a
Lovable preview step: the local Playwright browser executable was unavailable.
