# OCR A-level Biology A Paper 3: Unified biology

## Starting point and boundaries

Implementation starts from fetched `origin/main` commit `2ee58678eb0f9d70082a5cb7b97a0429e9991330`, with a clean working tree and the completed H420/02 v1/v2 contracts, profile and pipeline tests present. Branch: `codex/ocr-alevel-biology-paper-3`.

Before editing, Node 24.19.0 and the existing lockfile installed successfully with `npm ci`. `npm run check` passed 1,271 tests in 86 files, TypeScript, critical hook lint, Edge identifier checks, all 38 function bundles and the production build. The offline Biology inventory contained 48 templates.

A new provenance fixture, `supabase/tests/fixtures/biology-pre-ocr-paper3-baseline.json`, records all 48 existing plan, definition and generation-prompt fingerprints captured **before** implementation. Existing fingerprint fixtures, contracts and prompts are not rewritten. H420/02 v1 and externally reviewed v2 remain frozen. No H422, AS H020, tier controls or Gemini ratings are enabled. No dependencies, lockfiles, migrations, generated database types, secrets or historical grades change.

## Official research

Only OCR sources were used. All were downloaded and inspected on 6 October 2026. Page references below are **PDF page numbers**, including front matter. These are independently verified facts and conventions, not copied questions, passages, measurements or diagrams.

