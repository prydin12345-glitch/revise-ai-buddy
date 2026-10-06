# Butterfly Q8: merged fix and backend rollout

Verified from fetched main `648d6a3978911a6cc1fb22dfc970e85eac866385` on 6 October 2026. PR #7 is merged and its GitHub checks passed.

## Evidence

The reported repair contains this complete assessed task:

> Based on the provided graph, in which year was the butterfly population showing the greatest rate of increase?

Bundling the task detector from the preceding main commit `65cf22f07b03a6c2fe82cc414785af2bfea96513` rejects that exact wording. Bundling the detector from current main accepts it. PR #7 already covers the `in which … was` construction, including the graph introduction. Changing the grammar again is not necessary for the supplied task.

`supabase/tests/ocr-butterfly-task.test.ts` adds eight regressions using the exact wording with an original synthetic butterfly graph, four year options and a matching private key. Both saved H420/02 contract versions pass actual bundled generation and finalisation with zero repairs; a context-only Q8 recovers with the supplied task in one repair. Options, graph and private key survive unchanged. Missing graphs and mismatched private keys still block completion. Every model call and database operation in these tests is intercepted; the live exam and its resources are not read or changed.

Verification on Node 24.19.0 passed: unchanged-lockfile `npm ci --cache /workspace/.npm-cache`; `npm run check` with **1,271 tests in 86 files, zero failures**, TypeScript, critical hook lint, Edge identifier checks, all 38 Edge Function bundles and production build; both Biology audits (48 registry combinations and four H420/02 version/mode combinations); lint of the new test file; and `git diff --check`. The targeted butterfly/detection run passes all 41 tests. Existing package-deprecation, test DOM-nesting, Browserslist and production chunk-size warnings remain. The optional full-repository lint was not repeated; its previously reported baseline failures are outside this test/documentation-only change.

## Remaining live issue

The owner confirmed that PR #7 was squash-merged without redeploying the Edge Functions. The backend rollout step remains outstanding; the reported rejection is consistent with the pre-PR-#7 checker. GitHub merge status and passing repository tests do not establish the deployed Supabase revision. This cloud environment has no Supabase management token, CLI or callable management connector with which to inspect the live function's source/version. Public frontend credentials cannot establish that revision. No generation endpoint is called to probe deployment because it could run paid AI or modify exam records.

The repository's GitHub workflow runs checks only; it does not deploy Edge Functions. Publishing the frontend does not deploy this shared backend checker. Deploy the four functions that bundle it from main commit `648d6a3978911a6cc1fb22dfc970e85eac866385` or a later legitimate main revision:

- `extract-exam-questions` — the reported generation/repair failure.
- `generate-practice-questions`
- `get-practice-questions`
- `publish-exam` — finalises generated exams; it does not publish the website.

An operator with existing Supabase deployment access can use the repository's existing function configuration:

```sh
supabase functions deploy extract-exam-questions --project-ref ynhevbrihlnwzehrfoft
supabase functions deploy generate-practice-questions --project-ref ynhevbrihlnwzehrfoft
supabase functions deploy get-practice-questions --project-ref ynhevbrihlnwzehrfoft
supabase functions deploy publish-exam --project-ref ynhevbrihlnwzehrfoft
```

These commands are documented, not executed or verified in this task. Keep the repository's existing JWT/authentication configuration. No migration, service-role credential, Gemini key, contract/hash update or frontend publication is required for this detector fix. Inspect the deployed bundle/version before retrying paid generation; its scientific quality remains a separate live review.

The earlier instruction prohibiting Edge Function deployment remains in force. This task does not deploy, migrate, generate a paid paper or modify real records. The regression/documentation commit adds no runtime change and is not a prerequisite for deploying the already merged fix.

For future backend fixes, the delivery report must identify the affected Edge Functions and the separate deployment step after merge, alongside the recommended merge method.

If merging the regression PR, use **Squash and merge** to keep its tests and rollout evidence in one commit.
