# Physics practice parity activation

Lovable reported that the preview already contains PR #55, while the eight-function backend deployment was held at 0/8. This correction does not establish a new live deployment state. Merge it before resuming activation, then select one reviewed merged commit for the complete backend set and matching preview.

Both practice URLs now call the canonical shared generator. Their HTTP handlers retain the existing authentication, ownership checks, quota name, request flags and interactive-attempt behavior. The shared implementation preserves the current canonical generation body, including Physics prompts, cache isolation, figure validation and private calculation envelopes. Existing attempt snapshots retain their original policy. The compiler fix already merged in `0147a2a4521c4e61eb822581a63bfbe5f34a5f0d` remains intact; this correction also supplies explicit null fallbacks at two extraction call sites found by strict Deno checking.

[The dependency report](deployment-dependencies.json) builds all 39 actual Edge Function entry points, including the new shared module. The correction compared with `0147a2a4521c4e61eb822581a63bfbe5f34a5f0d` affects three functions: `extract-exam-questions`, `generate-practice-questions` and `get-practice-questions`. The full activation compared with pre-PR #55 commit `82cfc84b032c634c164799e18657a60c2b13d45f` still requires eight. Use the full set because the original activation was held.

Send Lovable this handoff after review and merge:

> Resume the held Physics activation using one reviewed merged SHA containing PR #55, its merged validator compiler fix and the practice-route correction. The preview was already updated; confirm it now uses this same revision. Keep the website unpublished.
>
> Deploy these eight functions from that SHA, with their shared imports and existing per-function Deno import maps: `grade-practice-question`, `submit-exam`, `publish-exam`, `extract-exam-questions`, `generate-practice-questions`, `get-practice-questions`, `upload-exam` and `save-exam-format`. Make the grading/publication readers available first, then the three generation entry points, then the upload/format snapshot writers. Do not enable fresh generation until the complete set is confirmed. Preserve existing authentication/JWT configuration, ownership rules, quotas and generation budgets.
>
> Run the recorded offline/synthetic checks, including actual Deno type checking and both practice routes. Verify the deployed source revision for each function using available deployment metadata; a local passing check or updated preview is not evidence of a deployed backend. If a revision cannot be verified, report it as unverified and keep activation held.
>
> Do not make paid AI calls, generate or regenerate a paper, log in as a student, edit live records, change configuration, apply migrations, regenerate database types, deploy unrelated functions or publish the website. No migration is required for this correction. Report the selected SHA, each function's actual deployed revision/result, preview revision, check results and any remaining blocker. A later fresh-paper quality review remains a separate user action.

Repository checks do not verify the live database's column grants or snapshot protections. This work made no live database inspection or deployment and does not claim those protections were checked.
