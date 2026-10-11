# Changed file inventory

Audited base: `7bf44645ba38d9cef9d2d0f5910e27705c3a9568`. Every path below is repository relative. No numbered paste files or hand-edited generated types are required.

| Area | Exact path |
| --- | --- |
| Documentation | `docs/pending-migrations/20261011120000_source_backed_profile_builder.sql` |
| Documentation | `docs/profile-builder/README.md` |
| Documentation | `docs/profile-builder/browser-verification.json` |
| Documentation | `docs/profile-builder/deployment-dependencies.json` |
| Documentation | `docs/profile-builder/files.md` |
| Documentation | `docs/profile-builder/preset-inventory.json` |
| Documentation | `docs/profile-builder/preset-inventory.md` |
| Documentation | `docs/profile-builder/rollout.md` |
| Documentation | `docs/profile-builder/screenshots/desktop-light.png` |
| Documentation | `docs/profile-builder/screenshots/mobile-dark.png` |
| Documentation | `docs/profile-builder/verification.md` |
| Build/audits/config | `package-lock.json` |
| Build/audits/config | `package.json` |
| Build/audits/config | `scripts/audit-profile-coverage.mjs` |
| Build/audits/config | `scripts/check-profile-sources.mjs` |
| Build/audits/config | `scripts/profile-source-fetch.mjs` |
| Frontend | `src/components/exams/BiologyPaperSelector.tsx` |
| Frontend | `src/components/exams/PaperModeSelector.tsx` |
| Frontend | `src/components/profiles/ExamProfileBuilder.tsx` |
| Frontend | `src/components/profiles/ExamlyApprovalBadge.tsx` |
| Frontend | `src/components/stats/ExamProfileModal.tsx` |
| Frontend | `src/components/subjects/ExamProfileCard.tsx` |
| Frontend | `src/components/subjects/ExamProfileRow.tsx` |
| Frontend | `src/hooks/useSubjectProfiles.ts` |
| Frontend | `src/lib/biology-paper-display.ts` |
| Frontend | `src/lib/exam-profile-display.ts` |
| Frontend | `src/lib/profile-builder-client.ts` |
| Frontend | `src/lib/profile-context.ts` |
| Frontend | `src/pages/CreateExam.tsx` |
| Frontend | `src/test/profile-builder.test.tsx` |
| Build/audits/config | `supabase/config.toml` |
| Backend | `supabase/functions/_shared/biology-course-packs.ts` |
| Backend | `supabase/functions/_shared/biology-marking.ts` |
| Backend | `supabase/functions/_shared/biology-plan-validator.ts` |
| Backend | `supabase/functions/_shared/biology-practice.ts` |
| Backend | `supabase/functions/_shared/course-selection.ts` |
| Backend | `supabase/functions/_shared/preset-approval-records.ts` |
| Backend | `supabase/functions/_shared/preset-approval.ts` |
| Backend | `supabase/functions/_shared/profile-builder-service.ts` |
| Backend | `supabase/functions/_shared/profile-context.ts` |
| Backend | `supabase/functions/_shared/profile-document-io.ts` |
| Backend | `supabase/functions/_shared/profile-evidence.ts` |
| Backend | `supabase/functions/_shared/profile-fingerprint.ts` |
| Backend | `supabase/functions/_shared/profile-source-registry.ts` |
| Backend | `supabase/functions/_shared/profile-template-context.ts` |
| Backend | `supabase/functions/_shared/profile-template-plan-validator.ts` |
| Backend | `supabase/functions/_shared/profile-template.ts` |
| Backend | `supabase/functions/extract-exam-questions/deno.json` |
| Backend | `supabase/functions/extract-exam-questions/index.ts` |
| Backend | `supabase/functions/generate-practice-questions/deno.json` |
| Backend | `supabase/functions/generate-practice-questions/index.ts` |
| Backend | `supabase/functions/get-practice-questions/deno.json` |
| Backend | `supabase/functions/get-practice-questions/index.ts` |
| Backend | `supabase/functions/grade-practice-question/deno.json` |
| Backend | `supabase/functions/profile-builder/deno.json` |
| Backend | `supabase/functions/profile-builder/index.ts` |
| Backend | `supabase/functions/publish-exam/deno.json` |
| Backend | `supabase/functions/save-exam-format/deno.json` |
| Backend | `supabase/functions/save-exam-timer/deno.json` |
| Backend | `supabase/functions/submit-exam/deno.json` |
| Backend | `supabase/functions/upload-exam/deno.json` |
| Backend/tests | `supabase/tests/profile-approval.test.ts` |
| Backend/tests | `supabase/tests/profile-builder-db.test.ts` |
| Backend/tests | `supabase/tests/profile-builder-fixtures.ts` |
| Backend/tests | `supabase/tests/profile-builder-handler.test.ts` |
| Backend/tests | `supabase/tests/profile-builder-service.test.ts` |
| Backend/tests | `supabase/tests/profile-document-io.test.ts` |
| Backend/tests | `supabase/tests/profile-evidence.test.ts` |
| Backend/tests | `supabase/tests/profile-source-fetch.test.ts` |
| Backend/tests | `supabase/tests/profile-template-pipeline.test.ts` |
| Backend/tests | `supabase/tests/profile-template.test.ts` |

71 files in this final change. Source, tests, approval/source records, rollout documentation and screenshots are included. The only package change is the pinned PDF parser.

The full request/proposal/save workflow resides in the new shared service, existing profile modal and authenticated `profile-builder` function. Existing generation/marking integrations are incremental changes.
