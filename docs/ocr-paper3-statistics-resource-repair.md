# H420/03 statistical count-table repair

## Evidence and cause

Started from clean fetched `origin/main`
`f42219df4363769efcd151eca21b1b731ca9744c` on
`codex/ocr-paper3-statistics-resource-repair`. Lovable's count-column fix was
already present; its 90 chi-squared tests passed before editing.

The reported failure contains statistical instructions in `data_table.headers`
and an empty `rows` array. A null hypothesis and critical value are not observed
and expected counts. The table really cannot support the assessed calculation,
so accepting it would weaken answerability. The rejected production payload is
not available here; no original counts can be recovered from the error.

There are also reproducible wording defects: `Null hypothesis (H₀): ...` and
`Critical value (for df=1, α=0.05): 3.84` were not accepted as declarations.
The old count-column search matched any mention of observed/expected, including
a hypothesis sentence. Its invalid-table early return also withheld missing-given
diagnostics until a later repair. The generic final repair example showed only
one sibling with a null resource, despite requiring a complete statistical group.
These defects and prompt risks are independently reproducible; they do not prove
exactly what every production repair returned.

An initial 17-case reproduction failed 13 cases before production edits. The
expanded regression suite has 27 cases, all using original synthetic counts and
intercepted model/database calls.

## Change

- Accept labelled critical-value qualifier lists separated by commas, semicolons
  or `and`, including `for df=1, α=0.05`. The parser binds the following number
  to the critical value and still preserves conflicting df/threshold claims.
- Accept explicit parenthesised H₀ labels with a substantive hypothesis. Empty
  labels followed by a formula or another statistical given remain invalid.
- Count-column names must identify observed/expected counts, rather than contain
  these words somewhere in a hypothesis. O/E, count/frequency labels and the
  existing ratio-column and matching-final-Total protections remain supported.
- Empty category tables and malformed keyed rows receive actionable diagnostics.
  A malformed row cannot throw before bounded repair. Missing formula/definitions/
  hypothesis/decision information is reported in the same pass as broken counts.
- Add H420/03-only runtime count-table guidance to initial guided generation and
  full-group repair. Headers contain category/count labels; numeric counts occupy
  rows; statistical givens occupy the same part's visible context or caption.
- The final statistical repair example now includes every sibling and an explicit
  count-table object. It preserves a recoverable valid dataset; otherwise it shows
  a clearly labelled JSON-shape illustration. Illustrative numbers are never
  inserted into persisted questions by server code and are not recovered data.
- Missing original data requires a complete new synthetic parent group and freshly
  calculated dependent private keys. No cell is guessed as a patch to an original.
  Task-only repairs continue to preserve context and resources.

The statistical contract is unchanged: non-negative integer observed counts,
expected counts at least five, matching finite totals, 2–11 categories, fixed
model with no parameters fitted from the same observations, df = categories − 1,
5% significance, matching critical value and a matching private final statistic.
Existing numeric tolerances, budgets, three-repair bound, access controls, marking,
mastery, atomic persistence, release controls and private-answer separation remain.

No versioned paper plan, definition, base contract instruction, baseline hash,
frontend, PDF, dependency, lockfile, migration or database record changed. Runtime
H420/03 statistical prompt guidance deliberately changes; frozen contract fingerprints
remain unchanged. Other papers return the same prompt strings as before this change.

## Verification

Node **24.19.0**, existing `package-lock.json`:

| Check | Result |
| --- | --- |
| `npm ci --cache /workspace/.npm-cache` | PASS; 863 packages installed |
| `npm run check` | PASS; typecheck, critical hook lint, 1,628 tests in 103 files, Edge identifiers, 38 Edge Function bundles and production build |
| Targeted Paper 3 statistical, chi-squared, pipeline and contract tests | PASS; 160 tests in 4 files, including 27 new regressions |
| `node scripts/audit-biology.mjs` | PASS; 50 templates |
| `node scripts/audit-ocr-alevel-paper3.mjs` | PASS; unchanged full 70-mark/90-minute and short 20-mark/26-minute templates |
| `node scripts/audit-biology-visual-assets.mjs` | PASS; four synthetic fixtures, zero production-approved assets |
| `git diff --check` | PASS |

The real bundled extraction/publish handlers accept valid equivalent wording,
repair the reported malformed group once, retain every planned sibling and persist
its corrected count data. Repeated empty-table repairs stop after three attempts,
leave extraction incomplete and cannot publish. Wrong df/significance/critical
values, empty hypotheses, hidden/broken resource aliases, malformed rows and wrong
private statistics remain blocked. Existing OCR Papers 1/2 and all prior Biology
fingerprint tests pass without altering fixtures.

Existing warnings: deprecated/stub installation packages, stale Browserslist data,
large build chunks and DOM-nesting/expected negative-fixture diagnostics. There are
no blocking check failures. Browser checks were not repeated for this server-only
change; no screen or print rendering changed.

Tests and audits do not certify scientific quality or an external Gemini rating.
A real model-generated paper, its complete original failed payload and behaviour
of the deployed functions remain unverified. No paid model or live backend was
called, no record changed, and no function or website was deployed.

## Files

Added:

- `supabase/functions/_shared/ocr-paper3-statistics-instructions.ts`
- `supabase/tests/ocr-paper3-statistics-resource-repair.test.ts`
- `docs/ocr-paper3-statistics-resource-repair.md`

Changed:

- `supabase/functions/_shared/chi-squared-givens.ts`
- `supabase/functions/_shared/ocr-alevel-biology-paper3-validation.ts`
- `supabase/functions/_shared/question-repair.ts`
- `supabase/functions/extract-exam-questions/index.ts`

## Merge and deployment

Recommend **Squash and merge** for this focused fix after review.

Bundle dependency analysis identifies six functions containing the changed shared
validator; extraction also contains the revised generation/repair instructions.
After merge, Lovable must deploy these from the merged `main`, preserving their
existing authentication settings:

1. `extract-exam-questions`
2. `publish-exam`
3. `generate-practice-questions`
4. `get-practice-questions`
5. `grade-practice-question`
6. `submit-exam`

Deploy all six before retrying a newly created short H420/03 exam. Inspect its
statistical question for supplied counts, givens, working requirements and a
supported private conclusion; then test a full paper and perform external review.
No migration or frontend/website publication is required for this fix. Deployment,
paid generation, merging and publication are left to the operator.
