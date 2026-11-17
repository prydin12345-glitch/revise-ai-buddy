# Business profile recovery deployment handoff

This document is a review handoff, not a deployment record. No function or website was deployed or published during this task. Use the reviewed PR head (or the exact merged successor) as the single source revision; record its full SHA in the deployment record.

## Scope from actual imports

Run `node docs/profile-builder/business-recovery/dependency-graph.mjs` from the checkout root. The tracked [dependency graph](edge-function-dependencies.json) bundles all 39 actual Edge entry points and intersects their transitive inputs with the changes from `de30799d3d9adc26454437e46bb343a1b0aa4289`. URL/npm runtime imports remain external; no handlers are executed.

The affected functions are:

- `extract-exam-questions`
- `generate-practice-questions`
- `get-practice-questions`
- `grade-practice-question`
- `profile-builder`
- `publish-exam`
- `save-exam-format`
- `save-exam-timer`
- `submit-exam`
- `upload-exam`

The wider list is necessary because response-format evidence validation is shared by generation, grading and save flows. Deploy each function together with its transitive shared modules and existing `deno.json` import map from the same selected revision. Do not substitute the older two-function handoff from the earlier assessment-identity fix.

## Ordered handoff

1. After review, select and record the exact approved commit. Install its locked dependencies with `npm ci --cache /tmp/examly-business-npm-cache`; retain the separate hmr-gate lockfile repair. Match the package Node engine and run the repository checks.
2. Type-check all ten affected function entry points with Deno and their existing import maps. Verify TLS normally using the platform trust store. The verification run used Deno 2.5.6 and `DENO_TLS_CA_STORE=system`; certificate verification was not disabled.
3. Deploy the ten affected functions and verify their actual deployed revision through deployment metadata. Preserve authentication, ownership checks, model budgets, quotas, environment configuration and the existing save contract. This change requires no migration or regeneration of existing profiles.
4. Activate the matching frontend revision only after the backend revisions are verified. Keep the website unpublished. For existing source receipts, prefer starting a fresh receipt when re-reading an old failed/ambiguous source; the document-index cache version is bumped, while existing saved profiles are left intact.
5. Repeat the offline fixtures and viewport harness using synthetic ownership and controlled providers. Verify three canonical Business choices; title-plus-code matching; selected overview evidence including Paper 3's physical-page-15 duration; sibling exclusion; retained attachments and manual references; blank/default intake fields; unknown tier preservation; safe schema/validation errors; and confirm/draft/save/resume contracts.
6. Record the source SHA, each function's verified deployed revision, matching frontend revision, checks and blockers. Hold fresh-build activation if revision compatibility cannot be established.

Do not use a live student's profile as a writable smoke test, regenerate existing profiles, make paid model calls, modify student data, publish the website, or claim a completed live AI build. A later build using the user's private upload is a separate user action. The public Pearson reference PDF is not that private upload.
