# AQA GCSE Biology 8461 — Paper 2, version 1

Implemented against GitHub base `0a03a0952893c42c3c5278e2293ac2627c829fbb` (Biology Framework B1). This is a development-preview addition, not website publication or exam-board certification.

## Supported selection

Choose AQA, GCSE, Biology, **Paper 2**, and explicitly choose Foundation or Higher in an exam profile. Subject labels such as “Biology Higher” or “Biology Paper 2” are recognised as Biology, but do not select a tier or paper. Existing AQA profiles without a paper selection continue to use the historical Paper 1 default. Changing paper or tier invalidates the applied guided settings until the user accepts the new preview.

The paper selection uses the existing `paper_blueprint` JSON. The backend re-resolves the owned profile and stores the paper, tier, component and contract in the existing protected `generation_context`. Retries reuse that snapshot. Client format metadata cannot change it. Old context-version-1 attempts cannot acquire Paper 2 through client metadata; start a fresh attempt.

| Property | Foundation | Higher |
| --- | --- | --- |
| Component | 8461/2F | 8461/2H |
| Course/paper identity | `aqa_gcse_biology_8461` / `paper_2` | Same |
| Contract version | 1 | 1 |
| Full mock | 100 marks, 105 minutes | 100 marks, 105 minutes |
| Short practice | 20 marks, 21 minutes | 20 marks, 21 minutes |
| Scope | Foundation outcomes in sections 4.5–4.7 | Common and permitted Higher outcomes in sections 4.5–4.7 |

The capability/snapshot course alias `aqa_gcse_biology` and historic contract ID `aqa_gcse_biology_8461` refer to the same qualification. An explicit paper ID is essential when adding future papers.

## Source review and template choices

The three assessed content areas and full-paper timing/marks were checked against [AQA's assessment overview](https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/specification-at-a-glance) on 19 September 2026. Both tiers cover Homeostasis and response; Inheritance, variation and evolution; Ecology.

Outcome references in `aqa-biology-paper2.ts` were checked against AQA's [Homeostasis and response](https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/subject-content/homeostasis-and-response), [Inheritance, variation and evolution](https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/subject-content/inheritance-variation-and-evolution), and [Ecology](https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/subject-content/ecology) sections. These are AQA-specific rules: do not import OCR's tier exclusions. For example, AQA Foundation includes individual FSH/LH roles, auxin tropisms, cloning, the three-base code and biomass efficiency. Higher adds outcomes such as ADH/glucagon feedback and genetic-engineering steps.

The **nine parent groups, 36 scored parts, nine MCQs, four six-mark responses, six tables and two graphs** in the full mock are Examly's template choices. AQA does not require this exact grouping or question count. Short practice uses eight scored parts, two MCQs, two tables and one graph. Its timing is also an Examly choice. No separate resource-insert booklet is required by this template: its tables and graphs appear with their question.

Full-paper parts have planned AO marks of 40/40/20, 18 mathematical marks and 25 practical marks. These annotations direct generation; they do not prove that the generated task deserves that classification. The [AQA assessment objectives](https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/scheme-of-assessment), [mathematical requirements](https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/mathematical-requirements) and [practical assessment](https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/practical-assessment) remain the reference for review. Practical contexts include reaction time, seedlings, ecological sampling and decay. Scientific depth, resources, marking and demand still need review on real output.

## Generation and acceptance

- The registered Paper 2 adapter uses the immutable-plan generation path, including part-specific specification references. Foundation/Higher differ in permitted outcomes and scaffolding, not only difficulty adjectives.
- Exact parts, marks, response types, four-choice MCQs, required resources and populated three-level schemes for six-mark responses are checked. The common gate checks actual tasks, answer keys, resource consistency and graph conventions.
- Existing repair parsing preserves task aliases, MCQ choices and structured schemes. A failed repair write stops completion. Missing/wrongly marked planned rows are not silently relabelled or re-marked to manufacture a passing total.
- Scope flags cover selected known Higher/A-level leaks. They are conservative heuristics, not a complete semantic syllabus classifier. A correct topic label is not proof that the question actually assesses that topic.
- Practice retains the requested quiz format/count. Paper 2 scope, answer normalisation and quality gates also run on quiz output. The cache identity includes paper, tier and Paper 2 resource version; cached MCQ order and keys remain paired.
- Marking receives the saved Paper 2 component and tier. Six-mark responses use the saved science descriptors and holistic best fit. Tier never causes a deduction for an otherwise correct student answer.

## Automated evidence

The complete suite passes with 335 tests in 27 files, plus frontend type checking, critical hook checks, the backend missing-identifier check, 36 Edge Function bundles and the production build. The offline inventory now contains 12 paper/tier/mode combinations.

New tests execute the bundled extraction, format-saving, exam-finalisation and both practice-generation functions using synthetic provider responses and simulated databases. They cover both tiers, both paper lengths, rejected/missing tasks, repaired private schemes, lost resources/choices, failed persistence, cache isolation, saved-component precedence, and profile save/reopen. Existing access, quota and marking-failure tests remain in the suite.

The eight pre-existing AQA Paper 1/OCR plans, definitions and contract prompt contributions retain their original SHA-256 baselines. Do not change those baselines merely to pass tests. No fresh paid model generation, real database round trip, live deployment or external Gemini rating has been performed here.

## Installation and preview review

Use the complete numbered text bundle and routing guide. Preserve newer unrelated GitHub edits. No dependency update, generated-type edit, migration, data reset or historical grade change is required.

Run `npm ci` on Node 22 or 24, `npm run check`, and `node scripts/audit-biology.mjs`. Redeploy all eight dependent functions with the shared modules: `upload-exam`, `save-exam-format`, `extract-exam-questions`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `submit-exam`, `grade-practice-question`. The `publish-exam` function finalises an individual exam; updating it does not publish the website.

First perform settings-only preview checks using temporary profiles: save/reopen Paper 2 at each tier; switch Paper 1/Paper 2 and reapply settings; preserve Custom topics; reopen existing Paper 1 and Gateway profiles. Keep the website unpublished.

Then the founder can deliberately generate one fresh short Foundation Paper 2, followed by a short Higher paper. If both complete, review a full paper at each tier to exercise all four six-mark schemes and the planned resource mix. Check the rendered paper and private scheme together; retain the actual questions, snapshot, model/version and failures outside the public repository. An external Gemini rating is one review input, not an in-app score or certification. Do not repeat paid attempts blindly: capture failing question numbers, repair acceptance/saving phase and call counts first.

Edexcel and other courses remain separate future adapters. This Paper 2 change does not enable them or the remaining OCR components.