| Official source | Evidence inspected | Facts/conventions used |
| --- | --- | --- |
| [H420 specification, v4.1, April 2026](https://www.ocr.org.uk/Images/687834-download-a-level-specification.pdf) | Qualification overview p11; section 3a p58; section 3b p59; written practical skills pp12–14; mathematical appendix 5d | H420/03 is **Unified biology**, untiered, **70 marks**, **90 minutes**, **26%** of the qualification; Modules **1–6**; all questions compulsory; structured/problem-solving/calculation/practical and extended responses. Unlike Components 01/02, there is no prescribed Section A/B MCQ split. The practical endorsement is separate. |
| Same specification | Section 3b p59; appendix 5d, including p78 | H420/03 AO1/AO2/AO3 ranges are 5–6% / 10–11% / 9–10% **of the whole qualification**, not percentages within this paper. The minimum 10% Level 2-or-higher mathematical assessment is qualification-wide, not a fixed Paper 3 allocation. Appropriate graphing, data processing and statistical techniques form part of written practical assessment. |
| [H420/03 sample assessment materials, v3.0, February 2026](https://www.ocr.org.uk/Images/171739-unit-h420-03-unified-biology-sample-assessment-materials.pdf) | Version information pp1–2 and marking cover p27; question-paper front p3; LoR instructions p31 | 90-minute compulsory written assessment; working supports method credit; task-linked supplied resources and extended responses. Science/content selects the best-fit level; communication selects the mark within that level. |
| [June 2024 H420/03 question paper](https://www.ocr.org.uk/Images/726692-question-paper-unified-biology.pdf) | Front p1; statistical/formula resources and tasks; graph plotting p18 | Confirms 70 marks/90 minutes/all compulsory. Supplies evidence and statistical decision information where needed; asks students to produce/interpret graphical responses, calculate and explain. No fifteen-MCQ opening section. |
| [June 2024 H420/03 mark scheme](https://www.ocr.org.uk/Images/726819-mark-scheme-unified-biology.pdf) | LoR instructions p5; numbered marking rows throughout | Six parent questions in this sitting. Task-specific capped points, calculation/method credit and six-mark levels 1–2 / 3–4 / 5–6. Parent count is evidence about this sitting, not an official fixed template. |
| [June 2024 H420/03 examiner report](https://www.ocr.org.uk/Images/726425-examiners-report-unified-biology.pdf) | Assessment overview pp4–5; graph/calculation/practical commentary | Whole-course application in familiar/unfamiliar contexts; interpret supplied evidence; evaluate investigations; show quantitative reasoning accurately. These inform prompt emphasis, not copied scenarios or model answers. |
| [June 2025 H420/03 question paper](https://www.ocr.org.uk/Images/752366-question-paper-unified-biology.pdf) | Front p1; structured tasks/resources throughout | Confirms the same compulsory 70-mark/90-minute component. Uses evidence-linked structured and extended tasks, calculations and graph interpretation rather than a Paper 1/2 MCQ section. No claim that every sitting has the same graph/statistical quota. |
| [June 2025 H420/03 mark scheme](https://www.ocr.org.uk/Images/752493-mark-scheme-unified-biology.pdf) | LoR instructions p5; numbered marking rows; extended schemes pp15/22 | Seven parent questions, compared with six in 2024. Task-specific point/method schemes and science/communication levels. Two six-mark slots in Examly are a design choice informed by these materials, not a specification mandate. |
| [June 2025 H420/03 examiner report](https://www.ocr.org.uk/Images/752104-examiners-report-unified-biology.pdf) | Assessment overview p5; evidence conclusions, experimental-method and graph/rate commentary | Synoptic links, justified conclusions from supplied evidence, practical evaluation and precision of calculations/units matter. Surface recall alone does not reproduce the component's demand. |

OCR's [official assessment listing](https://www.ocr.org.uk/qualifications/as-and-a-level/biology-a-h020-h420-from-2015/assessment/) was used to identify the current public documents. No secondary exam-board summaries were used.

## Official requirements versus Examly template choices

The immutable **v1** H420/03 contract is built and validated before a model request. Custom has no generated guided plan and retains manual topics, counts, format, resources and time, with its explicitly saved component identity.

| Mode | Marks | Minutes | Parent groups / scored parts | Structure |
| --- | --- | --- | --- | --- |
| Full mock | **70 (official)** | **90 (official)** | **6 / 24 (Examly)** | Six coherent investigations, four scored parts each; no A/B split or forced MCQs; two six-mark extended responses (Examly). |
| Short practice | **20 (Examly)** | **26 (Examly)** | **2 / 6 (Examly)** | Two linked investigations spanning all six modules; one six-mark response. Clearly labelled **Examly development template**. Time rounds 20 × 90 / 70 to 26 minutes. |
| Custom | User's saved choices | User's saved choice | User's saved choices | Explicit H420/03 selection; no automatic replacement with either guided template. |

Each full-mock parent connects at least two **content** modules, plus Module 1 practical skills. These are cross-module investigations, not six isolated module blocks:

1. Respiratory enzymes, microbial decomposition and environmental temperature (Modules 2/5/6).
2. Plant water transport, photosynthesis and competition under water stress (3/5/6).
3. Inherited protein variation, infection resistance and population evidence (2/4/6).
4. Biotechnology enzymes and metabolic regulation (2/5/6).
5. Gas exchange, circulation, infection and immunity (2/3/4).
6. Sampling, selection and ecosystem responses to environmental change (4/5/6).

Every parent has application/evaluation demand. Prompts require at least one causal cross-module link with matching private credit; small subparts need not all be synoptic. The full template has AO targets **15/29/26**. Dividing by the qualification's 270 written marks puts them within OCR's component ranges. Annotated full-template mathematical/practical targets are **18/16 marks**; short targets are **4/6**. These are planning targets, **not proof of generated cognitive demand or mathematical compliance**.

Full mock plans seven table-bearing parts and two supplied graph-bearing parts; short practice plans two tables. One table supports student plotting; another supports statistical calculation. Shared observations are repeated identically only on dependent siblings, once per part, so switching question tabs cannot hide required data. Chosen resource quotas are Examly decisions.

## Generation, resources and responses

The new adapter reuses bounded whole-parent batches, truncation splitting, the shared AI-call/time budget, repair limits, answerability checks and atomic finalisation. No existing validator is weakened. Separate `context` and `task` are required by prompts; context-only scored rows still fail the shared assessed-task detector. OCR command words, sufficient unfamiliar-context givens and private method/alternative/cap schemes are explicit drafting requirements.

H420/03-only checks supplement shared gates:

- Retain each planned topic, marks, number, response demand and required resource.
- Shared headers, observations, units and captions must agree across dependent parts.
- Plotting supplies at least three distinct numerical x observations and two complete numerical columns. Blank measurements are rejected, not coerced to zero. A supplied completed graph cannot replace the unsolved table.
- The planned statistical calculation is a **fixed-model chi-squared goodness-of-fit** task: 2–11 categories, observed integer counts, expected counts at least five, matching totals, visible formula/O/E definitions/null hypothesis, 5% significance, categories-minus-one degrees of freedom and matching critical value. No fitted parameters are assumed. The private `Final statistic:` is checked numerically against the data, allowing normal rounding. Test-selection tasks elsewhere can use appropriate H420 tests; the calculation slot choice is not an OCR requirement.
- Reject private answers, solutions, marking fields or completed plotting answers in public resources/options; reject unplanned decorative resources on self-contained parts. Shared gates still reject malformed rows, unsuitable graph types, duplicate/conflicting resources, missing instructions and leaked biological answers.

The new frontend plotting helper derives a **blank** existing plotting canvas from protected H420/03 identity and public table values. It sends no expected points, curve, private answer or mark scheme to the browser. Existing graph response serialization, debounce, draft restoration and submission are reused. The initial axes/scale come from the public givens; tasks assess plotting/representation, not unsupported editable axis-label controls. Server marking receives the saved private point scheme, resource and student's existing graph-response coordinates/paths. Live plotting/marking quality still needs verification after deployment.

Existing choice/grid/cloze/field contracts remain available only for suitable short tasks. Extended prose and plotting are not converted. Calculations/reasoning require written rubric fields when converted; final-number-only recognition cannot replace method credit. Response keys stay private and structured results commit atomically.

## Profiles, snapshots, practice, marking and display

- The OCR A-level selector exposes explicit Papers 1, 2 and 3; H422 remains disabled. Paper 3 saves in the existing `paper_blueprint` JSON with component/version/specification identity. All six module topic names appear in guided profile settings. No tier selector is introduced.
- The existing owned-profile resolver authors protected v2 generation snapshots. Conflicting browser board/tier/paper metadata cannot override them. Retry plans use the original saved contract, despite later profile edits. Custom retains its saved course selection.
- When enabled, the guided Paper 3 exam timer uses the frozen contract's 90/26-minute duration, ignoring conflicting browser timing. The existing timer toggle, Custom's manual duration and all other papers' timer behaviour remain unchanged. No active timer, resume or submission rules are rewritten.
- Ordinary practice retains requested quiz topics/counts/format, including legitimate requested MCQs. It does not force a full mock or its layout. Its `paper-3` cache identity is separate from Paper 1 and both Paper 2 versions.
- Marking uses H420/03 whole-course scope, private task-specific points/method credit and OCR six-mark levels. Failed/malformed/over-cap marks remain ungraded. A Paper-3-only practice grade guard validates bounds before persistence; other papers' marking behaviour is unchanged.
- Exam submission sends one capped result per scored part through the existing atomic result/mastery transaction. Ownership, assigned-exam release controls and quotas remain unchanged. Software tests intercept every provider/database call; they do not spend credits or alter real records.
- Exam-taking, practice, preview/review and PDF use saved H420/03 labels. No A/B section headings appear. PDF layout code is unchanged apart from component-label routing, including explicitly saved Custom identity. Public PDFs do not print private keys.

## Verification

Baseline: **1,271 tests / 86 files; 48 templates**. Final: **1,342 tests / 90 files, zero failed; 50 templates**. Node 24.19.0, `npm ci`, TypeScript, critical hook lint, Edge identifiers, all 38 function bundles, the production build, both offline audits and `git diff --check` pass. Required commands:

```sh
npm ci
npm run check
node scripts/audit-biology.mjs
node scripts/audit-ocr-alevel-paper3.mjs
git diff --check
```

The inventory now contains **50 templates**. All 48 pre-existing plan/definition/prompt fingerprints match; prior fingerprint files are unchanged. The targeted offline audit validates structure, all-module/cross-module planning, totals, response/resource slots and skill targets. It makes no AI call and does not certify science or award an external rating.

Focused tests cover explicit identity and untiered semantics, full/short planning, Custom and saved profile reopening, frozen server routing/retries, task/resource/statistical failures, bounded generation/truncation/repair, interactive private rubric separation, cache/quiz isolation, actual marking-handler failures/caps/release/ownership, mastery transaction inputs, screen labels, blank plotting response serialization and PDF non-disclosure.

Settings-only Chromium checks use the **real profile modal**, local in-memory fixtures and Vite, with backend requests blocked. They verify three enabled paper choices, Paper 3 save/reopen, 70 marks/90 minutes, 20 marks/26 minutes and Examly short-template labelling, no tier buttons, and unchanged H420/01 v1 / H420/02 v1/v2 reopening. Screenshots were inspected at **390, 768, 1024 and 1440 px**. Google Fonts load with normal TLS verification using the existing trusted browser profile; no console, JavaScript, certificate or failed-request errors occurred. No account login, real saved-profile write, paid generation or deployment was performed. Browser emulation is not real iOS/iPadOS hardware testing.

Existing non-blocking warnings: deprecated packages reported by `npm ci`, stale Browserslist data, large production chunks, and expected diagnostic output from negative test fixtures. These are not bypassed and dependencies are not changed for this task.

## Deployment after merge (operator action, not performed here)

No migration is required. Static bundle dependency analysis identifies exactly these affected Edge Functions:

- `upload-exam`
- `save-exam-format`
- `save-exam-timer`
- `extract-exam-questions`
- `publish-exam`
- `generate-practice-questions`
- `get-practice-questions`
- `grade-practice-question`
- `submit-exam`

After reviewing and merging, ask the operator/Lovable to deploy **these nine functions from the merged main commit**, preserving existing authentication settings. A frontend publish alone does not update shared server contracts. Do not run SQL, migrations, paid generation or website publication as part of that function deployment request.

The first real generated assessment still needs end-to-end checks of scientific correctness, genuine linked-module reasoning, exact mathematical/practical demand, private scheme agreement, statistical conclusions, plotted responses/marking, all rendered resources, timing, student review and full PDF pagination. External Gemini scoring remains the user's independent post-deployment quality audit. Automated tests are not proof of a 10/10 assessment.

Use **Squash and merge** for this focused feature PR after review. Keep the PR a draft until that review; no merge or deployment is performed by this implementation task.

## Changed files

New: Paper 3 scope/contract/resource validation modules; blank public plotting helper; saved component label; Paper 3 fixture, contract/pipeline/marking/profile tests; additive 48-template provenance fixture; offline Paper 3 audit; this documentation.

Updated: shared Biology registry, saved course selection, scope dispatch, practice/cache and marking adapters; Paper 3 practice grade validation and frozen guided timing; profile selector/summary and topic preview; exam/practice/review label routing and exam plotting response selection; PDF label routing. Existing tests update unavailable-Paper-3 and inventory assertions, and add one structured-practice regression proving that its separately stored private key works with an intentionally empty legacy answer key. Existing plans, outcome pools and fingerprint baselines remain unchanged.

Exact file inventory (new or modified):

```text
docs/ocr-alevel-biology-paper3.md
scripts/audit-ocr-alevel-paper3.mjs
src/components/exams/BiologyPaperSelector.tsx
src/components/exams/OcrUnifiedPaperLabel.tsx
src/components/stats/ExamProfileModal.tsx
src/lib/biology-paper-display.ts
src/lib/exam-pdf-generator.ts
src/lib/ocr-unified-plotting.ts
src/pages/ExamInProgress.tsx
src/pages/ExamPreview.tsx
src/pages/ExamReview.tsx
src/pages/TakePracticeQuiz.tsx
src/test/ocr-alevel-paper2-profile.test.tsx
src/test/ocr-alevel-paper3-profile.test.tsx
src/test/ocr-alevel-profile.test.tsx
supabase/functions/_shared/biology-course-packs.ts
supabase/functions/_shared/biology-marking.ts
supabase/functions/_shared/biology-plan-validator.ts
supabase/functions/_shared/biology-practice.ts
supabase/functions/_shared/course-selection.ts
supabase/functions/_shared/gcse-biology-scope.ts
supabase/functions/_shared/ocr-alevel-biology-paper3-contract.ts
supabase/functions/_shared/ocr-alevel-biology-paper3-scope.ts
supabase/functions/_shared/ocr-alevel-biology-paper3-validation.ts
supabase/functions/grade-practice-question/index.ts
supabase/functions/save-exam-timer/index.ts
supabase/tests/biology-paper-audit.test.ts
supabase/tests/fixtures/biology-pre-ocr-paper3-baseline.json
supabase/tests/ocr-alevel-biology.test.ts
supabase/tests/ocr-alevel-paper2-v2.test.ts
supabase/tests/ocr-alevel-paper2.test.ts
supabase/tests/ocr-alevel-paper3-fixtures.ts
supabase/tests/ocr-alevel-paper3-marking.test.ts
supabase/tests/ocr-alevel-paper3-pipeline.test.ts
supabase/tests/ocr-alevel-paper3.test.ts
supabase/tests/response-formats-handlers.test.ts
```
