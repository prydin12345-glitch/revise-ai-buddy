# OCR Twenty First Century GCSE Biology B (J257)

This adapter enables the separate-science course. It does not convert a Gateway
profile and never chooses a course, component or tier from a subject label.
A recognisable custom name such as Biology Higher continues to work, with OCR,
GCSE, the course, paper and tier selected explicitly.

## Components and assessment style

| Paper | Foundation | Higher | Full marks | Minutes |
| --- | --- | --- | --- | --- |
| Breadth in biology | J257/01 | J257/03 | 90 | 105 |
| Depth in biology | J257/02 | J257/04 | 90 | 105 |

Both papers can assess B1-B6, with B7 Ideas about Science and B8 practical skills
embedded throughout. They do not use Gateway's first/second-paper topic split.
Breadth uses short/objective tasks, occasional interspersed MCQs and no extended
level-response questions. OCR's assessment guide limits individual Breadth tasks
to four marks. Depth combines short responses with at least two six-mark
level-response tasks. There is no separate Gateway-style MCQ section.

## Examly template v1, not a fixed official question count

| Template | Groups | Parts | MCQs | Six-mark tasks | Marks | Minutes |
| --- | --- | --- | --- | --- | --- | --- |
| Breadth full mock | 15 | 45 | 6 | 0 | 90 | 105 |
| Depth full mock | 9 | 36 | 3 | 2 | 90 | 105 |
| Breadth short practice | 6 | 12 | 2 | 0 | 24 | 28 |
| Depth short practice | 6 | 12 | 2 | 2 | 30 | 35 |

The subpart counts, chapter allocations, MCQ counts and short-practice lengths
are Examly choices. The full Breadth template uses at most three marks per part.
OCR's component AO proportions translate into fractional marks. Our whole-mark
targets are Breadth 43/33/14 and Depth 29/39/22, which together total 72/72/36
(40/40/20 percent across 180 marks). Each full template targets at least nine
mathematical and fourteen practical marks. These annotations do not prove that a
model's content assesses those skills correctly. Separately generated tier papers
do not promise identical overlap questions.

Outcomes are original summaries checked against version 4.0 of J257. They form a
reviewed vocabulary for generation, not an exhaustive specification. Both tiers
allow the simple two-stage photosynthesis account and relative ATP yields.
Foundation excludes the specification's bold Higher content, including mRNA detail,
monoclonal antibodies, interacting photosynthesis limiting factors, inverse-square
law, standard-form calculations, ADH and glucagon. Detailed biochemistry remains
out of scope at both tiers. Narrow keyword checks supplement, not replace, the
outcome instructions and external review.

## Connected paths

- `assessment-tier.ts` enables the catalogue entry only with both registered packs.
- `ocr21c-biology-scope.ts` holds shared content and tier instructions.
- `ocr21c-biology-contract.ts` constructs immutable part plans before model calls.
- The registry supplies generation, batch, completion, repair and finalisation rules.
- Owned profiles save explicit `breadth`/`depth` selection in existing blueprint JSON.
  Existing protected server snapshots freeze the chosen component across retries.
- Exam and quiz generation, cache identity, marking, screen labels and PDF labels
  use the saved selection. Small quizzes retain their count and format. Breadth
  quizzes remain short tasks; they do not receive six-mark essay schemes.
- Depth's planned six-mark tasks receive an extended-response notice in the screen
  and PDF booklet. Mark schemes remain private under the existing release rules.

No migration, generated-type change, package update or lockfile change is needed.
No access, release, quota or generation-budget rules are changed. Existing AQA,
Gateway and Edexcel definitions, plans and contract prompts must retain their
baseline hashes. Gateway second papers remain unavailable.

## Verification and rollout

Run `npm ci`, `npm run check` and `node scripts/audit-biology.mjs` on Node 22 or 24.
The audit now enumerates 28 registered paper/tier/mode combinations (20 existing,
eight new). Tests include actual bundled Edge handlers with intercepted model and
database calls: complete and truncated output, repair persistence failure,
missing parts, finalisation, saved-context precedence, fresh and cached quizzes.
Profile tests exercise save/reopen and Custom-topic retention in jsdom. PDF tests
check the extended-response notice and private-key omission, not live browser
canvas quality. These tests do not constitute a live paper or a Gemini rating.

Redeploy the shared dependencies in upload-exam, save-exam-format,
extract-exam-questions, publish-exam, generate-practice-questions,
get-practice-questions, submit-exam and grade-practice-question. Recalculate the
import graph if newer code changes it. Updating publish-exam finalises individual
exams; it never authorises publishing the website.

Lovable should verify settings in the unpublished preview before the founder
starts paid testing. Start with a fresh short Breadth Foundation paper, then
Higher, then short Depth at both tiers, followed by full mocks at all four
components. Check resources, private keys, mobile layout and downloaded PDF.
Use a small quiz from each selected profile too. Existing saved papers are not
regenerated by installing this adapter.

## Primary references checked 25 September 2026

- OCR J257 specification v4.0, August 2026, chapters B1-B8 and sections 3a/3b:
  https://www.ocr.org.uk/Images/234595-specification-accredited-gcse-twenty-first-century-science-suite-biology-b-j257.pdf
- OCR assessment approach guide (Breadth/Depth and level-response marking):
  https://www.ocr.org.uk/Images/462607-exploring-our-question-papers-twenty-first-century-science.pdf
- OCR component overview:
  https://www.ocr.org.uk/qualifications/gcse/twenty-first-century-science-suite-biology-b-j257-from-2016/specification-at-a-glance/
- J257/01 and /03 Breadth sample papers/mark schemes:
  https://www.ocr.org.uk/Images/234581-unit-j257-01-breadth-in-biology-foundation-tier-paper-1-sample-assessment-material.pdf
  https://www.ocr.org.uk/Images/234583-unit-j257-03-breadth-in-biology-higher-tier-paper-3-sample-assessment-material.pdf
- J257/02 and /04 Depth sample papers/mark schemes:
  https://www.ocr.org.uk/Images/234582-unit-j257-02-depth-in-biology-foundation-tier-paper-2-sample-assessment-material.pdf
  https://www.ocr.org.uk/Images/234584-unit-j257-04-depth-in-biology-higher-tier-paper-4-sample-assessment-material.pdf
