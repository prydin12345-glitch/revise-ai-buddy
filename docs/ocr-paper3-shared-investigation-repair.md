# H420/03 shared investigation generation and repair

Prepared from clean remote `main` at `a9e52041`, which includes statistical repair
PR #17. Node 24.19.0 and the existing lockfile are retained.

## Reported failure and reproduced defects

Full-mock Q6(b) and Q6(c) are annotated with the same `experiment_6` dataset.
The reported `conflicting_resource_data` means their observations, headers,
units or caption differed. The subsequent full-group repair omitted a required
table, producing `Complete group repairs must return every required resource`.
Both checks correctly prevented an inconsistent or unanswerable assessment.

The original production question/resources are unavailable: the error alone
does not establish which field differed or recover the correct observations.
Tests use an original synthetic quadrat investigation, not recovered exam data.

The remaining prompt defect was that non-statistical complete-group repairs
ended with a single sample sibling and `diagram_config: null`, despite requiring
all siblings and all their resources. “One coherent results table” did not explain
how every dependent part must carry that resource. Seven of ten initial new
regression cases failed against unchanged main; the 70-test baseline suites passed.

## Implementation

- Add runtime guidance only for protected, explicitly selected H420/03 guided
  parts with `sharedDataset`. Full-mock groups 1, 4 and 6 each author one table
  and explicitly reference it on the other dependent scored part. Other papers,
  Custom, short practice and task-only prompts do not gain these instructions.
- A transport reference uses `type: data_table`, the destination's saved resource
  ID, `shared_dataset_ref` and `source_question_number`. It is expanded losslessly
  into a complete ordinary table before validation/storage. The source must be
  one unambiguous returned part in the same protected dataset and parent. No
  external URL, arbitrary lookup, reference chain or cycle is supported.
- Generation expands references after bounded completion/truncation recovery,
  allowing a recovered table to supply its explicitly referencing sibling. Invalid
  references fail before alias collapse or draft persistence, with an explicit
  `invalid_shared_dataset_reference` error. Ordinary complete-table conflicts
  still follow the existing bounded whole-group repair pipeline.
- Full-group repairs expand references only within their returned parts, never
  by borrowing stale original resources. The final example includes every sibling,
  the source table and each explicit dependent reference. All required resources
  remain mandatory. A null/omitted table is not automatically restored.
- Matching, recoverable original tables are retained in the prompt example.
  Conflicting originals are not arbitrarily chosen or combined. A clearly labelled
  illustrative example shows JSON shape only: server code never inserts its
  numbers into saved questions. The model must write a coherent new synthetic
  investigation and recalculate every dependent key when originals conflict.
- Reject reference/data mixtures, unknown fields, wrong IDs, absent/duplicate
  sources, other-parent sources, broken source rows and conflicting alias copies,
  including captions/units. Preserve source properties through expansion so
  existing private-answer disclosure checks still see and reject leaked fields.
- Shared-table validation still compares exact headers, rows, units and caption.
  Report which fields/cells differ and compare every sibling to the first dataset,
  rather than updating the comparison point to a conflicting sibling.

Persisted, public, review, marking and PDF resources remain complete `data_table`
payloads with their original rendering/response/marking architecture. No transport
reference is accepted as a released assessment resource. There is no schema,
storage, migration, dependency, lockfile, frontend, timer, quota or budget change.
Question identity, private keys, ownership/release checks, atomic finalisation,
marking and mastery protections remain in the existing pipeline. No versioned
contract, template definition, base instruction or baseline fingerprint was edited.

## Verification

- `npm ci --cache /workspace/.npm-cache`: PASS, 863 packages.
- Focused tests: PASS, 129 tests in five files, including 34 new regressions.
- `node scripts/audit-biology.mjs`: PASS, 50 templates.
- `node scripts/audit-ocr-alevel-paper3.mjs`: PASS; full 70 marks/90 minutes,
  short 20 marks/26 minutes, unchanged template distributions.
- `node scripts/audit-biology-visual-assets.mjs`: PASS; four synthetic fixtures,
  zero production-approved assets. No live image/model request.
- `npm run check`: PASS; typecheck, critical hook lint, 1,662 tests in 104 files
  (zero failures), Edge identifier checks, all 38 function bundles and production
  build (16.77 seconds).
- `git diff --check`: PASS.

Existing non-blocking warnings remain: deprecated/stub npm packages, old
Browserslist data, large production chunks and unrelated DOM-nesting/expected
negative-fixture test diagnostics. No blocking error remains.

Tests execute the real bundled extraction and publication handlers with every
database/model request intercepted. A conflicted Q6 group repairs in one call,
retains 24 planned parts, saves identical supplied tables and passes publication.
A truncated group completes against its accepted source without duplicate rows.
Three resource-dropping repairs still stop generation and publication with no
final question writes. Incorrect references and private fields remain rejected.
All existing template fingerprints are tested without rewriting their fixtures.

This is a server-only change; browser, PDF and live model checks were not repeated.
No paid exam, real account, database record, deployment or website publication was
used. Automated fixtures do not certify model-generated scientific quality or an
external Gemini rating. The exact original failed payload remains unverified.

## Files and deployment

Added:

- `supabase/functions/_shared/ocr-paper3-shared-data.ts`
- `supabase/tests/ocr-paper3-shared-investigation.test.ts`
- `docs/ocr-paper3-shared-investigation-repair.md`

Changed:

- `supabase/functions/_shared/ocr-alevel-biology-paper3-validation.ts`
- `supabase/functions/_shared/question-repair.ts`
- `supabase/functions/extract-exam-questions/index.ts`

Bundle dependency analysis identifies the following six affected Edge Functions.
After review and **Squash and merge**, Lovable must deploy all six from merged
`main`, preserving their authentication settings:

1. `extract-exam-questions`
2. `publish-exam`
3. `generate-practice-questions`
4. `get-practice-questions`
5. `grade-practice-question`
6. `submit-exam`

No migration or website publication is required. Deploy all six before testing a
new short H420/03 paper; then test a new full paper to exercise the shared datasets
in Q1, Q4 and Q6. Inspect their data, tasks and private marking against the exact
supplied observations. Deployment and paid generation remain operator actions.
