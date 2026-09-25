# Pearson Edexcel GCSE Biology 1BI0 — Papers 1 and 2, version 1

Implemented against GitHub base `4f78a4c24248b7bb629fa140a845e9aa9163f6b6`, including the installed AQA Paper 2 resource repair. This adds development-preview support; it is not website publication or exam-board certification.

## Supported selections

| Selection | Foundation | Higher | Paper topics |
| --- | --- | --- | --- |
| Paper 1 | 1BI0/1F | 1BI0/1H | 1–5 |
| Paper 2 | 1BI0/2F | 1BI0/2H | 1, 6–9 |

The stable course identity is `edexcel_gcse_biology_1bi0`, with `paper_1` or `paper_2` and contract version 1. This covers **separate Biology GCSE**, not Combined Science or International GCSE.

Select Edexcel (or Pearson Edexcel), GCSE and Biology in an exam profile. Names such as **Biology Higher** and **GCSE Biology (1BI0) Foundation** are recognised, but the name never chooses a board, paper or tier. Choose both the paper and tier explicitly. Existing custom Edexcel profiles need that selection before resaving or creating a new attempt; their manual topics are retained. An unknown tier stays unknown.

Guided modes offer a preview before applying settings. Changing paper or tier requires reapplying it. Custom keeps the user's topics and counts but retains the explicit paper/tier boundary. Practice should use this saved profile so it receives the same selection.

Selection uses the existing `paper_blueprint` JSON. The server resolves the owned profile and saves the component, paper, tier and contract in the existing protected `generation_context`. Retries retain that snapshot after profile edits; browser format metadata cannot override it. No migration is required. Old AQA/OCR plans and historical grades are unchanged.

## Official requirements and Examly choices

Sources reviewed on 24–25 September 2026:

