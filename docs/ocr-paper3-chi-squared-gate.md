# H420/03 chi-squared gate repair

## Evidence and scope

Starts from clean fetched `origin/main` `aa361798` on `codex/fix-ocr-paper3-chi-squared`. The previous generation-envelope and explicit-part-identity fixes are present. The latest remote changes only add the failure brief in `.lovable/plan.md`.

Live Supabase logs and the rejected Q2(b) payload were unavailable in this environment. The supplied examples were reproduced against the actual repository validator; this establishes the parser defects, not the exact contents of that particular failed request. Before production changes, the initial 40-case regression run failed 22 cases, including legitimate wording/structured-key failures and previously missed missing/conflicting givens.

This change is limited to the H420/03 guided statistical-calculation gate and its repair guidance. No paper contracts, generated-question prompts, template/fingerprint fixtures, other board/paper behaviour, public rendering, private-answer access, marking rules, mastery routing, budgets or persistence boundaries are changed. No new OCR assessment requirements are introduced; the existing fixed-model chi-squared decision information is documented in [the original Paper 3 research](ocr-alevel-biology-paper3.md).

## Implementation

- `parseChiSquaredGivens` normalizes supported mathematical markup and binds numbers to df, significance and critical-value declarations. It supports number-first degrees of freedom, symbolic-then-numeric df, qualified critical values, 5%/0.05/p/alpha wording, multiline definitions and Unicode/LaTeX formulae. It does **not** select a nearby value just because it matches the expected threshold. Numeric df/significance qualifiers are distinguished from the critical value that follows them.
- Private keys use the existing lossless `flattenAnswerKey` adapter for objects, arrays and JSON strings. Explicit final/statistic/answer results and chi-squared equalities are checked numerically, including a worked equality ending with its numeric result. Method terms, critical values and unrelated mark numbers cannot substitute for a final statistic. All parsed final-result declarations must match the supplied counts.
- The numerical requirements remain: observed non-negative integers, expected counts at least five, matching totals, 2–11 categories, df = categories − 1, 5% significance, the original 1–10 df critical-value table and original rounding tolerances. Conflicting numeric claims fail. Non-finite totals/statistics also fail. A formula name or a task mentioning a null hypothesis cannot replace the actual supplied formula/definitions/hypothesis.
- Missing-resource diagnostics name each missing given. H420/03 statistical repair prompts include one explicit context template with numeric df/critical value when the existing table supplies a supported category count, plus private final-statistic/working/conclusion instructions. The repaired dataset is still fully validated; an example does not authorize changing counts or accepting a wrong key.

Only the actual displayed part text and the canonical rendered table caption are evidence. Existing `diagram_config`, `chart_data` and `table_data` aliases resolve through the shared resource adapter. Arbitrary metadata and sibling-only givens are deliberately excluded: these may be absent when the student switches question tabs or prints the paper. The repair must move the required information into this scored part's visible context/caption. No hidden-parent lookup or new persistence field is introduced.

## Verification

Node **24.19.0**, existing `package-lock.json`, `npm ci`. Clean baseline: **1,480 tests / 97 files**, 38 Edge Function bundles, production build and 50 Biology templates passed.

The new test file includes **82 cases** covering equivalent wording, structured keys, all supported df values, incorrect/conflicting/missing givens, formula grouping, missing definitions/hypothesis, private-key mismatch/non-disclosure, visible caption aliases, hidden-data rejection, counts/overflow and concrete repair instructions. Tests use the actual bundled extraction and publish handlers with intercepted model/database calls: full and short papers accept equivalent wording without repairs; a defective group is repaired once; repeated wrong private statistics stop after three repairs and cannot publish. No live model or backend is called.

Final result: **1,562 tests / 98 files, zero failed**. Type-checking, critical hook lint, Edge identifier checks, all **38** Edge Function bundles and the production build passed. The Biology inventory remains **50 templates**, the H420/03 and visual-assets audits pass, and `git diff --check` passes. Existing plan/definition/prompt fingerprints match their unchanged fixtures. Commands completed:

```sh
npm run check
node scripts/audit-biology.mjs
node scripts/audit-ocr-alevel-paper3.mjs
node scripts/audit-biology-visual-assets.mjs
git diff --check
```

All existing contract/plan/prompt fingerprint tests must pass without changing their fixtures. Browser checks are not repeated for this server-only fix; no frontend or PDF files change. The exact failed production payload, live generation, scientific quality and post-deployment behaviour remain unverified. Offline tests do not certify science or an external quality rating.

Existing non-blocking warnings: five deprecated packages during installation, stale Browserslist data, large production chunks and expected diagnostics from negative fixtures. Dependencies and warning thresholds are unchanged.

## Delivery and operator deployment

Changed files:

```text
docs/ocr-paper3-chi-squared-gate.md
supabase/functions/_shared/chi-squared-givens.ts
supabase/functions/_shared/ocr-alevel-biology-paper3-validation.ts
supabase/functions/_shared/question-repair.ts
supabase/tests/ocr-alevel-paper3-chi-squared.test.ts
```

After review and merge, Lovable must redeploy the affected Edge Function bundles from merged `main`: **extract-exam-questions**, **publish-exam**, **generate-practice-questions**, **get-practice-questions**, **grade-practice-question**, **submit-exam**. Static import/bundle analysis identifies these six consumers of the changed shared validation modules; extraction also includes the new repair guidance. A frontend publish alone cannot update them. Preserve their existing authentication settings. No migration is required.

Recommend **Squash and merge** for this focused fix after review. Deploy the functions before the user retries one short H420/03 paper, then a full paper after the short paper succeeds and is reviewed. Deployment, paid generation, database changes, website publication and merging are not performed here.
