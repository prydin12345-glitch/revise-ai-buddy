# Response formats — Batch 3: controlled generator adoption

## Scope

Adds an **Interactive answer formats (preview)** checkbox to guided Biology
profiles. It is off for existing profiles. It is saved in `paper_blueprint` as
`responseFormats: "interactive_v1"`; only the owned-profile resolver may copy
it into a protected attempt snapshot (`response_formats`). Editing a profile
later does not change an existing attempt. Custom mode omits the option.

This is a controlled pilot, not a new official board blueprint. Every existing
course, paper, tier, part count, mark allocation and fingerprint stays unchanged.
No in-app quality rating, new board or predetermined question bank is added.

## Generation

1. Existing question generation, batching, resource checks and answerability
   repairs finish first. The original question wording and private key remain
   available for validation.
2. Supported single-choice MCQs become tick-one definitions deterministically:
   original options, order, correct choice and maximum marks are preserved.
   This costs no extra model call. MCQs needing graphs/specialised diagrams
   keep their existing, working renderer; all original MCQs remain in the plan.
3. At most three eligible 2–4 mark short-answer parts are offered to the model
   for an input definition and matching private marking units. It may choose
   tick-multiple, grid, inline typed/dropdown cloze or labelled fields, or
   explicitly decline when the original task cannot be represented faithfully.
   This is not a requirement to include all four formats in every paper.
4. Public definitions have strict field allowlists and stable IDs; private keys
   must cover every input exactly once and sum to the original maximum.
   Original data tables and units are routed into shared context without asking
   the model to regenerate measurements. Graphs, specialised diagrams, essays,
   shared passages, cross-part references and higher-mark responses are excluded.
5. Invalid proposals get one repair request per candidate, then fail visibly.
   Model-declared unsuitable tasks retain their original inputs and are logged
   as skips. Transport/truncation/budget errors fail; they are not false skips.
   No failed marking or missing model output is converted to a zero score.

The profile opt-in also applies to newly generated practice sets from it. Both
practice generation endpoints are wired (`get-practice-questions` is also a
GENERATOR despite its name). Interactive sets bypass the old shared cache on
both read and write. They do not advance its variation slots. Ordinary sets
keep their existing cache behaviour. Question reads continue through Batch 2's
read-only endpoint, never through a generation request.

## Cost and limits

The adaptation stage makes up to six model calls: three candidate parts,
maximum two calls each, 5,000 output tokens and a 45-second timeout per call.
Exam calls share the existing 26-call / nine-minute admission budget with
initial generation, completion, fallback and repairs. That budget is now
request-local, rather than a mutable module global shared by simultaneous
extractions. Practice adaptation has its own six-call / three-minute admission
budget in addition to existing quiz generation. A started call can finish after
the admission deadline; its per-call timeout still applies. Existing request
quotas and feature limits are unchanged. Interactive sets may take longer and
cost more; no model call was made while implementing or verifying this bundle.

## Persistence and privacy

During exam authoring, a new server-only `question_response_generation_drafts`
table holds a tagged `examly_response_v1` carrier: original key, validated public
definition and private structured key. It also stores the source task snapshot.
The ordinary authoring draft is left unchanged; its owner-readable answer
column never receives the new private contract. All client access to the new
table is revoked. This content is not put into any public resource field.
The final gate checks the original question against its unchanged paper plan
and revalidates the structured definition/key. Draft resources and task identity
are rechecked at the database boundary to reject intervening edits.

`commit_generated_responses` is a new service-only transaction for opted-in
attempts. It checks ownership and the frozen snapshot, inserts each final
question with no private answer remnants, inserts its private response contract,
and changes readiness status in one transaction. If any row or contract fails,
all writes roll back. Duplicate committed requests keep the original IDs. Started
exam/quiz work cannot be replaced, including unsubmitted structured drafts.
Unmodified legacy attempts retain their existing save/publication paths.

The supplied SQL adds the private draft table, one transaction function and
grants; it does not convert historical data. Apply it once via the connected platform's migration tooling and
regenerate types normally. It requires the Batch 1 and Batch 2 schema and
service endpoints to be installed already. The pending SQL file is not itself
an applied migration.

Batch 2 handles student input, revisioned saving, marking, released review, PDF
and mastery. Each scored question still produces one capped answer row for
analytics, irrespective of its cells/blanks/fields. Existing scores stay intact.

## Installation

Audited GitHub base: `8653d86dd1c3d2938cf975108472144c96156a56` (Installed Batch 2 files).
Install all supplied files, preserving newer unrelated edits. This bundle also
reconciles `package-lock.json` with the three development dependencies already
added by Lovable in that base (`drizzle-kit`, `drizzle-orm`, `postgres`). No
existing locked dependency version was changed; package.json and bun.lock are
not edited by this bundle. Normal `npm ci` succeeds with the supplied lockfile.

Run `npm ci`, `npm run check`, and `node scripts/audit-biology.mjs` on Node 22/24.
After the additive migration, deploy these eight functions with their shared
imports: extract-exam-questions, generate-practice-questions,
get-practice-questions, grade-practice-question, publish-exam, save-exam-format,
submit-exam and upload-exam. The list is derived from actual bundled imports.
Deploying `publish-exam` does not publish the website.

## Preview checks and first real trial

Keep the website unpublished. Check the checkbox off/on/save/reopen in a
new temporary guided profile, Custom-mode removal, and existing AQA/OCR
profiles. Verify fresh snapshots preserve the opt-in while existing snapshots
stay unchanged. Use deterministic synthetic contracts for save/refresh/submit,
one-question mastery, hidden/released keys, PDF blank questions and shared
tables; never overwrite existing test or student papers. Verify both generator
entrypoints and the atomic database routine with mocked model responses, not
paid runs. Remove temporary fixtures/UI afterwards.

After installation and preview checks pass, the founder can duplicate a working
profile, choose Short practice, enable the new checkbox, save, and generate a
fresh exam. A short quiz from that profile is the next check, then a full OCR
A-level Paper 1 to verify all fifteen MCQs (including any remaining legacy
visual questions) and complete marking. Check that each new input actually
matches the task and that its rubric preserves method/partial-credit intent.
No paid generation is authorised by the installation prompt.

## Evidence and limitations

Tests cover the real generator/publication entrypoints with simulated model and
Supabase responses, the actual new SQL in in-process PostgreSQL, marking of all
four generated definitions, bounded retries, invalid/private content, profile
persistence and snapshot reuse. Existing template fingerprints are unchanged.
These are not predetermined generated papers, a scientific-accuracy certificate
or a Gemini rating. Deterministic checks cannot prove semantic equivalence of
every model-authored grid/paragraph/key to its original task: a real trial and
the founder's external audit are still needed before wider enablement.

No live migration, deployment, connected-preview interaction, browser PDF test,
paid generation or website publication was performed by the bundle author.
