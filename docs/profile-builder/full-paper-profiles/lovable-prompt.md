# Lovable handoff

After review and merge, use the prompt below. Verify the actual merged revision; a merge alone does not certify any deployment.

```text
Apply the merged full-paper-profile correction from prydin12345-glitch/revise-ai-buddy. Verify it has been reviewed and merged; do not merge it yourself. Report the exact merged SHA and use that revision for backend and frontend preview.

Read docs/profile-builder/full-paper-profiles/README.md, verification.json and edge-function-dependencies.json. The import graph checked all 39 real Edge entrypoints. Redeploy these ten functions with their transitive shared modules and existing Deno configurations:
extract-exam-questions
generate-practice-questions
get-practice-questions
grade-practice-question
profile-builder
publish-exam
save-exam-format
save-exam-timer
submit-exam
upload-exam

Update the matching frontend preview and keep the website unpublished. Deploy function code only; do not invoke live generation, marking, submission or publication actions for verification. Preserve configuration, ownership/auth checks, quotas, call budgets and existing profiles. No migration or existing-profile conversion is needed.

Run recorded controlled checks. Confirm a new profile defaults to full_mock with no mode chooser; quiz topics/count are chosen later; saved short/custom profiles still edit without conversion. Confirm Edexcel A-level Business 9BS0 uses the reviewed untiered catalogue record rather than a fabricated PDF quote, and all three paper identities still bind to the owner's source. Different courses, qualifications, countries and genuine tier/edition conflicts must remain blocked. A genuinely unknown full-paper tier asks for a source and keeps full-paper mode, without forcing short practice.

Check that a full 100-mark/120-minute profile can produce a two-question topic-filtered quiz, preserves the source profile, permits saved topics without a planned draft question, and rejects deselected/outside-scope topics before persistence. Use the recorded laptop/iPad/phone flows and synthetic providers/ownership. Do not make paid AI calls, access student data, change existing profiles or publish the website.

Report each function's actual deployed revision, frontend preview revision, checks and limitations. If revision verification is unavailable, say so explicitly. Do not automatically replay old failed or possibly charged receipts; use deliberate user actions for a fresh build after release.
```
