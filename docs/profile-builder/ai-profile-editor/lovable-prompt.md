After merging the AI exam profile editor PR into `prydin12345-glitch/revise-ai-buddy`, paste this into Lovable:

> Use the GitHub version of main containing the merged AI exam profile editor PR. Keep the repository version if Lovable offers to restore older work. Confirm and report the exact merged commit first. Do not restore a backup, reset main, force-push or merge the PR yourself.
>
> Deploy these affected functions from that same commit: `profile-builder`, `extract-exam-questions`, `generate-practice-questions`, `get-practice-questions`, `grade-practice-question`, `publish-exam`, `save-exam-format`, `save-exam-timer`, `submit-exam`, and `upload-exam`. The list comes from the actual transitive import graph in `docs/profile-builder/ai-profile-editor/edge-function-dependencies.json`. All schema consumers need the revision that accepts optional user topic presentation metadata and redacts private notes in snapshots.
>
> Sync/build the frontend preview from the same commit. Do not publish the website. Keep existing environment configuration, authentication and ownership checks. No dependency changes or database migration are needed.
>
> Verify the documented offline/controlled fixtures: subtopic search/group filters, direct edit/add/remove, personal notes, bulk removal, Undo, source restoration, save retry, discard/close/reopen and legacy AI profiles. The original generated template and owned evidence must round-trip intact. Display-label edits must keep canonical quiz/topic/scoring identities unchanged. Personal notes must stay out of shareable snapshots. Unknown calculator rules must stay unknown. Opening or browsing profiles must not regenerate anything.
>
> Do not access student data, rewrite existing saved profiles, start live/paid AI builds, or replay failed charged requests during verification. Use the controlled tests and browser harness. Report the deployed commit/function versions, frontend preview status and any failed checks. Do not publish the website on my behalf.
