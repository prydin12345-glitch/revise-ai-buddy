# Post-merge Lovable handoff

The [dependency graph](edge-function-dependencies.json) identifies 10 affected functions. New source-backed profiles store typed catalogue provenance; older consumers must be updated to understand it. Updating only `profile-builder` would leave generation or marking validating these profiles with the older schema.

After this PR is merged, send Lovable:

> Deploy the evidence-provenance fix from latest merged main while keeping the website unpublished. Update these nine consumers first: `upload-exam`, `extract-exam-questions`, `save-exam-format`, `save-exam-timer`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `grade-practice-question`, and `submit-exam`. Then update `profile-builder`. Preserve each function's existing authentication/JWT settings, ownership checks, quotas, retries and budgets. No migration, database-type regeneration or live-data edit is required. Confirm the deployed source revision for all ten functions and run the included offline/synthetic checks. Do not make paid AI calls, log in as a student, save/delete real profiles or generate paid papers for verification. Report actual results and anything still unverified with the real provider.

Previously failed requests are retained and are not replayed automatically. A fresh build is needed after rollout. Reattach the PDF after a full browser reload if necessary; normal builder remounts retain files in the same authenticated workspace.

The first separately authorised paid check should verify one new profile from the real syllabus before generating a paper, with external review of its scope, blueprint and source provenance. Synthetic checks do not prove the quality or scientific accuracy of future model output.
