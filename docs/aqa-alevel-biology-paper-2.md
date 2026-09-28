# AQA A-level Biology Paper 2

This incremental update adds the full A-level component **7402/2**, not AS Biology 7401. It is untiered. Select Paper 2 explicitly and apply the guided settings; the words Higher or Foundation in a custom subject name do not select a tier.

## Reviewed specification and Examly choices

The source specification is AQA 7402, version 1.6 (July 2026), recorded as `aqa-7402-v1.6-2026-07`. Official pages were checked on 28 September 2026.

| Property | Official assessment / implementation |
| --- | --- |
| Scope | Topics 5-8, including relevant practical skills |
| Full paper | 91 marks, 120 minutes, 35% of the A-level |
| Mark allocation | 76 short/long-answer marks plus one 15-mark comprehension question |
| Examly full layout | 9 parent groups, 35 scored parts, no MCQs |
| Full-paper AO design targets | AO1 24, AO2 49, AO3 18 marks, within the published Paper 2 percentage ranges |
| Short practice | 25 marks, 33 minutes, 4 groups, 9 parts; includes an 8-mark mini-comprehension |
| Full comprehension drafting target | 350-650 words, 4-8 numbered paragraphs |
| Short comprehension drafting target | 180-350 words, 3-5 numbered paragraphs |

Parent counts, part counts, topic grouping and passage lengths are Examly design choices, not fixed AQA requirements. Mathematical and practical annotations guide drafting; automated counts cannot establish that a generated task genuinely assesses the intended skill. The 10% mathematical and at-least-15% practical requirements apply across the qualification, not independently to every paper.

The existing Paper 1 and GCSE plans and prompts are preserved. Paper 3 remains unavailable. A-level content such as the Calvin and Krebs cycles, chemiosmosis, homeostasis, gene technology and population genetics is permitted here; GCSE exclusions must not be applied to this course. Paper 1 knowledge may underpin an application, but this paper's assessed outcomes are Topics 5-8.

## Data flow and resource handling

The saved server context fixes the course, specification edition, paper, component, mode and contract version. Existing ownership checks prevent a browser request from replacing that identity. Changing the profile later does not reinterpret an existing attempt.

The original reading passage lives in the existing question `diagram_config` JSON, with only `type`, `resourceId`, `title` and `paragraphs`. Generation sends the full `biology_comprehension` source on part (a), and `biology_comprehension_ref` objects on its siblings. References expand only from an unambiguous source within the same parent group. Completion requests retain existing siblings and their source. A missing, short, conflicting, malformed or private-key-bearing passage fails validation. Tasks must cite real numbered paragraphs; unprinted line-number references are refused. These checks do not measure literary quality, scientific validity or how well the question uses the reading.

Whole-group repairs must supply one coherent passage and fresh task-specific keys for all affected siblings. Existing repair limits and the shared 26-call / 9-minute generation budget remain unchanged. Provider success, accepted repair, saved draft and final readiness remain separate states. No gate is bypassed to make generation finish.

The exam screen opens the reading on the first part and keeps it available in a collapsible panel on later parts. The resource insert contains one numbered copy. PDF export prints one source per group even when optional diagrams are disabled; it retains subpart labels and keeps an optional answer-key section separate. Conflicting saved copies block export. Canonical `9(a)` PDF labels and answer-space page continuation have also been repaired.

Marking receives the actual saved passage/data alongside the private task key. Missing planned comprehension evidence stops marking rather than producing a grade without the source. Student-facing resource projection excludes private keys and unrecognised fields. A-level six-mark tasks use independent point marking, not the GCSE three-level response rubric or the Paper 3 essay rubric.

Practice quizzes retain the student's selected count and format, including MCQs. They use Paper 2 topic rules and a separate course/paper/version cache identity; they are not forced into a 91-mark exam or a mandatory comprehension group.

## Installation and verification

No migration, generated database type edit, dependency update or lockfile change is needed. Use the existing Node 22/24 workflow:

```sh
npm ci
npm run check
node scripts/audit-biology.mjs
```

The offline inventory now has 40 template combinations. The incremental bundle records hashes showing the previous 38 plan/definition/full-prompt/first-batch combinations unchanged. Synthetic integration tests execute the actual Edge Function code with intercepted model calls and simulated databases, covering creation, batching/truncation, repair, publication, practice/cache and marking. React tests exercise profile selection and resources. PDF tests use the application's real jsPDF output. These are software tests, not an external Gemini score or certification of a live paper.

Deploy these 11 functions with their updated shared dependencies after checks pass: `extract-exam-questions`, `generate-practice-questions`, `get-exam-questions`, `get-practice-questions`, `grade-practice-question`, `publish-exam`, `save-exam-format`, `save-exam-progress`, `submit-exam`, `submit-student-answer`, `upload-exam`. Recompute dependencies if newer repository changes affect them. Updating `publish-exam` finalises individual exams; it does not mean publishing the website.

Keep the website unpublished. Verify profile save/reopen, switching papers, Custom topics, existing Paper 1/GCSE settings, resource display at mobile width in both themes and an actual browser-downloaded PDF. Local PDF rendering does not verify live browser downloads or graph/canvas capture. Do not trigger paid generation automatically. Once installation, deployments and settings checks pass, the founder can test a fresh short Paper 2 and then a full Paper 2 for an external quality review.

If a live attempt fails, record its exam ID, saved identity/mode/version, deployed function version, model call/usage totals, affected part numbers and repair transport/acceptance/persistence/final-readiness state. Do not include secrets or student personal data.

## Primary sources

- [Specification at a glance](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/specification-at-a-glance)
- [Scheme of assessment and Paper 2 AO ranges](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/scheme-of-assessment)
- [3.5 Energy transfers](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/subject-content/energy-transfers-in-and-between-organisms-a-level-only)
- [3.6 Responses to internal and external environments](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/subject-content/organisms-respond-to-changes-in-their-internal-and-external-environments-a-level-only)
- [3.7 Genetics, populations, evolution and ecosystems](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/subject-content/genetics-populations-evolution-and-ecosystems-a-level-only)
- [3.8 Control of gene expression](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/subject-content/the-control-of-gene-expression-a-level-only)
