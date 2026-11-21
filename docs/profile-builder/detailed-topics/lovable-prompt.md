After merging the detailed syllabus topics PR into `prydin12345-glitch/revise-ai-buddy`, paste this into Lovable:

> Use the repository version of main containing the merged detailed syllabus topics PR. Keep the repository's version if Lovable offers to restore older work. Confirm and report the exact merged GitHub commit before making release changes; do not restore a backup, reset or force-push main.
>
> Deploy the changed shared backend code to these affected functions from that same commit: `profile-builder`, `extract-exam-questions`, `generate-practice-questions`, `get-practice-questions`, `grade-practice-question`, `publish-exam`, `save-exam-format`, `save-exam-timer`, `submit-exam`, and `upload-exam`. This list comes from the actual transitive import graph in `docs/profile-builder/detailed-topics/edge-function-dependencies.json`.
>
> Sync/build the frontend preview from the same commit so the profile editor shows searchable, grouped syllabus topics and expandable source outcomes. Do not publish the website. Keep existing environment variables and authentication/ownership checks. This change requires no database migration or dependency update.
>
> Verify deployment versions and the preview using offline/controlled fixtures. Confirm that the public Business Paper 1 reference yields 40 named syllabus units under Themes 1 and 4, with learning points and physical page references; Papers 2 and 3 have 40 and 80 units respectively. Full mock keeps the complete source topic pool even when a layout samples fewer topics. Quiz generation uses exact saved detailed labels and the chosen subset. Old profiles remain unchanged and need an explicit source re-read to recover detail; regenerating only their old draft is insufficient.
>
> Do not access student data, modify saved profiles, trigger live/paid AI builds, or replay failed charged requests during verification. Use the documented tests/fixtures. Report which commit and functions were deployed, preview status and any failed verification. Do not merge the PR or publish the website on my behalf.
