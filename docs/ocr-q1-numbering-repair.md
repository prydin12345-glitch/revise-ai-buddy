# OCR Q1: conditional-task recovery and numbering

Reconciled with main `aaf6e56b3a7ab5c6c58f8bc6927be09f9fe1670d` on 5 October 2026. The concurrent Lovable fix for conditional instructions is retained unchanged. It recognises a genuine directive after the givens in an `If`, `Given that` or `Assuming` stem; factual premises without a directive still fail.

## Reproduction

The supplied error reports `QQ1`, group `Q1`, and a repair beginning `If 20 eyepiece units measured 150 micrometres (µm) ...`. The error displays only the first 120 characters. The owner subsequently supplied a report confirming a `calculate` instruction after the premise. Tests use original synthetic completions of that calibration scenario; no live exam, private key or provider log was fetched.

Before the concurrent fix, the actual bundled extraction handler reproduces the same `missing_task` repair refusal with a complete conditional instruction. After fetching that fix, the conditional checks pass, but two related failures remain reproducible:

- Guided batching accepts the explicit number `Q1` as the same identity as planned `1`, then keeps the raw label and parent fields. The plan-order sorter puts it at the end of the paper.
- Repair matches `Q1` to returned `1`, but exact string comparisons omit its authored plan part from the prompt and subsequent validation. A valid repair then fails `plan_mismatch` against an empty group plan.

## Additional fix

New guided drafts store the exact authored number and root after the explicit model number has matched a requested plan part. All text, measurements, options and private keys remain unchanged. No row is mapped by position or relabelled to fill a missing part; duplicates, out-of-batch and unknown numbers remain rejected.

Repair uses the existing number-identity comparison to select the same authored outcomes, resource requirements and group plan. Existing saved row labels and IDs are preserved, and confirmed saves still filter both draft ID and exam ID. This is a repair-context fix, not a migration or retrospective rewrite of failed exams.

Question diagnostics add the `Q` prefix exactly once, so stored `Q1` appears as `Q1` rather than `QQ1`.

Existing answerability, source/resource, private-key, syllabus, ownership and release checks, retry context, atomic publication, repair limits and shared AI budgets remain in force. Course definitions, contract versions/fingerprints, generation-plan prompts, dependencies, lockfiles, generated database types and migrations are unchanged.

## Verification and rollout

New checks cover conditional directives versus context-only text, old Q-prefixed repair identities, restored plan/resource prompt content, single-prefix diagnostics, canonical batching without mutation/data loss, refusal to assign unknown numbers, full H420/02 generation and finalisation, one-call task repair, invalid private keys and the original repair ceiling. Test providers and databases are synthetic; no paid or real data-changing actions occur.

Node 24.19.0 verification passed: unchanged-lockfile `npm ci --cache /workspace/.npm-cache`; `npm run check` with **1,140 tests across 79 files, zero failures**, TypeScript, critical hook lint, Edge identifiers, all 38 bundles and the production build; both Biology audits (46 combinations); and `git diff --check`. Twenty-one new regressions supplement the concurrent conditional-detector test. Existing non-blocking package deprecation, DOM-nesting, Browserslist, Tailwind and chunk-size warnings remain. Browser settings and paid generation are not repeated because this patch changes backend generation/repair helpers only.

Esbuild dependency metadata identifies four functions for deployment after merge: `extract-exam-questions`, `generate-practice-questions`, `get-practice-questions`, `publish-exam`. Deploying `publish-exam` updates exam finalisation and does not publish the website. No deployment, migration or merge into main is performed during development. Actual deployed code and live model/scientific quality still require a deliberate owner-authorised follow-up.

Recommended PR merge type: **Squash and merge**, preserving this fix as one commit.
