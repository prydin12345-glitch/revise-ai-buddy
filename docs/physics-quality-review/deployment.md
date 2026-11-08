# Post-merge Lovable handoff

The [dependency graph](edge-function-dependencies.json) checks all 39 actual Edge Function entry points. Ten functions consume changed validation, source or marking modules. Frontend PDF, graph, option and circuit-rendering changes also need the normal app build while the website remains unpublished.

After this PR is merged, send Lovable:

> Deploy this merged Physics/profile quality fix while keeping the Examly website unpublished. Update these ten functions from the same merged revision: `upload-exam`, `extract-exam-questions`, `save-exam-format`, `save-exam-timer`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `grade-practice-question`, `submit-exam` and `profile-builder`. Preserve their existing authentication/JWT settings, ownership and release rules, quotas and generation budgets. No migration, generated-type refresh or edit to existing exam/profile/grade data is required. Confirm each deployed revision and run the included offline/synthetic checks, including source-version rejection, known-repeat final/publication rejection, consistent keys, deterministic Physics MCQ marking and actual PDF figures/units. Do not log in as a student, spend AI credits, generate a paper, save/delete live profiles or republish the website. Report actual checks and any live revision or output-quality uncertainty. Do not automatically replay an old paid request.

Read-only follow-up: confirm whether the owner's current Paper 2 profile binds the actual uploaded issue or the reported 1.3/1.4 mismatch. Report a mismatch so the owner can explicitly rebuild it from the matching/current source; do not silently mutate the profile or historical exam snapshots.

The first separately authorised paid verification should be one fresh short Paper 2 followed by external review; then one fresh full Paper 2 followed by external review. Offline test counts do not establish real-provider scientific accuracy.
