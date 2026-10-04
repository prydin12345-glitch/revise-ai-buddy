# OCR A-level Biology A — H420/02 Biological diversity

Based on clean commit `088a83e5aa4bfbc29ee933e498f1a69ad5e2aa21`, reconciled with remote main on 4 October 2026. Adds explicitly saved Paper 2 alongside Paper 1. H420/03 remains unavailable; H020 AS and H422 Biology B are separate qualifications. There is no Foundation/Higher tier.

## Verified OCR requirements

The specification is version 4.1 (April 2026); the sample materials are version 3.0 (February 2026). H420/02 is **100 marks, 135 minutes, 37% of the A-level**, with all questions compulsory. It assesses **Modules 1, 2, 4 and 6**. Section A has fifteen separately scored one-mark MCQs with four A–D options. Section B has 85 marks of structured, calculation, practical/problem-solving and extended-response tasks. All components include synoptic assessment. The practical endorsement is assessed separately.

Synoptic tasks link Module 2 foundations to immunity, inheritance, gene technology, evolution and ecological evidence. Module 3/5-only mechanism recall is not treated as ordinary Paper 2 content; an unfamiliar application must supply any additional background. The prompt and conservative recall-demand checks supplement the saved outcome plan; they cannot classify every scientific statement or certify a model-authored paper.

Sources downloaded and checked directly on 4 October 2026, using only OCR:

