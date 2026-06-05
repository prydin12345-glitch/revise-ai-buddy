# Simplify Exam Profile — Advanced Settings

## Goal
The current Advanced Settings panel on `/my-subjects` (exam profile creation) overwhelms students with options that mostly belong to the AI. Strip it down to two human-meaningful choices, and let the AI infer the rest from subject + educational level.

## What changes in the UI

In `src/components/stats/ExamProfileAdvanced.tsx`, remove:

- **Exam Structure Preset** (GCSE Style, A-Level, AP, SAT, IB, IGCSE, Abitur, HSC, Custom) — the whole preset bank, preset summaries, and disclaimer.
- **Mark Distribution** — the 1mk / 2mk / 3mk / … / 15mk counter grid and the "Written: X / Y" indicator.
- **MCQ Position** (start / end / mixed).
- **Difficulty Progression** (Easy→Hard / Mixed / Hard→Easy).

Keep, in this order:

1. **Extended Response Question** — toggle + the mark-value chips (8 / 10 / 12 / 15 / 20 / 25). Unchanged behaviour: when on, AI places one long-form question at the end.
2. **Calculator Policy** — Allowed / Not allowed / Mixed. Unchanged.

The collapsible "Advanced Settings" wrapper stays, but the panel is now short enough that we can also consider showing both controls inline by default. Decision: keep the collapsible so the modal stays compact.

## What the AI now decides on its own

Per-question mark values, MCQ count/position, difficulty order, and overall structure are inferred from:

- Subject (e.g. Biology, English Literature, Mathematics)
- Educational level (GCSE, A-Level, IB, AP, etc.)
- Total question count
- Whether an extended response is requested
- Calculator policy

To address the concern about a 15-mark Biology question, add **explicit per-subject mark caps** to the generation prompt in `supabase/functions/extract-exam-questions/index.ts` (and the prompt block in `supabase/functions/_shared/generation-context.ts`). Caps are applied as hard rules in the system prompt, not as user-visible settings.

Proposed caps (per non-extended question):

| Subject family | Typical range | Hard cap |
|---|---|---|
| Mathematics, Further Maths | 1–8 | 10 |
| Biology, Chemistry, Physics, Combined Science | 1–6 | 8 |
| Computer Science, Economics (quant), Business (quant) | 1–8 | 10 |
| Geography, History, Psychology, Sociology, RS | 2–12 | 16 |
| English Language, English Literature, MFL essay | 4–25 | 30 |
| Art, Media, Drama (written) | 4–20 | 25 |

The extended-response question (if enabled) is exempt from the cap and uses the user-chosen mark value.

A small helper `getSubjectMarkCap(subject, level)` lives in `supabase/functions/_shared/generation-context.ts` and is injected into the prompt as:

> "Per-question marks must not exceed N for this subject. Extended response (if any) is exempt."

## Data model

The `exam_format` table keeps the same columns — we just stop writing the removed ones from the client:

- `mark_distribution` → always `{}`
- `mcq_position` → always `'start'` (ignored when `mcq_count` is 0)
- `difficulty_progression` → always `'ascending'`
- `question_structure` → always `'standalone'`

No migration needed. Existing profiles continue to work; their stored values are simply no longer read by the new prompt path (mark distribution / progression branches become no-ops when empty/default).

## Files touched

- `src/components/stats/ExamProfileAdvanced.tsx` — major trim; export shape kept stable.
- `src/components/stats/ExamProfileModal.tsx` — only if it references removed UI copy; props unchanged.
- `src/pages/CreateExam.tsx` — verify it tolerates absent preset/distribution (likely no change).
- `supabase/functions/_shared/generation-context.ts` — add `getSubjectMarkCap`, drop the mark-distribution and progression lines from the prompt block, append mark-cap line.
- `supabase/functions/extract-exam-questions/index.ts` — drop the `markDistributionInstruction` block, drop the `difficultyProgression` ordering branches, inject mark cap.

## Out of scope

- No changes to question rendering, marking, graph system, diagram renderers, PDF export, or mobile layout.
- No DB migration.
- No changes to practice quiz generation (already bypasses Exam Profile per project memory).
