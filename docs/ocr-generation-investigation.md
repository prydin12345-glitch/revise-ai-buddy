# OCR generation investigation — 17 September 2026

Audited GitHub revision: `9a6755d2bb5a00beadfb5c3163c6ffef2e26ba4b` (Fixed GCSE OCR rejections). Compared with the delivered OCR implementation at `13db99b96939ad08690c4fe654283b48314b51bc`. The corrective patch is based on the latest revision, preserving Lovable's fixes.

## Finding

The repeated failures exposed inconsistencies between model-output parsing, repair acceptance and validation. A provider request completing successfully did not mean the returned repair was accepted or saved. Some valid content was discarded or rejected before it reached the final gate; genuinely out-of-scope content was also correctly blocked.

The original 200-test suite did not exercise these realistic OCR repair paths sufficiently. Bundling the functions was also not a check for unimported identifiers. Those are gaps in the original bundle's verification. No claim of live OCR readiness should be based solely on the old test count.

## What was confirmed

| Area | Evidence in the audited code | Correction |
| --- | --- | --- |
| Initial answer extraction | The draft mapper read only `q.correct_answer`. It ignored `expected_answer` and a separate `mark_scheme`, even though repair accepted some of those aliases. | Normalise OCR provider output before transformations and storage; preserve the answer and its separate rubric. Empty aliases no longer mask a populated field. |
| Task repair aliases | `readRepairTask` accepted `instruction`, `command` and other aliases. `normalizeRepairPart` then rebuilt the stem from `task` only, so the same valid response could be rejected as `missing_answer`. | Generation and repair now share task reading and text assembly; the accepted task is passed into repair normalisation. |
| Structured level schemes | The latest flattener chose a level's descriptor and could drop its mark range and indicative content. A response with both a model answer and a separate rubric also lost the rubric. | Preserve all level fields and combine the private answer with its rubric. Level labels with ranges retain the correct level number. |
| MCQ choices | Lovable repaired the original loss of choices when a rewrite omitted them. Remaining parsing could remove blank choices and shift letter answers; conflicting aliases were selected without checking consistency. | Preserve positions, recognise supported labelled formats, align explicit letter labels and keys, and reject blanks, duplicates or conflicting versions. Existing choices survive an appropriate repair. |
| Contradictory repair prompt | A task-only prompt forbade options while another line and the OCR per-part instructions demanded them. The full-rewrite example showed `options: null` even for an MCQ. | Task-only repairs use the original choices; full MCQ rewrites request four choices and show a matching JSON example. |
| Question 19(a) | The adverb-led task reported by the user is valid. Lovable's latest adverb fix was present. The private Calvin-cycle content still correctly triggered the scope gate. | Keep that fix, recognise short adverb chains, and make the permitted GCSE two-stage account explicit in both question and key instructions. The scope gate still blocks the advanced content. |
| Question 24(b) | This planned six-mark part needs a level scheme, not only a model answer. Format handling and answer/rubric selection could lose a supplied scheme. | Normalise structured schemes in generation and repair, preserve content, and require a nonempty descriptor for each of the three levels. This checks structure, not scientific validity. |
| Checks | `npm run typecheck` covers the frontend; the previous Edge Function check only ran esbuild. esbuild can bundle a reference to an undeclared helper. | Add an unresolved-identifier check across all functions and shared modules, with declared Deno runtime globals. A test proves an unimported `assembleQuestionText` is caught. This is an offline identifier gate, not full Deno type checking of remote imports. |
| Manual topics | Applying a guided preset overwrote `selectedTopics`; returning to Custom retained those replacement topics. | Guided topics are derived from the plan without overwriting the editor's manual selection. A new guided profile also saves without requiring a hidden manual topic selection. |
| Course labels | The course select repeated full board/course names and codes. | Show Gateway Biology A and Twenty First Century Biology B, with codes beneath. Unimplemented components remain unavailable. |

The reported missing `assembleQuestionText` import could not be attributed to the delivered revision: the import is present in both the original OCR implementation and the latest GitHub revision. No unresolved identifiers were found in the latest functions by the new check. A stale or intermediate deployed function is a possibility, not a confirmed cause. Establishing that exact historical incident would require its deployed revision and runtime logs.

OCR explicitly includes a two-stage photosynthesis account in J247 B1.4b. It should not be removed merely because AQA uses different scope rules. See [OCR J247 specification, version 4.0, B1.4b](https://www.ocr.org.uk/Images/234594-specification-accredited-gcse-gateway-science-suite-biology-a-j247.pdf). The implementation supplies a simple GCSE account and continues to block the advanced pathway content identified in the error.

## Reproduction and verification

New tests call the actual bundled extraction function with provider-shaped responses and a simulated database. They are not fresh paid Gemini generations and do not reproduce the unseen original provider responses byte for byte.

- Before correction, responses using answer aliases plus a separate scheme failed the answerability gate. Repairs using a recognised `instruction` alias also failed in the subsequent normaliser.
- With the patch, both Foundation and Higher tests start with the reported photosynthesis and six-mark defects, make two accepted repair calls, save the corrected rows, pass the final gate and finalise all 41 questions / 90 marks through the real `publish-exam` handler against the simulated database.
- A well-formed paper using supported answer/choice aliases and a separate structured rubric completes with one generation call and no repair calls in the fixture.
- A task-only MCQ repair preserves all four choices. A failed database save stops completion.
- A provider that continues returning Calvin-cycle content is still rejected after the existing three attempts for that group. No answerability gate or quota limit was removed.
- Tests also cover conflicting choices, blank options, scientific names such as E. coli, missing parts, changed resources, adverb-led commands and preservation of level descriptors, ranges and indicative content.
- Profile tests cover switching from a guided preset back to original custom topics, saving an initially empty guided profile, tier selection and existing OCR counts.

`npm run check` passed on Node 24: frontend type checking, hook checks, **231 tests across 21 files**, the new backend identifier check, all **36 function bundles**, and the production build. Existing AQA, answerability, access, quota and generation-context tests remain in the suite.

Not verified here: actual Lovable deployment state, live database writes, a fresh real model paper, live marking, or a browser/PDF audit. Those require the development-preview follow-up. This work makes no claim of a Gemini quality rating.

## Install and preview follow-up

This is an incremental repair on top of the installed OCR batch. Install the new repair bundle, preserving any edits newer than the audited commit. Do not reapply the old 41-file ZIP over Lovable's fixes.

No database migration, generated-type edit, package update or historical-grade change is needed. The site must remain unpublished. No external changes were made by this investigation.

Six Edge Functions depend on the changed shared modules and must be redeployed together:

`extract-exam-questions`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `submit-exam`, `grade-practice-question`.

Deploying the function named `publish-exam` does not publish the website; it finalises individual generated papers. The other two functions in the original eight-function batch, `upload-exam` and `save-exam-format`, have no changed dependency in this patch.

After checks and deployments, confirm Foundation/Higher save and reload correctly. Generate one fresh short Foundation paper first. Once it succeeds, generate one full Foundation paper so Q19(a), Q24(b) and all 15 MCQs are exercised; then repeat at Higher. Save the full generated paper and its private scheme for the owner's external quality audit. Do not display private keys in the student flow.

If an attempt fails, stop repeated paid retries and capture: exam ID, tier/mode, deployed revision, generation/repair call counts, affected question numbers, the exact rejection phase and diagnostics, and relevant model response fields with user data and credentials removed. This evidence distinguishes provider content defects from parser, save or deployment failures.
