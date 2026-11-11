# Lovable deployment handoff

This is a handoff for after review and merge, not a deployment record. The preview may update automatically when the PR merges; backend-before-client ordering cannot be claimed from that event. New builds must wait until matching backend revisions are verified.

Paste this into Lovable after merging the correction:

> Activate the merged assessment-identity and manual-component-reference correction while keeping the website unpublished. Select its exact reviewed merged commit SHA and use that same revision for the preview and backend. Report the full SHA; a PR number is not a revision.
>
> Follow `docs/profile-builder/assessment-identities/edge-function-dependencies.json`. The actual graph of all 39 entry points identifies two affected functions: `extract-exam-questions` and `profile-builder`. Deploy both with their shared imports and existing Deno import maps from the selected SHA. Make the extraction consumer and matching builder available before fresh profile building. Preserve authentication, ownership checks, quotas, generation budgets and configuration. Do not deploy unrelated functions.
>
> Verify each function's actual deployed source revision using available deployment metadata, and confirm the preview revision. Run the recorded offline regression and compiler checks without a paid model call or writable student smoke test. Verify the new `prepare_source` fields `selectedAssessmentId` and `manualComponentCode: { value, confirmed: true }` are accepted, while legacy requests remain supported. An unknown confirmed code is a user reference, never a source identity or evidence grant; known conflicting codes must still be blocked.
>
> Confirm the offline fixtures cover three clean Business choices, a selected assessment on a shared page, cross-page sibling exclusion, retained files and reading during follow-up, manual-code confirmation/cancellation, cache reuse, drafting and the existing save contract. Do not use a real student's profile as a writable test. Report limitations rather than claiming a successful live AI build.
>
> Do not generate a real paper or profile, make paid AI calls, log in as a student, edit or delete live records, regenerate existing profiles or attempts, change configuration, apply migrations, regenerate database types or publish the website. This correction requires no migration.
>
> Report the selected SHA, actual revision/result for each of the two functions, preview revision, check results and remaining blockers. If a revision or compatibility check cannot be verified, keep fresh-build activation held and explain why. A later real build from the student's PDF is a separate user action.

This graph describes the current correction relative to `51da022b`. It does not certify completion of a prior deployment or establish live permissions on private answer/source columns.
