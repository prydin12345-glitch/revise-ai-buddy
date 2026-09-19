# Biology framework — first implementation

Based on `dddad582901890adaae39395500d9225e6a5595e` (the restored OCR test file). This batch extracts the existing AQA and OCR paper definitions into registered adapters and adds an offline audit command. The website remains in development.

**Paper 2 update, 19 September 2026:** AQA GCSE Biology Paper 2 is now implemented through this framework for Foundation and Higher. See [the Paper 2 notes](aqa-biology-paper-2.md) for selection, scope, tests and the current eight-function deployment list. The sections below record the original B1 extraction; its eight baselines remain unchanged. The inventory now contains twelve combinations.

## What now shares an interface

`biology-course-packs.ts` registers each supported course/paper/version with its tier choices, specification sources, official assessment constraints, Examly layout choices, template builder, prompt contribution, repair instructions and validation policy. `biology-paper-contract.ts` retains the old import paths and delegates to those adapters. The frontend profile preview and protected backend snapshot therefore build the same plans.

The extraction handler selects the generation strategy from the registered adapter. The repair path and answerability boundary select paper checks through the same registration. Topic/level rules remain in their existing scope modules. The model normaliser, resource renderer, repair call limits, ownership checks and quota protections are retained.

This is an incremental extraction, not a completed universal curriculum framework. AQA v1 retains its existing prompt augmentation, totals checks and reconciliation path; OCR v1 retains its contract-only generation and exact-part validation. The registry names that distinction explicitly. Migrating AQA to stricter per-part validation should be a separate, measured change with saved reference papers. Practice generation, marking prompts and course-selector details still have some course-specific routing; adding a registration alone does not complete support for a new course.

## Registered paper coverage

| Course | Paper | Tiers | Modes |
| --- | --- | --- | --- |
| AQA separate Biology 8461 | Paper 1 | Foundation, Higher | Short practice, full mock |
| OCR Gateway Biology A J247 | First paper: J247/01 or J247/03 | Foundation, Higher | Short practice, full mock |

J247/02, J247/04, J257, AQA Paper 2, new boards, A-level and university courses are not enabled by this batch. Unknown paper or version identifiers do not fall back to an unrelated supported paper. Existing AQA course-id aliases remain supported. Subject display names still do not select a tier. Custom mode remains outside guided templates.

## Specification sources and template choices

- [AQA 8461 specification at a glance, section 2.2](https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/specification-at-a-glance), checked 18 September 2026: Paper 1 covers content areas 1–4, at either tier, with 100 marks and 105 minutes. The four 25-mark groups and particular 32-part arrangement are Examly's version-1 design, not a prescribed AQA question count.
- [OCR J247 specification v4.0 (August 2026), sections 2a and 3a](https://www.ocr.org.uk/Images/234594-specification-accredited-gcse-gateway-science-suite-biology-a-j247.pdf), checked 18 September 2026: first-paper components J247/01 and J247/03 assess B1–B3 with B7 practical skills, with 90 marks and 105 minutes; Section A is 15 marks and Section B is 75. Examly's particular Section B groups are its own template.

The source metadata covers these structural facts. It is not a new claim that every learning outcome, mathematical allocation, mark scheme or generated question has been reviewed. In particular, AQA mathematical/practical marks are not annotated in its existing plan. The audit reports those values as unknown rather than claiming zero or compliance.

## Regression evidence

`supabase/tests/fixtures/biology-v1-baseline.json` contains SHA-256 fingerprints captured from the audited base before the extraction. For all eight course/tier/mode combinations, tests compare the entire plan JSON, paper-definition JSON and contract prompt contribution with that baseline. These are code baselines, not the user's original generated papers; no originals were available here.

Additional tests cover profile-to-snapshot routing, AQA aliases, explicit paper/version rejection, invalid template totals/resources/identities, course-specific scope, saved-draft audits and CLI failure exit codes. Existing Foundation repairs, OCR real-handler fixture scenarios, profile settings, access and quota tests remain applicable. The existing code's official exam counts and the external Gemini rating are not interchangeable.

Do not update v1 hashes simply to silence a failure. Determine whether the difference is a regression. An intended question-plan change needs a separately versioned contract, migration/compatibility consideration for stored attempts, and new paper review.

## Offline audit command

From the project directory:

```sh
node scripts/audit-biology.mjs
node scripts/audit-biology.mjs --json
```

This checks all registered templates and reports their actual totals, counts and resource mix. It makes no AI calls, queries no database and gives no quality rating. A successful template audit does not mean a real paper has been generated.

To audit already-saved canonical draft rows locally, use an envelope with these fields:

```json
{
  "courseId": "ocr_gcse_biology_a_j247",
  "paperId": "first_paper",
  "contractVersion": 1,
  "tier": "foundation",
  "mode": "full_mock",
  "questions": []
}
```

Replace the empty array with the actual draft rows, including question text, marks, options, private `correct_answer` and resource payloads. An empty or incomplete paper is expected to fail. Keep actual paper exports outside the public repository. An array of envelopes audits several attempts in one invocation.

```sh
node scripts/audit-biology.mjs --input /path/to/private-draft-audit.json --json
```

Blocked drafts or invalid input give exit code 1. Passing drafts are labelled `automated_checks_passed_review_required`; the command does not publish them. Reports omit the raw rows and private answer keys. The audit expects stored canonical rows, not arbitrary model-response envelopes or a PDF.

## How the next Biology paper gets added

1. Choose one specific course and component; establish official content, tiers and assessment constraints using its specification and sample papers.
2. Add the versioned definition and builder, plus exact scope and marking requirements. Register it alongside the current adapters. Keep Examly template choices separate from board requirements.
3. Wire explicit course/paper selection, protected snapshots, practice/cache and marking behaviour where required. A catalogue entry is not sufficient evidence of support. Keep unsupported selections unavailable until their paths are complete.
4. Run template checks, existing regression tests, and simulated provider responses through the actual handlers. Cover both tiers and repair rejection/saving, not only ideal responses.
5. Generate fresh preview papers deliberately. Start the proposed review batch with three per tier, retaining the snapshot, model/prompt versions, canonical questions, private scheme, rendered paper, defects, actual usage cost and the external review. No automatic paid batch is introduced here.
6. Review scientific accuracy, the match between resources and keys, tier demand and rendered output. The user's external Gemini audit remains separate; a qualified tutor can review meaning and marking. Turn concrete repeatable defects into regressions before extending coverage.

## Installing this batch

Use the provided numbered text files and routing guide, or let Lovable apply the included patch. Install all files before checking: the shorter compatibility modules depend on the new files. If the remote has changed after the audited base, merge the patch with the newer edits rather than replacing full files blindly.

Run `npm run check` and the offline audit. Dependencies, lockfile, generated Supabase types, migrations and stored grades are untouched. Redeploy these six functions because their import trees include the changed modules:

- `extract-exam-questions`
- `generate-practice-questions`
- `get-practice-questions`
- `publish-exam`
- `save-exam-format`
- `upload-exam`

This list differs from the previous OCR repair because this batch changes the paper/snapshot routing modules. No marking function redeployment is required by this patch's dependency graph. `publish-exam` finalises individual exams; it does not publish the website.

After deployment, verify the existing AQA and Gateway profile settings in the preview. Fresh AI generation and scientific quality are not established by local tests. Keep the website unpublished.
