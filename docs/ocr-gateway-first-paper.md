# OCR Gateway Biology: first-paper development batch

Based on repository commit `7d9683c78c289ca12ee7bed81813c81775630688` (Fixed Q4(a) task rejection).

This adds OCR Gateway Biology A (J247) first-paper generation. It is development code, not a website publication or an exam-quality certification. No database migration is included. The existing protected generation_context columns and profile paper_blueprint JSON are required.

| Course | Tier | Component | Full paper |
| --- | --- | --- | --- |
| Gateway Biology A J247 | Foundation | Paper 1, J247/01 | 90 marks, 105 minutes |
| Gateway Biology A J247 | Higher | Paper 3, J247/03 | 90 marks, 105 minutes |

Both cover B1 Cell level systems, B2 Scaling up and B3 Organism level systems, with B7 practical skills. Full papers have Section A (15 MCQ marks) and Section B (75 marks). These facts were checked against [OCR's specification, version 4.0, August 2026](https://www.ocr.org.uk/Images/234594-specification-accredited-gcse-gateway-science-suite-biology-a-j247.pdf) and the [Foundation](https://www.ocr.org.uk/Images/234576-unit-j247-01-biology-foundation-tier-paper-1-sample-assessment-material.pdf) and [Higher](https://www.ocr.org.uk/Images/234579-unit-j247-03-biology-higher-tier-paper-3-sample-assessment-material.pdf) sample papers.

The 41-part / 24-parent allocation is an Examly template, not an official fixed OCR question count. It targets AO1/AO2/AO3 marks of 36/36/18, with 10 mathematical marks, practical work and one six-mark level response. Maths/practical tagging is a planning target; it does not prove that generated content earns those classifications. The short preset is explicitly 20 marks / 25 minutes / 8 scored parts. Neither template is copied from an official paper.

## Routing and compatibility

- A custom name such as “Biology Higher” is recognised as Biology. It never selects the tier. Board, qualification and the explicitly saved course identify the route.
- OCR Biology requires a choice between Gateway A J247 and Twenty First Century B J257. J257 is shown as coming later and generation is blocked. Gateway second papers J247/02 and /04 are also outside this batch.
- courseSelection and paperContract live in the existing profile paper_blueprint JSON. Server snapshot version 2 freezes course, paper, tier, component and contract version before AI generation. Client metadata cannot replace the saved preset. Old AQA version-1 attempts remain supported. Ambiguous old OCR attempts need a fresh configured profile/attempt.
- Guided settings control counts, topics, time, MCQs and resources. Custom stays a custom assessment and must not be described as a full official-format paper.
- OCR scope rules are separate from AQA. Qualitative water potential, basic ATP and a simple two-stage photosynthesis account are permitted in Gateway; protein synthesis detail is Higher-only. Bold tier-only outcomes were checked visually in the official PDF. The scope module contains paraphrased curriculum facts for prompting, with conservative term checks rather than a complete semantic classifier.
- Both practice generation entrypoints inherit the saved course, paper and tier. Their cache identity includes these and contract/resource revisions. OCR cached questions retain linked order and MCQ answer alignment. Existing quotas are unchanged.
- The full OCR extraction path retains planned numbering, checks exact parts, marks, response types, MCQ choices, resources and level-scheme presence, and blocks mismatches rather than changing marks or deleting surplus questions to force a pass. Missing whole parts require a new draft. Content/resource repairs retain the existing maximum of 3 attempts per group and 8 calls per request.
- Marking uses the stored OCR context and private scheme. Six-mark tasks receive OCR best-fit level instructions, informed by the [2025 Foundation mark scheme](https://www.ocr.org.uk/Images/753483-mark-scheme-paper-1.pdf) and [2025 Higher mark scheme](https://www.ocr.org.uk/Images/753485-mark-scheme-paper-3.pdf).

## Deployment and verification

Deploy these eight functions together after installing the whole batch:

`upload-exam`, `save-exam-format`, `extract-exam-questions`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `submit-exam`, `grade-practice-question`.

Here publish-exam finalises one generated practice paper; it does not publish the website. The site must remain unpublished.

Local validation on Node 24.19.0 (supported by package.json): npm ci, type checking, critical hook checks, the existing regression suite and new OCR tests, all 36 Edge Function bundles, and the production build. New tests exercise real extraction/format/finalisation handlers with synthetic provider responses and fake database clients. Existing database guard/quota tests use in-process Postgres. No real AI calls or live backend writes were made.

The full project check passed. After adding two further real-handler boundary tests, the final complete test run passed all 200 tests across 19 files. Tests do not establish a Gemini quality score. Live profile persistence, real generated papers/quizzes, rendered mobile/desktop/PDF appearance and real marking remain to be checked in the development preview.

## First preview audit

1. Create a separate “OCR Biology” subject with board OCR and qualification GCSE, keeping existing AQA profiles available.
2. Create a profile. Select Gateway Biology A (J247), Foundation, Short practice, then Use these settings. Save and reopen; confirm Foundation and J247/01 persist.
3. Generate a fresh short practice. Check all tasks are complete, tables/graphs match their private keys, no Higher-only knowledge is required, and the paper is labelled 20 marks / 25 minutes.
4. Repeat with Higher: J247/03. Use a new attempt, not a retry of the Foundation attempt.
5. Then audit a full paper at each tier: 90 marks, 105 minutes, Section A 15 marks, Section B 75 marks, no B4–B6 assessed content, all required media present, and a usable six-mark level scheme.
6. Check an OCR profile-based quiz in each tier; changing difficulty must not change tier. Check marking, review and PDF output. Keep actual model-call counts and failures alongside the rating.
7. Recheck one existing AQA profile/attempt. Do not expand to J247's second pair or J257 until first-paper live audits are satisfactory.

Do not treat a single model rating, structural test pass or keyword check as certification of scientific correctness, coverage, mark-scheme viability or examination-board endorsement.
