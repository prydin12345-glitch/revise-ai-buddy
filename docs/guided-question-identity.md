# Guided generation identity repair and cost estimate

Started from clean remote `main` at `fb7aaf0a`, the merged no-questions repair (#11), on `codex/fix-guided-question-identity`. Its tree matches the previously verified 1,452-test baseline exactly.

## Evidence

The reported attempt completed two provider requests and returned six rows, but rejected all six as `unplanned_part` against six saved parts. This identifies the failing boundary: parsing succeeded; explicit part identity matching failed. The actual returned labels and deployed logs were not supplied, so no particular live spelling is claimed as confirmed.

Six initial focused tests failed before this repair. The actual bundled handler reproduced the two-call/all-six-rejected path with original synthetic H420/03 short-practice rows using numeric subparts (`1.1`), word prefixes (`Question 1(a)`), `questionNumber` fields and exact immutable `part_id` fields. Tests also reproduced acceptance of conflicting fields and missing rejection feedback in completion prompts.

## Repair

- Recognise equivalent explicit numeric/lettered subpart labels and the full “Question” prefix. A bare standalone `1` still cannot become `1(a)`.
- Resolve `question_number` / `questionNumber` and exact case-sensitive `part_id` / `partId` against the complete saved plan. All populated identities must agree. An exact saved ID returned in the number field is also a verifiable identity.
- Reject unknown, missing, invalid or conflicting identities. Never infer a part from array order, topic, marks or response type. A conflicting or unknown number cannot be rescued by a different valid ID.
- Give each generation batch a small explicit public ID/number/mark map. Bounded completion receives deduplicated identity rejection feedback; a malformed label is represented generically rather than echoed into diagnostics. Neither map nor feedback contains question text, private keys or resources.
- Store the exact authored label only after matching. Every existing task, scope, scientific, resource, private-key, marks and publication gate remains required. No contract/version/fingerprint or retry budget is changed.

Tests cover all six short rows, all 24 full rows / 70 marks, reversed order, aliases, conflicting identities, invented IDs, missing labels, duplicate/out-of-batch refusals, bounded correction, answer-safe diagnostics and continued rejection of invalid marks/resources. Databases and model responses are simulated; no real or paid generation occurs.

Final validation on Node **24.19.0** and the existing lockfile:

- `npm ci --cache /workspace/.npm-cache`: passed, 863 packages; lockfile unchanged.
- `npm run check`: **1,480 tests across 97 files, zero failures**, frontend type and critical hook checks, Edge identifier checks, **38 function bundles**, production build passed. The new identity suite contains 28 tests.
- `node scripts/audit-biology.mjs`: all **50** templates passed; every existing plan/definition/prompt fingerprint test remained unchanged.
- H420/03 and visual-asset offline audits passed; `git diff --check` passed.
- Esbuild dependency metadata confirms only `extract-exam-questions` requires deployment for this patch.

Existing non-blocking warnings: five npm package deprecations, stale Browserslist data and large production chunks. No frontend/printed layout or browser behavior was changed; no browser or real-account generation check was performed.

## Token cost for the reported attempt

Reported usage: **10,486 input + 6,987 output = 17,473 tokens**, across two requests. This is modest for exam questions plus private marking material. The waste is paying for a second response that repeats an avoidable identity mismatch. “0 failed” counts provider/HTTP failures, not success of the final exam gate; successful AI responses can still incur charges when Examly rejects the paper.

Official pricing checked on **7 October 2026**:

- [Google Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing): standard Gemini 2.5 Flash text input **$0.30/million**, output including thinking **$2.50/million**. Applied to the reported tokens: `10486 × 0.30 / 1e6 + 6987 × 2.50 / 1e6 = $0.0206133`, about **two US cents**.
- The same reported usage at standard Gemini 2.5 Pro rates (input **$1.25/million**, output **$10/million**, prompts below 200k tokens) is **$0.0829775**, about eight US cents. The normal two-generation-call path uses Flash; the supplied aggregate does not itemise the models.
- [Lovable AI usage and pricing](https://docs.lovable.dev/integrations/ai): gateway usage is billed in credits, based on provider costs and reported usage. The per-project **Cloud → AI** request history shows model, tokens and actual cost; workspace **Plans & credit usage → Usage details → Run credits** shows aggregate spend.

These are provider-rate estimates for the tokens shown, not a Lovable invoice. Per-model mix, any unreported billable usage, credit conversion and hosting are not established by the error. A successful full paper or additional retries can cost more. The existing repository `estimateCredits` constants are rough and do not match these current Google rates; they were not used as billing evidence or changed in this generation repair.

## Rollout

After review use **Squash and merge**: one cohesive generation repair. Redeploy **`extract-exam-questions` only** from the merged revision, including shared modules. Frontend publication does not update this handler. Keep existing secrets, quotas and migration state unchanged. Then deliberately test one short paper before one full paper, retaining any complete diagnostic and deployed revision if it fails. No website publication, deployment, migration or live-data change was performed here.

The original response labels, real model generation and external scientific review remain unverified.
