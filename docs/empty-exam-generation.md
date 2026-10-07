# Empty exam generation repair

Based on remote `main` at `22f5e8d976ebcfcf3f49b9ed2b677ab8177dbdca`, including the merged H420/03 and visual-foundation implementations. The checkout was clean before creating `codex/fix-empty-exam-generation`.

## Reproduced defects

The reported message was “No questions found”. No failed-attempt payload or deployed-function logs were available, so this patch does not attribute the user's particular attempt to an unseen provider response.

Two paths through the actual extraction handler reproduced that message offline:

- Complete question rows returned as a top-level array or a `parts` array were discarded because generation only read `response.questions`. Flash-to-Pro fallback bought another response without correcting the parsing mismatch.
- AI gateway errors, including HTTP 402, 401, 403 and 429, were discarded inside guided batching. The final error concealed the provider failure and more batches made the same failing request.

Before the production fix, the initial focused reproduction suite had **7 failures and 2 passes**. Provider responses and storage were simulated; no paid generation or real account was used.

## Change

`generation-response.ts` adapts only explicit question envelopes: `questions`, `parts` or a top-level object array. It preserves numbering, resource data, private keys and metadata without flattening nested parent groups or inventing missing rows. Conflicting aliases, scalar rows and genuinely empty arrays are rejected.

Output-limit recovery accepts complete direct objects only when the provider explicitly reports `finish_reason: length`. It handles the same supported envelopes, nested resources and escaped strings. Nested metadata arrays, nested question arrays, malformed separators and ambiguous aliases are rejected. Accepted siblings and their resources still pass through the existing bounded completion flow.

The handler records safe failure codes, model, finish reason, HTTP status and the existing usage summary. It never copies provider bodies, refusal text, prompts or private answers into failure diagnostics. Authentication, payment/access and rate-limit errors stop further requests immediately. Transient errors retain the existing Flash/Pro fallback; fallback prompts restate the output envelope. Empty or unmatched batches now retain their rejection reason instead of collapsing to “No questions found”.

No paper contract, fingerprint baseline, syllabus/resource/task gate, ownership rule, quota, response envelope, marking or mastery behavior is changed. Limits remain 26 provider calls and nine minutes per request, six completion rounds, three repairs per group and eight repairs per request. No frontend, dependency, lockfile, migration, environment variable or live record is changed. The production visual library remains empty and unavailable for selection.

## Verification and rollout

Focused tests exercise the real bundled extraction handler and publish boundary with intercepted AI calls and a fake database. They cover full and short H420/03, Custom identity, complete alternative envelopes, truncation completion, HTTP failures, transient fallback, refusal, invalid transport, conflicting aliases, missing instructions and invented numbering. Parser tests cover data integrity and strict recovery boundaries.

Validation on Node **24.19.0** with the existing lockfile:

- `npm ci --cache /workspace/.npm-cache`: passed, 863 packages installed; dependencies and lockfile unchanged.
- Before editing, `npm run check`: **1,398 tests / 94 files**, type check, critical hook lint, Edge identifier check, **38 bundles** and production build passed.
- After the fix, `npm run check`: **1,452 tests / 96 files**, zero failures; the same type, hook, Edge and build checks passed. This includes 54 new tests in the two focused suites.
- `node scripts/audit-biology.mjs`: all **50** templates passed; all existing plan, definition and prompt fingerprint tests remained unchanged.
- `node scripts/audit-ocr-alevel-paper3.mjs` and `node scripts/audit-biology-visual-assets.mjs`: passed offline.
- `git diff --check`: passed.

Existing non-blocking warnings: five deprecated npm packages, stale Browserslist data and production chunks over 500 kB. Expected stderr from negative-path storage tests remains in the suite. No browser workflow was changed or real generation performed; handler tests verify that failed diagnostics are saved for the existing failure screen.

Deployment for this patch is **`extract-exam-questions` only**; its local shared modules must be bundled from the same merged revision. Publishing the frontend does not update this function. No migration or website publication is required. Any deployments still outstanding from earlier PRs remain separate prerequisites.

After review, use **Squash and merge** because this is one cohesive bug fix. Ask Lovable to deploy `extract-exam-questions` from the merged revision, preserving existing secrets and quotas. Then deliberately test one short paper before a full paper. If it fails, retain the full new diagnostic, exam ID, mode/component and deployed revision rather than repeatedly spending credits.

Actual model generation, the deployed revision, the original failed attempt and external scientific review remain unverified by these offline tests.