- [Current H420 specification](https://www.ocr.org.uk/Images/687834-download-a-level-specification.pdf): sections 2a, Modules 1/2/4/6, 3a/3b, 3i and 5d.
- [H420/02 sample materials](https://www.ocr.org.uk/Images/171738-unit-h420-02-biological-diversity-sample-assessment-materials.pdf): Section A/B, calculation conventions and levels of response.
- June 2025: [question paper](https://www.ocr.org.uk/Images/752365-question-paper-biological-diversity.pdf), [mark scheme](https://www.ocr.org.uk/Images/752492-mark-scheme-biological-diversity.pdf), [examiner report](https://www.ocr.org.uk/Images/752105-examiners-report-biological-diversity.pdf).
- June 2024: [question paper](https://www.ocr.org.uk/Images/726691-question-paper-biological-diversity.pdf), [mark scheme](https://www.ocr.org.uk/Images/726818-mark-scheme-biological-diversity.pdf), [examiner report](https://www.ocr.org.uk/Images/726426-examiners-report-biological-diversity.pdf).

Only structure, syllabus, command-word, response/resource and marking conventions were extracted. No past-paper questions, images or copyrighted passages are copied into generation prompts or fixtures.

## Version 1 Examly templates

| Mode | Marks | Minutes | MCQs | Written parts | Parent questions |
|---|---:|---:|---:|---:|---:|
| Full mock | 100 | 135 | 15 | 28 | 22 |
| Short practice | 25 | 34 | 5 | 6 | 7 |

Seven written groups, 43 scored parts, two six-mark level responses, exact resource distribution and AO targets 36/42/22 are **Examly design choices**, not an official fixed historical question count. Maths/practical annotations guide drafting, not scientific or demand certification. The short plan is labelled an Examly development template. Custom retains manual topics, count, format and time while keeping its explicitly saved Paper 2 identity. Ordinary quizzes retain their requested count and format.

The deterministic contract is built before model calls. MCQs retain four distinct descriptive choices, A–D order and exactly one private matching key. Invalid keys block publication/marking rather than becoming zero. Numerical/practical tasks require complete givens, units and consistent canonical resources. Formulae and statistical test evidence must be supplied where required. Completed inheritance solutions, assessed labels and private resource fields are refused. The existing shared resource checks remain in force.

Six-mark responses use task-specific OCR three-level science descriptors: best-fit science determines level and coherent communication determines the mark within it. Other written responses use capped points/alternatives and valid working. MCQ marking remains deterministic. One capped result per scored question feeds existing mastery; failed marking remains ungraded.

## Saved context and shared responses

The existing `paper_blueprint` JSON records course/paper/specification/contract version and mode. Only the owned-profile resolver authors the protected generation snapshot. Retry reads the original snapshot; edited profile or browser metadata cannot change the component. Paper 1 cache identity and prompts remain unchanged, with a separate Paper 2 practice cache identity.

Interactive formats remain the existing guided-profile opt-in. Tick-one MCQs adapt without extra calls where supported; graph MCQs keep their existing renderer. Suitable short tasks may use matrix/grid, cloze or labelled fields through the existing bounded adaptation and strict public/private contracts. Formats are not forced onto unsuitable scientific tasks. Existing call/time budgets, recovery, ownership/release checks, atomic response persistence and mastery caps are reused.

No new migration, generated-type change, dependency/lockfile change, quota change or historical-score update is required. This addition assumes the existing Batch 1/2/3 backend schema and endpoints are already installed; local tests do not establish the deployed backend state. Do not apply any SQL or deploy during this development task.

## Validation and rollout

From the repository on Node 24:

```sh
npm ci
npm run check
node scripts/audit-biology.mjs
node scripts/audit-ocr-alevel-paper2.mjs
git diff --check
```

Tests cover saved component/course identity, profile save/reopen and Custom, full/short totals, all fifteen MCQ keys/options, Paper 2 boundaries, resources, actual bundled generation/repair/publication/marking handlers with synthetic providers/databases, interactive compatibility, release/mastery caps and screen/PDF labels. The 44 preceding plan/definition/generation-prompt fingerprints were captured before editing and remain unchanged; existing older baseline files are not rewritten. The offline registry now has 46 combinations.

The completed run on Node 24.19.0 installed from the unchanged lockfile with `npm ci --cache /workspace/.npm-cache`. `npm run check` passed: **1,088 tests in 75 files, zero failures**, TypeScript, critical hook lint, Edge identifier checks, all 38 Edge bundles and the production build. Both template audits and `git diff --check` passed. Non-blocking existing warnings include deprecated transitive packages, stale Browserslist data, an ambiguous Tailwind duration class, test DOM-nesting warnings and large production chunks.

Settings-only Chromium validation uses the real profile modal with intercepted preferences and a browser-memory save callback. It exercises Paper 1/Paper 2 selection, H420/02 full/short save/reopen, marks/time/Section A, no tier controls, and unchanged existing H420/01 profiles. The final browser run had no JavaScript, console or certificate errors and made no backend requests. Chromium used the system-trusted managed CA and an explicit loopback permission for Vite HMR, with normal TLS validation enabled. It does not log in or persist to a backend. PDF checks use the application's actual jsPDF output and preserve private-answer exclusion; they do not certify real browser downloads or all figure pagination.

After merge, these eight Edge Functions need deployment with their shared imports (derived from esbuild dependency metadata): `upload-exam`, `save-exam-format`, `extract-exam-questions`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `submit-exam`, `grade-practice-question`. No deployment or website publication is performed here.

After deployment, separately verify backend schema/version and ownership/release behavior, then deliberately generate a fresh short and full paper to assess actual scientific accuracy, distractors, resources, syllabus balance, repair/cost behavior, marking and browser PDF output. No paid generation was run during implementation. The founder's Gemini rating remains an **external audit**; tests and template totals are not a 10/10 claim or exam-board certification.

## Changed files

New implementation and audit files:

- `supabase/functions/_shared/ocr-alevel-biology-paper2-contract.ts`
- `supabase/functions/_shared/ocr-alevel-biology-paper2-scope.ts`
- `scripts/audit-ocr-alevel-paper2.mjs`
- `docs/ocr-alevel-biology-paper2.md`

Updated implementation files:

- `src/components/exams/BiologyPaperSelector.tsx`
- `src/components/stats/ExamProfileModal.tsx`
- `src/lib/biology-paper-display.ts`
- `supabase/functions/_shared/biology-course-packs.ts`
- `supabase/functions/_shared/biology-marking.ts`
- `supabase/functions/_shared/biology-plan-validator.ts`
- `supabase/functions/_shared/biology-practice.ts`
- `supabase/functions/_shared/course-selection.ts`
- `supabase/functions/_shared/gcse-biology-scope.ts`
- `supabase/functions/grade-practice-question/index.ts`

New tests and fixtures:

- `src/test/ocr-alevel-paper2-profile.test.tsx`
- `supabase/tests/ocr-alevel-paper2.test.ts`
- `supabase/tests/ocr-alevel-paper2-pipeline.test.ts`
- `supabase/tests/ocr-alevel-paper2-marking.test.ts`
- `supabase/tests/ocr-alevel-paper2-fixtures.ts`
- `supabase/tests/fixtures/biology-pre-ocr-paper2-baseline.json`

Updated tests:

- `src/test/ocr-alevel-profile.test.tsx`
- `supabase/tests/biology-paper-audit.test.ts`
- `supabase/tests/ocr-alevel-biology.test.ts`
- `supabase/tests/response-formats-handlers.test.ts`
