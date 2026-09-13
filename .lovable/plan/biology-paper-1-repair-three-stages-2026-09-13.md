# Biology Paper 1 repair — three stages

## What I already confirmed (Step 1 of your plan)

The affected paper is the one open in your preview (exam `90f69d3c…`, "Unsure", 13 Sep 13:28).

- Q1(a) and Q2(a) are stored **without a task** in the *draft* rows as well as the final question rows.
- Both have full mark schemes: Q1(a) expects `(10 − 4) / 30 = 0.2 units per minute`; Q2(a) expects independent/dependent variables.
- Later parts generated normally, so this is not truncation. **The model wrote context-only stems and the answer key separately; nothing downstream deleted the task.** Every gate afterwards passed it because the quality score only checks counts, options and presence of an answer field.

So the fix belongs in the generation contract plus a hard gate, exactly as your plan states.

## Stage A — answerability gates (blocking defects)

New `supabase/functions/_shared/question-contract-validator.ts`:
- Typed defects with stable part IDs: `missing_task`, `missing_required_resource`, `missing_answer`, `answer_mismatch`, `invalid_options`, `incorrect_mark_total`.
- Task detection is structural, not punctuation-based: a scored part must carry an explicit command (command-verb clause, completion/tick-box instruction, or an `task` field) — a full stop is fine, an instruction before a table is fine, a trailing question mark is never required.
- Separate `context` and `task` fields in the generation schema; displayed text is assembled deterministically so the instruction survives numbering, sanitisation and resource routing.

Wired in at three points: raw candidates, after every sanitisation/repair, and at the draft-to-exam boundary (`publish-exam`). A paper with a blocking defect cannot be started or exported.

Repair path (`extract-exam-questions`): regenerate the **whole failing parent group with its answers and mark scheme together** — the current regeneration rewrites text while keeping the old key. Max 2 attempts per group, inside a whole-request budget, counted against existing quotas. Exhausted budget produces a clear generation failure, never a short paper.

`publish-exam`: remove the "default the MCQ answer to A" fallback; a missing key blocks completion.

## Stage B — guided Biology recipes

New `supabase/functions/_shared/biology-paper-contract.ts`, versioned, for AQA separate Biology 8461 Paper 1:
- **Full mock** — 100 marks, 105 minutes, Paper 1 topic scope, tier from Batch 1.
- **Short practice** — same scope, shorter plan, shows its real mark total and is labelled short practice.
- **Custom** — untouched; a zero-MCQ profile stays a deliberate written-only session.

Deterministic plan built before the model is called: each part gets an ID, parent ID, topic, tier, response type, marks, demand target and optional resource ID. Marks are computed from the plan; parent count, answerable-part count and total marks are tracked separately so UI clamps cannot truncate a valid full plan. Stored identity is course + paper + mode + contract version, not a display name.

Profile UI (`ExamProfileModal`, `paperPresets`, `useSubjectProfiles`, `SubjectDetail`, `CreateExam`, `save-exam-format`): mode selector plus an **explicit conversion** with a settings summary — never a silent overwrite of an existing custom profile.

First short development template: 8 marked parts, two 1-mark single-select MCQs, one meaningful data table, one supported diagram/graph, the rest written, one easy 1-mark part early. Marked internally as a test template, not an AQA rule.

## Stage C — resources, rendering, verification

- One source dataset per resource, reused by the figure, the question and the private key; units, row widths, labels and arithmetic validated.
- Resource resolution recognises **question-local and shared** resources (`question-text-scrubber`, insert figures). A missing required resource triggers repair or failure — never reference scrubbing followed by a "ready" paper.
- Renderer support is checked before a diagram is requested; if agar-plate rendering isn't supported, a validated results table is used instead. The Q1 calculation is described as the mean change in concentration gradient per minute, not a measured diffusion rate.
- Biology prompts gated by qualification/tier/paper; conflicting A-level examples and contradictory MCQ/media rules removed.
- Mixed MCQ + written parts under one parent keep shared context in `ExamInProgress` and the PDF. No matching/multi-select until input, saving, marking and export all support it. Student-facing answer-key filtering unchanged.
- Cache identity gains the contract/prompt version so incompatible cached output is retired (`cache-utils`, both practice functions).

Tests: `supabase/tests/biology-paper-contract.test.ts` plus fixtures, including the exact Q1(a)/Q2(a) stems as negative fixtures, legitimate full-stop commands and instruction-before-table as positives, stale answer after repair, missing figure payload, budget exhaustion, and student projection leakage. Then `npm run check`.

## Deployment (after your review, preview only)

No schema change expected. Functions to update: `extract-exam-questions`, `publish-exam`, `sanitise-questions`, `save-exam-format`, `generate-practice-questions`, `get-practice-questions` (shared helpers ship with their callers). The site stays unpublished.

Verification after install: one fresh short paper per tier, then a full 100-mark paper; PDFs and private mark schemes kept for your review. I will report automated results and live results separately and will not claim a rating from automated checks.
