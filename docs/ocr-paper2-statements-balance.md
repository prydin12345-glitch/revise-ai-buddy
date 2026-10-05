# H420/02 statement completeness and balance — 5 October 2026

Work starts from remote main `f1c1ae40` (the legitimate merged Q1 fix), on `codex/ocr-paper2-statements-balance`. It preserves `088a83e5aa4bfbc29ee933e498f1a69ad5e2aa21` in history. No data, migration, environment, dependency, lockfile, generated database type, deployment or existing-contract fingerprint is changed.

## Authoritative scope

Rechecked only OCR sources: [current H420 specification, v4.1 April 2026](https://www.ocr.org.uk/Images/687834-download-a-level-specification.pdf), [H420/02 sample assessment and marking materials, v3 February 2026](https://www.ocr.org.uk/Images/171738-unit-h420-02-biological-diversity-sample-assessment-materials.pdf), and [June 2025 examiner report](https://www.ocr.org.uk/Images/752105-examiners-report-biological-diversity.pdf). The existing Paper 2 source registry also records the reviewed 2024/2025 question papers and mark schemes. This change uses only syllabus boundaries, assessment structure, scientific/command precision and response conventions; no OCR question or copyrighted passage is copied into fixtures or prompts.

H420/02 Biological diversity remains untiered, 100 marks, 135 minutes, fifteen one-mark four-option MCQs in Section A and 85 marks of structured/extended responses in Section B. Modules **1, 2, 4, 6** are in scope. Generic molecular/cellular foundations are permitted, including DNA replication, membranes and enzymes. They were over-repeated in the supplied mock, not automatically out of syllabus. Plant defences, disease, classification, evolution and ecology are appropriate replacements. Plant transport is Module 3 and is not introduced as ordinary Paper 2 recall. Nitrogen and carbon cycling and industrial/immobilised enzymes are explicitly legitimate Module 6 topics.

## Repairs and compatibility

The common answerability gate now refuses combination-only MCQ choices when any referenced proposition is absent, empty or duplicated in the student-visible stem. It accepts complete paired propositions inside options and ordinary numeric MCQs. Safe public string-array `statements` output is preserved in the canonical question text. Private object truth tables are never appended to a public stem. The check runs during extraction, full-group repair, publication and Biology practice validation. It cannot prove scientific truth: four valid choices and a matching key still require a scientific review.

`invalid_statements` uses existing full-group repair and existing shared AI-call/time limits. Missing propositions cannot be reconstructed from choices alone: the prompt requires new original propositions, complete choices and a freshly checked private key together. No extra model stage or budget is introduced. Bad repairs still fail rather than publish an incomplete question.

New guided Paper 2 presets use contract **v2**. All 46 v1-and-earlier combinations retain their captured plan/definition/prompt hashes. Existing Paper 2 profiles reopen/resave v1, existing attempts and retries resolve their frozen version, and unsupported versions reject without fallback. To use the new balance after rollout, explicitly choose Full mock/Short practice and **Use these settings** in the profile. This does not change existing attempts. Custom keeps the user's manual choices; ordinary quizzes keep their requested count/format and topic selection. Paper 1, other boards, tiers and OCR Paper 3 availability are unchanged.

V2 full template's primary assessed module allocation is **14 marks Module 2 / 41 Module 4 / 45 Module 6**; Module 1 skills remain embedded. Short practice is **1 / 10 / 14**, 25 marks/34 minutes. These weights, seven full written groups and their narrower focuses are Examly design choices, not official OCR quotas. Planning and matching topic tags guide distribution; automated checks cannot establish the module identity or quality of every model-written sentence. The official time/mark/Section A requirements, existing AO totals, practical/mathematical targets, resource architecture and marking caps remain intact.

## Proposed edits to this supplied paper

See [student-visible replacement items](reviews/ocr-h420-02-student-revisions.md) and the separate [teacher keys and all-question review](reviews/ocr-h420-02-teacher-notes.md). Q13 contains three new fermentation propositions. Q2's two defensible keys, Q17's incorrect ex situ example and Q18's unsupported antibiotic superiority claim are addressed. No existing table/graph, paid generation, login or saved record is touched.

The assistant can review the text pasted here and the repository. It cannot currently see saved exams in the user's website account. Account email does not provide a session or database access. Future reports must state whether their evidence is pasted text, an explicitly supplied export, a synthetic fixture or authorised account data.

## Validation and rollout

Run on Node 24 with the unchanged package lock: `npm ci`, `npm run check`, `node scripts/audit-biology.mjs`, `node scripts/audit-ocr-alevel-paper2.mjs`, `git diff --check`. The audit inventory now has 48 combinations, including both v1/v2 full/short H420/02 templates. Focused tests cover statement completeness, aliases, repair/publish boundaries, numbering/batching, scoped totals, all fifteen MCQs, resources, tick-one private-key separation, practice cache versions, saved profile versions, screen/PDF labels and capped marking. The synthetic handler tests never call a live backend or paid AI.

After merge, deploy the changed shared imports with affected Edge Functions (list and completed checks recorded below). No new migration is needed. Website/frontend release and Edge deployment are separate authorised rollout actions and are not performed by this task. Real paid generation, all distractor truth values, actual resource quality, account save/reopen, live marking/mastery and PDF pagination remain to be verified after deployment. Gemini remains an external audit and is not added to the app.

Completed validation on Node **24.19.0**, npm **11.9.0**, unchanged lockfile:

| Check | Result |
|---|---|
| `npm ci --cache /workspace/.npm-cache` | PASS, 863 packages installed; cache contains integrity-checked lockfile artifacts |
| `npm run check` | PASS; **1,190 tests in 82 files, zero failures**, TypeScript, critical hook lint, Edge identifier check, all **38** bundles, production build |
| `node scripts/audit-biology.mjs` | PASS; all **48** registered combinations |
| `node scripts/audit-ocr-alevel-paper2.mjs` | PASS; v1/v2 full and short templates |
| `git diff --check` | PASS |
| Chromium settings-only preview | PASS; Paper 1/2 choices, v2 full and short save/reopen in browser memory, v1 Paper 1/2 retained, all Q13 propositions visible |
| Chromium fonts and errors | Manrope and Source Serif 4 loaded; no JavaScript, console or certificate errors; zero backend requests |

Chromium uses the actual profile modal, question renderer and styles through a temporary local harness with a stub preference reader and browser-memory save callback. It is not an authenticated website profile/database save. The managed proxy CA remains trusted with normal TLS validation. An initial localhost 403 (`Loopback targets forbidden`) was resolved by ordering Chromium's explicit localhost bypass after its implicit-loopback subtraction; external HTTPS continues through the managed proxy. No TLS bypass flags or repository configuration changes were used.

Existing non-blocking warnings: deprecated transitive dependency packages during installation, test DOM nesting warnings, stale Browserslist data, the ambiguous Tailwind `duration-[380ms]` class and large production chunks. Earlier development-run failures (inline statement recognition and legacy unsupported-version error wording) were fixed and regression-tested; the final checks above passed without suppressing tests or changing existing hashes.

Functions requiring deployment **after merge**, confirmed from esbuild dependency metadata: `extract-exam-questions`, `generate-practice-questions`, `get-practice-questions`, `grade-practice-question`, `publish-exam`, `save-exam-format`, `submit-exam`, `upload-exam`. The frontend also needs its normal approved release. No migration is required or created. Nothing has been deployed or published.

## Files

Added:

- `supabase/functions/_shared/numbered-statements.ts`
- `supabase/functions/_shared/ocr-alevel-biology-paper2-v2-contract.ts`
- `supabase/tests/numbered-statements.test.ts`
- `supabase/tests/ocr-alevel-paper2-v2.test.ts`
- `supabase/tests/ocr-alevel-paper2-v2-pipeline.test.ts`
- `supabase/tests/ocr-alevel-paper2-v2-fixtures.ts`
- `supabase/tests/fixtures/biology-pre-paper2-balance-baseline.json` (captured before implementation; 46 historical fingerprints)
- `docs/ocr-paper2-statements-balance.md`
- `docs/reviews/ocr-h420-02-student-revisions.md`
- `docs/reviews/ocr-h420-02-teacher-notes.md`

Changed:

- `src/components/exams/PaperModeSelector.tsx`
- `src/components/stats/ExamProfileModal.tsx`
- `src/test/ocr-alevel-paper2-profile.test.tsx`
- `supabase/functions/_shared/biology-course-packs.ts`
- `supabase/functions/_shared/biology-paper-contract.ts`
- `supabase/functions/_shared/biology-plan-validator.ts`
- `supabase/functions/_shared/biology-practice.ts`
- `supabase/functions/_shared/course-selection.ts`
- `supabase/functions/_shared/model-question-normalization.ts`
- `supabase/functions/_shared/question-contract-validator.ts`
- `supabase/functions/_shared/question-repair.ts`
- `supabase/tests/biology-paper-audit.test.ts`
- `supabase/tests/ocr-alevel-paper2-marking.test.ts`
- `scripts/audit-ocr-alevel-paper2.mjs`

For the draft PR choose **Squash and merge** after review and approval of the normal rollout. Do not merge or deploy as part of this development task.
