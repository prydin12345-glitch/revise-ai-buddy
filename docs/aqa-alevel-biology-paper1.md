# AQA A-level Biology Paper 1

This release adds the full A-level course **7402**, component **7402/1**. It uses
the reviewed specification **version 1.6, July 2026**, recorded as
`aqa-7402-v1.6-2026-07`. It does not enable AS Biology 7401, Papers 2/3, or any
international course. Those need separate reviewed adapters.

## Profile workflow

Select Biology (including a custom display name such as `Biology Higher`), AQA,
and **Level 3 (Age 16–18)**, then explicitly select **Paper 1**. Choose Full mock
or Short practice and press **Use these settings** before saving. Foundation and
Higher buttons do not appear: the saved tier is explicitly `not_tiered`. A
missing tier on an old GCSE profile still means unknown, not untiered.

The explicit board and qualification determine the course. Names never choose
a tier or convert an AS/AP/GCSE qualification into the A-level. A profile with a
conflicting saved Foundation/Higher value must be resaved. Changing the
educational level clears the previous course, paper and tier selection. Existing
recognised A-level aliases reopen as Level 3. Custom mode retains the user's
manually selected topics; guided modes derive topics from the selected plan.

## Official requirements and Examly layout choices

| Property | Full mock | Short practice |
|---|---:|---:|
| Marks | 91 | 25 |
| Minutes | 120 | 33 |
| Parent groups | 9 | 4 |
| Scored parts | 34 | 8 |
| MCQs | 0 | 0 |
| Extended-response marks | 15 (three five-mark parts) | 5 |
| Tables / graphs | 4 / 3 | 1 / 3 |

AQA specifies 91 marks, two hours, Topics 1–4 and relevant practical skills, with
76 short/long-answer marks and 15 extended-response marks; Paper 1 contributes
35% of the qualification. The group counts, part allocations, resource counts,
three five-mark extended tasks and short-practice layout are Examly choices.
No claim is made that every official paper has this layout.

The full template's AO marks are 42/29/20, within AQA's Paper 1 AO ranges. Maths
and practical annotations guide generation and are checked as template targets;
they do not prove that a generated task tests the intended skill. A written mock
cannot award the separately assessed practical endorsement or an official
qualification grade.

## Implementation boundaries

- `curriculum-identity.ts` makes country, jurisdiction, qualification and subject
  reusable metadata. Only registered, reviewed adapters enable generation. This
  is groundwork for more qualifications, not an implemented AI profile builder.
- `assessment-tier.ts` recognises the untiered AQA course, independently of
  Foundation/Higher choices. The existing GCSE catalogue and paper defaults stay
  compatible.
- `aqa-alevel-biology-scope.ts` contains reviewed outcome summaries for 3.1–3.4
  and conservative later-paper checks. Transcription, translation, ATP, enzyme
  mechanisms, organelle structure and water potential are allowed. Later-paper
  pathway/nerve/gene-technology recall and calculating standard deviations are
  rejected. These checks do not constitute exhaustive scientific validation.
- `aqa-alevel-biology-contract.ts` owns the plans, response-mark split and
  question-specific generation/repair instructions. Existing whole-parent
  batching, truncated-output completion and call/time budgets are reused.
- The owned-profile resolver writes the authoritative course, paper, component,
  edition and curriculum into the protected server snapshot. Existing attempts
  retain their snapshot if the profile is later edited. No migration is needed.
- Practice quizzes keep their requested count and format, including MCQs. They
  use the saved Paper 1 scope and an isolated edition-aware cache. Six-mark
  practice responses use point-based keys, not GCSE three-level descriptors.
- Marking uses the saved private key, task and data. A-level practice gets a
  Biology examiner persona and point-marking instructions. Screen/PDF labels
  show `7402/1`, with an extended-response notice only on planned extended parts.

## Sources reviewed on 26 September 2026

- [Specification at a glance](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/specification-at-a-glance)
- [Scheme of assessment](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/scheme-of-assessment)
- [Biological molecules](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/subject-content/biological-molecules)
- [Cells](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/subject-content/cells)
- [Exchange](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/subject-content/organisms-exchange-substances-with-their-environment)
- [Genetic information and diversity](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/subject-content/genetic-information-variation-and-relationships-between-organisms)
- [Practical assessment](https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/practical-assessment)
- [Specimen Paper 1 mark scheme](https://filestore.aqa.org.uk/resources/biology/AQA-74021-SMS.PDF)

## Verification and remaining preview work

Run `npm ci`, `npm run check` and `node scripts/audit-biology.mjs` on Node 22/24.
The inventory contains 38 combinations: 36 existing GCSE combinations and two
A-level modes. Retain the existing baseline hashes. The package includes a
before/after comparison of all 36 previous plans, definitions and full/batch
prompts.

New tests execute actual bundled upload, format-saving, extraction, finalisation,
quiz and marking functions with synthetic model replies and simulated databases.
They cover whole-parent batching, truncated completion, rejected repair writes,
missing tasks, invalid contexts, ownership, cache isolation and frozen snapshots.
Profile tests run in JSDOM; the popover's presentation/focus primitive is mocked
while the real settings handlers run. PDF checks examine generated document
content. These are not live browser, Supabase or paid-model checks.

After installation, redeploy all eight dependent functions with their shared
imports: upload-exam, save-exam-format, extract-exam-questions, publish-exam,
generate-practice-questions, get-practice-questions, submit-exam and
grade-practice-question. `publish-exam` finalises one exam; deploying it does not
publish the website.

In the unpublished preview, verify real profile save/reopen, GCSE-to-A-level
switching, keyboard/focus behaviour, mobile/light/dark presentation and a
browser-downloaded PDF with fixtures. Check existing GCSE profiles. Then the
founder can generate a fresh short practice, followed by a full mock and a small
quiz. Review tasks, data, mark schemes and coverage manually. Gemini ratings
remain an external user audit, not an app feature or automated certification.

On a real failure, record course/component/edition/mode, exam ID, deployed
function version, call/token counts, failed part numbers and repair rejection
reasons. Distinguish provider success, accepted repair, persistence and final
readiness. Do not share secrets or student personal data, bypass a quality gate,
or ask for paid retries while a known installation/deployment problem remains.

Next: implement Paper 2's comprehension format, then Paper 3's critical analysis
and choice of essays. The later international AI profile assistant should extract
structure/topics from supplied official sources, validate them and let users
confirm a labelled custom profile; it must not claim an unreviewed profile is a
reviewed board preset.