- [Pearson specification, Issue 4, March 2024](https://qualifications.pearson.com/content/dam/pdf/GCSE/Science/2016/Specification/gcse-biology-spec.pdf), especially content pages 10–32 and assessment pages 33–35.
- [Pearson sample assessment materials](https://qualifications.pearson.com/content/dam/pdf/GCSE/Science/2016/Specification/SAMs_GCSE_L1-L2_in_Biology.pdf), for question and marking conventions.
- [Ofqual single-science requirements](https://www.gov.uk/government/publications/gcse-9-to-1-subject-level-conditions-and-requirements-for-single-science), for mathematics and practical assessment across the qualification.

Pearson specifies **100 marks, 105 minutes and ten main questions per full paper**, with all questions compulsory. Topic 1 appears on both papers. Foundation targets grades 1–5; Higher targets 4–9. Both actual assessments for the qualification must be taken at the same tier, although Examly allows separate practice profiles for testing either tier.

Examly v1 chooses **40 scored parts, eight embedded MCQs and three six-mark responses**. Those subpart counts and placements are not an official fixed distribution. Its planned AO marks are 40/40/20. Each full plan annotates 19 mathematical marks; Paper 1 annotates 19 practical marks and Paper 2 annotates 22. Annotation directs generation but does not prove the resulting task assesses those skills. The national minimum proportions apply across the qualification; our full-paper templates target them individually too.

The full plans reserve 27 marks for common-content, grades 4–5 demand. Official paired papers contain 27 identical overlap marks; independently generated Examly papers do **not** share identical questions. Do not describe the generated pair as reproducing this official overlap requirement.

Short practice uses **25 marks, 26 minutes, five groups and ten parts**, including five MCQs, three tables and one graph. It samples all five topic areas of the selected paper and is labelled short practice. It does not promise the full-paper AO proportions.

Full Paper 1 requires six data tables and two graphs; full Paper 2 requires seven tables and two graphs. These are template choices. A task can require another supported, relevant resource, but a generic picture cannot replace required numerical data. Existing blank Punnett-scaffold, biomass-calculation, table consistency and answer-disclosure protections apply.

## Board-specific science and tier rules

The `B` suffix in an Edexcel reference means separate Biology, not Higher. Higher-only content is printed in bold in the specification. The new outcome map records that distinction; Foundation and Higher use different permitted outcomes in selected slots.

Do not copy AQA exclusions into Edexcel. For example, named mitotic stages, ABO codominance and lytic/lysogenic viral cycles are common Paper 1 content. Nephron structure, Fick-law calculations and nitrogen cycling are common Paper 2 content. Edexcel Higher Paper 1 permits specified protein-synthesis detail; Higher Paper 2 permits the specified hormonal feedback detail. Advanced photosynthesis biochemistry remains outside scope.

The outcome map is a reviewed generation allowlist, not a claim that every specification statement is sampled by one template. Narrow deterministic flags supplement the scoped prompts. They cannot certify every scientific statement, tier decision or assessment-objective classification; real papers and private keys still need review.

## Generation, repair, quizzes and marking

The Edexcel adapters use the existing immutable-plan generation path. Under the current ten-part batch limit, a clean full-paper run makes five initial requests, each containing two whole parent groups; short practice fits in one initial request. Truncation completion, fallback and repair may add requests within the unchanged **26-call, nine-minute overall budget**. Required parts are never renumbered to conceal omissions. Existing quota and repair limits remain in force.

Final gates require exact parts/marks/types, four distinct MCQ choices, complete assessed tasks, private answer keys, planned resources and task-specific three-level schemes for six-mark responses. Repair receives the saved part outcomes and retains sibling data and MCQs. Failed persistence cannot become successful completion.

Practice retains the requested quiz count and format. Both practice endpoints use the saved paper/tier rules and normalise answer aliases and structured schemes before schema validation. Cache identity separates the papers and tiers with a new Edexcel resource version; cached option order remains paired with the key.

Marking uses the saved component and private key. Six-mark responses use holistic best fit, with task-specific Level 1/2/3 descriptors. It does not demand Higher-only science for Foundation full marks or deduct marks merely for a valid answer exceeding its tier. Screen and PDF labels use the saved component for guided papers.

## Verification and installation

Local checks: **473 tests across 34 files**, frontend type checking, critical hook checks, backend missing-identifier checks, **37 Edge Function bundles**, and the production build. The offline audit contains **20 paper/tier/mode combinations**: the existing twelve plus eight Edexcel variants. No tests were removed; old negative tests now use an unsupported board because Edexcel is supported.

New tests exercise real bundled extraction, format-saving, finalisation and both quiz functions with synthetic responses and simulated databases. They cover save/reopen, protected snapshot routing, tier/content differences, batching, truncated output, repaired keys/tasks, MCQ preservation, required resources, cache isolation and blocked incomplete outputs. Existing security, quota, PDF/resource and AQA/OCR regressions remain.

This is code-level verification. No paid paper, live database save/load, live function deployment, browser PDF download or external Gemini review has been performed for this update. Existing non-blocking warnings include stale Browserslist data, an ambiguous Tailwind duration class and large production chunks; dependencies and lockfiles remain unchanged.

Install the complete text-only bundle using its routing guide, hashes and incremental patch. Retain original source extensions in GitHub. On Node 22 or 24 run `npm ci`, `npm run check` and `node scripts/audit-biology.mjs`.

Redeploy these eight functions with their shared modules: `upload-exam`, `save-exam-format`, `extract-exam-questions`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `submit-exam`, `grade-practice-question`. This list was derived from the changed import graph; recompute it if newer work changes dependencies. Updating `publish-exam` finalises individual exams; it does not publish the website.

Use temporary profiles for preview settings checks, or preserve existing settings. Test both papers and tiers, applying/reapplying settings, Custom topic preservation and reopening existing AQA/OCR profiles. The website stays unpublished. J257, Gateway second papers and other boards remain unavailable as guided packs.

After installation and deployments pass, deliberately test a short Foundation paper followed by a short Higher paper for Paper 1, then Paper 2. Then review full mocks at each paper/tier combination, including tables/graphs, private marking schemes, mobile view and downloaded PDFs. Lovable must not generate paid papers automatically. Keep external Gemini ratings outside the application.

If a fresh attempt fails, record its exam ID, component/tier/mode/version, deployed version, call/token counts, failing question numbers and repair rejection details. Distinguish transport success, repair acceptance, saving and readiness before trying another paid generation. Do not share credentials or student personal data.
