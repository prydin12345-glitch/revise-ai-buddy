# Lovable handoff

After this PR is reviewed and merged, send Lovable the prompt below. The deployment record must name its exact merged revision. This is an incremental change from PR #59 and does not certify the earlier PR #58/#59 rollout.

```text
Apply the merged Business source-identity and evidence-scoping correction from prydin12345-glitch/revise-ai-buddy.

First verify this correction has been reviewed and merged. Do not merge it yourself. Select and report its exact merged commit SHA; use that one revision for backend and frontend preview.

Read docs/profile-builder/business-source-evidence/README.md and edge-function-dependencies.json. The actual import graph checks all 39 Edge entry points and identifies two affected functions for this change: profile-builder and extract-exam-questions.

Deploy those two functions with their transitive shared modules and existing Deno import maps from the selected SHA. Verify the deployed revisions, then update the matching Lovable frontend preview. Preserve configuration, auth, ownership checks, quotas and call budgets. Keep the website unpublished. No database migration or existing-profile update is needed.

Run repository checks, backend type checks and the recorded controlled offline tests. Confirm source-proven Paper 1/9BS0/01 aliases do not require a repair call; actual other papers/courses/editions remain blocked; Paper 1 gets only Theme 1/4 evidence; shared qualification tables and sibling-paper prose cannot establish its rules; and an unconfirmed service call is not automatically replayed. Check the distinct field-error and service-error display at laptop/iPad/phone viewports.

Use controlled providers and synthetic ownership for tests. Do not make paid AI calls, access student data, change existing profiles or publish the website. Do not resume a failed possibly charged receipt as a fresh call; a new build after release must be a deliberate user action. Index version 8 refreshes evidence for new requests only.

Report each function's actual deployed revision, frontend preview revision, checks and limitations. If revision verification is unavailable, report it explicitly rather than claiming a verified deployment. If the earlier PR #58/#59 backend rollout is unverified, identify that dependency; do not assume merging deployed it.
```
