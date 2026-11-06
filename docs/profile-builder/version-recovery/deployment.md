# Deployment handoff after merge

Only `profile-builder` requires deployment, based on the [actual dependency graph](edge-function-dependencies.json). The code includes the merged #49 changes and this follow-up. Deploying the older #49 implementation alone would still leave teaching-date handling incomplete.

Copyable Lovable prompt, **after this follow-up PR is merged**:

> Deploy only `profile-builder` from the latest merged main, including both PR #49 and the teaching-date/source-recovery follow-up. Preserve existing authentication/JWT settings, ownership checks, quotas and generation budgets. No migration or database-type regeneration is required. Keep the website unpublished and leave other functions alone. Confirm the deployed source revision. Verify the included offline/synthetic cases for AQA A-level Physics `7408/1` with “First teaching 2015, first exams 2017”, source Paper 2 clarification, genuine issue mismatch and AS/A-level/option isolation. Do not make paid AI calls, log in as a student, save/delete profiles or change live data for verification. Report actual results and anything that still requires separately authorised real-provider testing.

No deployment is performed by this change. Previously failed receipts are retained, and their calls are not replayed. Use a fresh build after rollout; attachments survive builder remounts in the same owner workspace, while a full browser refresh requires reattachment.
