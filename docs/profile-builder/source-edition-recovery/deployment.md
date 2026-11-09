# Deployment handoff for Lovable

This is a handoff, not a record of a deployment. No deployment or database change was performed while implementing this PR.

After the PR is reviewed and merged, use this prompt in Lovable when ready to activate it:

> Apply the merged uploaded-syllabus edition recovery fix while keeping the website unpublished. Use the merged commit for both the preview client and backend. Preserve authentication, quotas, existing profiles, attempts and student data. Do not make paid AI calls or apply any database migration; this fix needs none.
>
> The checked dependency graph in `docs/profile-builder/source-edition-recovery/edge-function-dependencies.json` identifies ten affected functions: `extract-exam-questions`, `generate-practice-questions`, `get-practice-questions`, `grade-practice-question`, `profile-builder`, `publish-exam`, `save-exam-format`, `save-exam-timer`, `submit-exam`, and `upload-exam`. Deploy that exact dependency set from the same reviewed commit, with the matching `profile-builder` backend available before the preview client sends `specificationVersionIntent`. Do not deploy unrelated functions or publish the website.
>
> Verify the deployed revision and input compatibility without using a model or saving/deleting live profiles. The new `prepare_source` request accepts optional `specificationVersionIntent: source | explicit`; legacy requests remain constrained as before. Prefer the repository's offline provider/job fixtures for build, follow-up, draft/save/reopen and quota checks. Run the existing checks. Do not start a real paid build as a smoke test.
>
> Report the exact deployed commit and ten-function result, any input/schema/deployment mismatch, and confirm no migration, paid calls, live-data edits or publication. A student can then start a fresh build with the 2017 PDF and leave the optional version override blank. Do not automatically resume a terminal old failed job or rewrite saved profiles.

The actual private PDF/provider replies were unavailable in this coding task. Local tests reproduce the reported June 2017 cover and paper layout using original fixtures. A future real build is a separate user action and must not be described as already tested here.
