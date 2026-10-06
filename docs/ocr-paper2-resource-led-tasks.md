# OCR H420/02: resource-led question detection

Prepared from fetched main `65cf22f07b03a6c2fe82cc414785af2bfea96513` on 6 October 2026, on `codex/ocr-paper2-resource-questions`.

## Cause and reproduction

The owner's error includes two complete assessed tasks:

- Q4: “Based on the data provided in the table, at which pH is the enzyme activity approximately 75% of its maximum activity?”
- Q8: “Based on the graph, during which period did the orchid population experience the greatest percentage increase?”

The shared task detector can examine the clause after a short introductory phrase, but only recognises a command verb or a bare interrogative opener there. It misses the prepositional question forms `at which … is` and `during which … did`. Generation, task-only repair, full-group repair and finalisation share this detector, so returning the same valid instruction never resolves the false rejection.

Before changing production code, the new tests reproduce both exact `missing_task` repair rejections through the bundled `extract-exam-questions` handler, reaching six rejected repairs across the two groups and eleven simulated model calls. All providers and database writes are intercepted. The tables, graph, options and keys in these tests are original synthetic data; the original saved exam and deployed revision were not read.

## Change

Recognise a direct prepositional `which`/`what` question when a bounded noun phrase is followed by an interrogative auxiliary and further text. Reuse the existing clause, introductory-phrase and conditional handling. Question marks remain optional and never establish answerability alone. Reported relative clauses such as “during which period the orchids were counted”, observations and unfinished interrogatives still fail.

No tasks, tables, graph measurements, choices or private answers are rewritten by the detector. Repair still preserves original sources and requires a valid rewritten private key. Required resources, statement completeness, syllabus/scientific gates, saved paper plans, ownership/release rules, atomic persistence, budgets and repair limits are unchanged. No contract version or fingerprint changes are needed.

## Regression coverage

`supabase/tests/resource-led-task.test.ts` covers the exact two tasks, direct and conditional variants, punctuation-independent recognition, context-only and reported-clause rejection, repair normalization/source preservation, required resources and private keys. Actual bundled generation and finalisation tests cover both saved H420/02 contract versions: fifteen MCQs, 100 marks and unchanged plan ordering. Valid tasks require zero repair calls; context-only Q4/Q8 each recover in one repair. Genuine missing tasks retain the three-attempt per-group limit. Missing planned tables/graphs block finalisation.

Node 24.19.0 verification: unchanged-lockfile `npm ci --cache /workspace/.npm-cache`; `npm run check` with **1,263 tests in 85 files, zero failures**, TypeScript, critical hook lint, Edge identifier checks, all 38 Edge bundles and the production build; `node scripts/audit-biology.mjs` (48 combinations); `node scripts/audit-ocr-alevel-paper2.mjs` (four version/mode combinations); and `git diff --check`. The 33 new regressions pass, alongside 25 existing conditional/detection checks in the targeted run. Browser checks are not repeated because this patch changes backend validation only; no frontend or PDF code changes.

The optional full `npm run lint` retains the baseline **1,968 errors and 133 warnings**, starting at `scripts/edge-runtime-globals.d.ts:5:37` (`@typescript-eslint/no-explicit-any`). Before/after lint comparison of the changed checker finds four existing errors in each version, and the new test file has no findings: zero added findings. Existing non-blocking package deprecation, test DOM-nesting, Browserslist and production chunk-size warnings remain.

## Rollout and limits

Esbuild dependency metadata identifies four functions requiring deployment after merge: `extract-exam-questions`, `generate-practice-questions`, `get-practice-questions` and `publish-exam`. The last function finalises exams; deploying it does not publish the website. This development task does not deploy any function or publish the website.

No migration, dependency/lockfile update, generated-type change, frontend change, real database write or paid generation is required for this fix. A fresh, separately authorised generation after deployment must confirm actual provider behaviour and scientific quality. Tests do not establish an external Gemini rating. Existing failed drafts are not automatically modified or retried.

Recommended merge type: **Squash and merge**, keeping this focused fix as one commit.
