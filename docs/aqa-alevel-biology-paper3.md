# AQA A-level Biology Paper 3 (7402/3)

This adds an explicitly selected, untiered Paper 3 to the existing Biology course-pack system. No migration, generated-type edit, package update or historical-grade change is required.

## Assessment contract

AQA specifies 78 marks, 120 minutes and 30% of the A-level: 38 marks of structured questions including practical techniques, 15 marks of critical analysis of experimental data, and one 25-mark essay chosen from two titles. Topics 1–8 and relevant practical skills can be assessed.

The full Examly template has six parent groups and 18 scored parts, with no MCQs. Its first four groups total 38 marks; the fifth has five experimental-analysis parts worth 15 marks; the sixth is a single 25-mark essay row. These group/part counts are **Examly design choices**, not official fixed AQA counts. AO annotations total 24 AO1, 29 AO2 and 25 AO3 marks, including 13 AO1 + 12 AO2 essay marks. The annotations guide drafting; they do not certify an AI paper's cognitive demand.

Short practice has three groups, five parts, 40 marks and 70 minutes. It deliberately retains the complete 25-mark essay, alongside eight structured and seven analysis marks. It is labelled short practice, not an official paper. Custom mode retains manual settings. Ordinary practice quizzes keep their requested question count and format; they do not acquire an essay.

The saved identity remains course `aqa_alevel_biology_7402`, paper `paper_3`, component `7402/3`, `not_tiered`, contract version 1 and the existing reviewed specification version. Subject names such as Biology Higher do not turn A-level into a tiered course.

## Generation and resources

Paper 3 has a whole-course outcome pool independent of earlier-paper exclusions. The existing whole-parent batching, truncation recovery, call/time budgets, quotas and answerability gates remain in place. Critical-analysis siblings carry the same complete table, including units and caption. Conflicting copies are rejected. Each part still needs a complete assessed instruction and its own private answer key.

The public `biology_essay_choice` resource contains only two distinct original titles, labelled A and B. The private `biology_essay_key` stores matched title-specific indicative content, with 4–10 detailed areas per title and links to the title. Four areas means distinct biological topic areas, not necessarily four numbered course chapters. Structural validation cannot certify scientific accuracy or the intellectual quality of a title.

Initial and repair parsing retain structured essay keys, accept equivalent aliases irrespective of JSON property order, and reject conflicting aliases. Repairs replace the titles and private keys coherently. Publication checks the complete saved plan. Public question projection whitelists the title fields and strips private extras.

## Answering and marking

Students choose A or B and write one essay. The choice and text share the existing durable `answer_text` field using `[Essay A]` or `[Essay B]`; no new client-writable metadata or database column is introduced. Changing title preserves the text. Choosing a title without writing does not count as an answered question.

Only the protected plan's essay slot can invoke essay marking. The backend preflights titles, private key, selected title and required data before any marking call. Text with no selected title is refused rather than assigned a guessed title. A truly blank essay can score zero without a model call; a failed or malformed grading response cannot be saved as a zero.

The marker receives only the selected title's indicative content. It applies five holistic bands (1–5, 6–10, 11–15, 16–20 and 21–25), plus zero for no relevant material. It does not use the old 16+3+3+3 split or GCSE three-level marking. Relevant material beyond specification requirements is needed for 24–25, not for 21–23. The returned integer score, band and choice must agree before the existing atomic finalisation is allowed. Review uses the existing release protections and formats authorised private guidance into readable text.

## Screen and PDF

Both titles appear once in an EITHER/OR block. Essay titles remain required text when diagrams are disabled in PDF options. Essay writing space spans pages. Optional private guidance starts in the separate answer-key section and paginates rather than overflowing. Table headers wrap instead of being abbreviated, preserving units; numeric zero is not converted to an empty cell. These table fixes also benefit existing exports.

## Verification and practical limits

Tests exercise profile save/reopen, both paper modes, whole-course scope, title/key validation, consistent experimental data, initial and repair parsing, actual compiled generation/publication handlers, truncation, failed repair saves, ordinary quizzes, selected-title marking, invalid/provider failures, privacy projection, UI answer persistence and PDF output. Model responses and databases are simulated. No paid paper, paid marking request, production record or remote deployment is used by these tests.

The local regression comparison preserves the plans, definitions, full prompts and first-group prompts for all 40 previously supported template combinations. The offline inventory becomes 42 after adding Paper 3 full and short modes. A synthetic export was generated with the real jsPDF exporter and visually reviewed; actual browser download, font/focus behaviour and preview deployment still need Lovable verification. Automated tests and synthetic PDFs do not certify a real generated paper or a Gemini rating.

The affected function dependency graph requires updating: `extract-exam-questions`, `generate-practice-questions`, `get-exam-questions`, `get-practice-questions`, `grade-practice-question`, `publish-exam`, `save-exam-format`, `save-exam-progress`, `submit-exam`, `submit-student-answer`, `upload-exam`. Recompute for newer upstream changes. Updating `publish-exam` finalises individual exam functionality; it does not publish the website.

## Primary references checked 29 September 2026

- https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/specification-at-a-glance
- https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/scheme-of-assessment
- https://store.aqa.org.uk/resources/biology/AQA-74023-SMS.PDF
- https://filestore.aqa.org.uk/content/ase-2018/AQA-ASE-2018-A-BIOL-ESSAY-BKLT.PDF
- https://www.aqa.org.uk/professional-development/inside-assessment/bringing-assessment-to-life/biology
