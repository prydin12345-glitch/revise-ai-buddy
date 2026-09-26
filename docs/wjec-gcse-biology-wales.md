# WJEC GCSE separate Biology — Wales (3400QS)

Reviewed 26 September 2026 against WJEC's February 2026 specification, Version 3, and the written-unit sample assessment materials. This adapter is independent of Eduqas, Combined Science, International GCSE and the new Wales Double Award.

## Implemented routes

| Unit | Foundation, English medium | Higher, English medium | Full mock |
| --- | --- | --- | --- |
| 1: Cells, Organ Systems and Ecosystems | 3400U1 | 3400UA | 80 marks / 105 minutes |
| 2: Variation, Homeostasis and Micro-organisms | 3400U2 | 3400UB | 80 marks / 105 minutes |

Each written unit contributes 45% of the qualification. WJEC uses A*–G grades: Foundation C–G and Higher A*–D. The tier is selected for each saved profile, never inferred from a subject name, difficulty setting or account-wide preference. A custom name such as `Biology Higher` is recognised as Biology, but does not choose Higher or a unit.

Full mocks use eight parent groups, 32 parts, four interspersed MCQs, two six-mark QER responses and eight data resources. These counts are Examly's template, not a fixed official WJEC blueprint. Whole-mark AO targets are 32/32/16, with at least eight maths marks and twelve enquiry marks annotated. The annotations cannot certify the cognitive demand or scientific accuracy of a model response.

Short practice samples four unit topics in four groups, 12 parts, 27 marks and 35 minutes, with two MCQs, one QER response and four resources. It is not a complete official paper. Custom mode retains user counts/topics while still requiring the selected unit and tier. A small quiz remains a quiz and inherits the same unit/tier/version boundaries.

## Specification and Unit 3

| Cohort entry | Specification record | Unit 3 | Marks | Tier |
| --- | --- | --- | --- | --- |
| Before September 2026 | wjec-3400-v2-2019-01 | Practical Assessment | 30 | Untiered |
| From September 2026 | wjec-3400-v3-2026-02 | Scientific Enquiry; first award 2028 | 28 | Untiered |

The revised Unit 3 consists of one selected enquiry, with a one-hour practical task (6 marks) and a one-hour written task (22 marks); it contributes 10%. It requires centre-based practical work. The UI therefore identifies Unit 3 but disables ordinary mock generation for it. The adapter does not manufacture NEA evidence or claim to replace that assessment.

`wjec-biology-specification.ts` stores both editions. `wjecUnit3ForCohort` takes an explicit cohort period and returns no edition for an unknown cohort; today's date is never used. No cohort choice is required for the implemented written units because Units 1/2 remain unchanged. A future practical-skills product must explicitly collect the cohort and distinguish practice from the official assessment.

Every new written-unit attempt records `specification_version: wjec-3400-v3-2026-02` in its protected server snapshot. The saved profile/contract also records `specificationVersion`. Template `contractVersion: 1` separately versions Examly's layout. Invalid editions/components are rejected; retries retain their original snapshot even after profile edits. Existing server-only database guards remain in force; no migration is needed for these JSON fields.

## Content and assessment rules

The outcome catalogue contains original summaries of reviewed specification clauses and distinguishes bold Higher-only portions. It is a curated generation pool, not a claim that every clause appears in each paper.

Examples of WJEC-specific Higher content include active transport, ATP comparisons, detailed reflex arcs, capture–recapture, nephron mechanisms, named DNA bases/triplet code and memory-cell detail. Common content includes insulin action, base-letter pairing, monohybrid crosses and natural selection. Other boards' tier rules are not copied. Conservative term checks complement prompts and do not replace a human syllabus review.

Generation uses existing whole-parent batches, truncation completion, shared call/time budgets and accepted-repair persistence. Every part still requires an explicit task and key; resources remain canonical and assessed Punnett-square answers stay hidden. Missing tasks/options/resources or incomplete schemes block finalisation.

QER marking requests three task-specific levels with both science and communication descriptors. Marking uses holistic best fit, including writing quality within the descriptor, not six counted facts or an invented separate spelling penalty. QER notices appear only on the relevant planned tasks, on screen and in the PDF booklet. Private schemes remain private.

## Verification and installation

Run `npm ci`, `npm run check`, and `node scripts/audit-biology.mjs` on Node 22 or 24. The audit should contain 36 combinations: the previous 28 plus eight WJEC unit/tier/mode combinations. Existing AQA, OCR and Edexcel plans, definitions, full prompts and first-group batch prompts must compare identically.

The new tests exercise actual bundled Edge Function code with synthetic model replies and fake database clients: batched generation, truncation, repairs, persistence failure, finalisation gates, quizzes and cache isolation. Unit and jsdom tests cover explicit selection, server ownership, frozen retries, editions, Foundation/Higher scope, profile save/reopen, Custom topic retention and PDF notice/private-key separation. They incur no model charges and do not certify real generated papers.

Deploy the eight affected functions, including their shared modules:

- upload-exam
- save-exam-format
- extract-exam-questions
- publish-exam
- generate-practice-questions
- get-practice-questions
- submit-exam
- grade-practice-question

No database change, dependency/lockfile change, generated-type edit or historical-grade update is required. Updating the function named `publish-exam` only updates individual exam finalisation; it is not website publication.

Lovable must still verify actual preview save/load, deployed functions, desktop/mobile display and a browser-downloaded PDF. After that, the founder should generate short Unit 1 Foundation first, then Higher, repeat for Unit 2, and test all four full mocks and small quizzes. Review scientific content, data consistency, scope and scheme quality before interpreting an external Gemini score.

## Limits and follow-up

English-medium written units only. Welsh-medium generation and official Unit 3 practical assessment are not implemented. Raw scores are not UMS, and neither fixed UMS boundaries nor a generic 9–1 table establish a WJEC qualification grade. Existing account-level Stats projections are a separate legacy feature, not made course-aware by this adapter; a Wales letter-grade/series-specific projection workflow remains separate work. No new grade conversion is introduced here.

## Primary sources

- [Current specification, Version 3 February 2026](https://www.wjec.co.uk/media/m1lm4qb5/wjec-gcse-biology-from-2016-spec.pdf): assessment summary, Units 1/2 and bold clauses, Unit 3, entry codes, grading and mathematical skills.
- [Earlier specification, Version 2 January 2019](https://www.wjec.co.uk/media/aaslc0sm/wjec-gcse-biology-spec-from-2016-e.pdf): earlier 30-mark practical unit.
- [WJEC decision on the September 2026 cohorts](https://www.wjec.co.uk/articles/survey-outcomes-gcse-biology-chemistry-and-physics/): amend Unit 3 only; retain Units 1/2.
- [Written-unit sample assessment materials](https://www.wjec.co.uk/media/4gchi5ze/wjec-gcse-biology-sams-from-2016.pdf): both tiers and QER science/communication descriptors.
