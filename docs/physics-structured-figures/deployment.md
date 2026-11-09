# Lovable activation prompt

This is a handoff for after code review and merge. No activation was performed during implementation.

> Activate the merged Physics structured-figure and numerical-integrity fix from the same reviewed commit for both the preview client and backend. Keep the website unpublished. Preserve authentication, quotas, existing exams/profiles/grades and attempt snapshots. Do not apply a database migration or make paid AI calls; this change needs neither for rollout verification.
>
> Follow `docs/physics-structured-figures/deployment-dependencies.json`. The actual import graph identifies eight affected functions: `extract-exam-questions`, `generate-practice-questions`, `get-practice-questions`, `grade-practice-question`, `publish-exam`, `save-exam-format`, `submit-exam`, and `upload-exam`. Deploy this complete set from the same commit, with validation/marking readers available before enabling new generation writers and the matching preview client. Do not deploy unrelated functions or publish the site.
>
> Check deployed revisions and input compatibility without real generation or live-data edits. Run the repository's offline generation, repair, publication, marking, cache and browser/PDF fixtures. Do not use a saved student exam as a writable smoke test. New server snapshots carry `physics_generation_version: 1`; old attempts must retain their existing policy. Confirm versioned public figures and protected private calculation envelopes survive the full pipeline, while malformed or answer-bearing public figures block release.
>
> Report exact deployed revisions, eight-function results, any schema/version mismatch, and confirmation of no migration, paid calls, live writes or publication. A student can then choose to create a fresh exam. Do not regenerate or migrate existing exams automatically. Passing the software checks does not certify a new model-written paper's scientific quality.
