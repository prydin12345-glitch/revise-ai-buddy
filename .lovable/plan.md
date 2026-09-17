# Install the OCR Gateway Biology batch (41 files)

Yes — I can follow the bundle's instructions exactly. I already compared every file in the ZIP against your current project:

- All 28 files marked REPLACE match the bundle's expected "before" version byte-for-byte, so nothing newer of yours would be overwritten.
- All 13 NEW files are genuinely absent.

So the bundle applies cleanly with no reconciliation needed.

## What this adds

OCR Gateway Biology A (J247), first paper, both tiers:

- Foundation: Paper 1 (J247/01), 90 marks / 105 minutes full mock, 20 marks / 25 minutes short practice.
- Higher: Paper 3 (J247/03), same totals.
- Section A (15 multiple-choice marks) and Section B (75 marks) headings across exam-taking, preview, review, print and PDF.
- Explicit course selector in the profile editor; the tier is never inferred from a subject name. Existing AQA support and the Foundation repair work stay as they are.

## Steps

1. Copy all 41 files from the bundle's `github-files/` tree to their exact project paths (28 replacements, 13 new), taking the native source copies rather than re-pasting the `.txt` versions.
2. Sanity-check each installed file: correct path, no Markdown fences or stray quotes, imports resolve, and verify each file's SHA-256 against `manifest.json`.
3. Run `npm ci` then `npm run check` on Node 22 with the existing lockfile — expected: typecheck, critical lint, 200 tests across 19 files, 36 Edge Function bundles, production build. Fix any genuine integration error; no checks disabled, no lockfile edits, no weakened validation.
4. Deploy the eight backend functions the bundle lists: `upload-exam`, `save-exam-format`, `extract-exam-questions`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `submit-exam`, `grade-practice-question`. (`publish-exam` finalises a paper — it does not publish the site.)
5. Confirm the preview rebuilds and loads without runtime errors. No papers generated, no credits spent, no existing papers or mark schemes touched.
6. Report the installed file list, check results, any corrections made, and which deployments actually succeeded — separating automated checks from anything observed live.

## Not part of this

No database migration, data reset, generated-type edit, new package or lockfile change. The website stays unpublished; visibility and domain untouched. J247/02, J247/04 and Twenty First Century Biology B J257 are not in this batch.

## Technical notes

New shared modules: `course-selection.ts`, `ocr-biology-contract.ts`, `ocr-biology-scope.ts`, `ocr-plan-validator.ts`, `ocr-practice.ts`. New frontend files: `BiologyCourseSelector.tsx`, `PaperSectionHeading.tsx`, `biology-paper-display.ts`. New tests: `supabase/tests/ocr-fixtures.ts`, `ocr-gateway.test.ts`, `ocr-extraction.test.ts`, `src/test/ocr-profile.test.tsx`, plus `docs/ocr-gateway-first-paper.md`.

`src/lib/assessment-tier.ts` and `src/lib/biology-paper-contract.ts` stay as one-line re-exports — the bundle replaces their `supabase/functions/_shared/` implementations instead.

After deployment I'll give you the exact preview test sequence: OCR Biology subject → Gateway Biology A (J247) → Foundation → Short practice, save, reopen, confirm J247/01 / 20 marks / 25 minutes, then you trigger the generation yourself.
