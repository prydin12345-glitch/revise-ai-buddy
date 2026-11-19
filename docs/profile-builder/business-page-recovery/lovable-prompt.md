# Lovable handoff

After review and merge, send the following prompt. Use the actual merged revision, not the earlier PR #60 revision or an assumed current preview.

```text
Apply the merged Business page-clarification, tier and build-recovery correction from prydin12345-glitch/revise-ai-buddy. Verify it has been reviewed and merged; do not merge it yourself. Report its exact merged SHA and use that same revision for backend and frontend preview.

Read docs/profile-builder/business-page-recovery/README.md, verification.json and edge-function-dependencies.json. The actual import graph checked all 39 Edge entrypoints: deploy profile-builder and extract-exam-questions with their transitive shared modules and existing Deno configurations. Update the matching frontend preview and keep the website unpublished. Preserve configuration, auth, ownership checks, quotas and call budgets. No database migration or existing-profile update is needed.

Verify and report each deployed function revision and the frontend preview revision. Run the recorded controlled tests, including the public Business PDF and laptop/iPad/phone flows. Confirm Paper 1 accepts physical pages 18 and 40 through its literal Themes 1/4 allocation, suggests relevant content pages, excludes sibling content, and preserves prior marks/time on same-job page answers. Unknown tier must stay unknown; genuinely conflicting quoted tiers stay blocked. The explicit tier alternative may change to short practice locally without another source call, and must not certify a full mock.

Confirm a failed or focused clarification exposes Change details or documents and Start new build. Restart must retain the attachment and paper, require confirmation, and make no AI call until a deliberate Read syllabus/Build action. Resume and status checks must not replay a possibly charged failure. Old failed receipts are not automatically requeued; index version 9 applies to new indexing/cache keys.

Use controlled providers and synthetic ownership. Do not make paid AI calls, access student data, change existing profiles or publish the website. Report verification limits explicitly; if a deployed revision cannot be verified, do not claim that it was verified.
```
