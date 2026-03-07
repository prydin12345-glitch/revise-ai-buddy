

# Plan: Manual Exam Creator for Tutors

## Overview
Build a dedicated "Manual Question Builder" page where tutors hand-craft exam questions with mark schemes, then assemble them into exams with AI-assisted or manual marking. This is a large feature spanning a new page, new components, a new database table, and an edge function.

## Database Changes

**New table: `tutor_question_bank`**
- `id` (uuid, PK)
- `tutor_id` (uuid, NOT NULL) — references auth.users
- `question_text` (text, NOT NULL)
- `question_type` (text, default 'short_answer') — short_answer, mcq, long_form
- `expected_answer` (text) — mark scheme / model answer
- `max_marks` (integer, NOT NULL)
- `topic_tag` (text) — linked to class sub-topics
- `subject_name` (text, NOT NULL)
- `options` (jsonb) — for MCQ
- `marking_preference` (text, default 'ai_assisted') — ai_assisted, manual, self_marking
- `estimated_minutes` (integer) — AI-suggested time
- `metadata` (jsonb, default '{}')
- `created_at`, `updated_at` (timestamptz)

RLS: tutor can CRUD own rows (`tutor_id = auth.uid()`).

**New table: `tutor_manual_exams`**
- `id` (uuid, PK)
- `tutor_id` (uuid, NOT NULL)
- `title` (text, NOT NULL)
- `subject_name` (text, NOT NULL)
- `subject_color` (text, default '#3B82F6')
- `marking_preference` (text, default 'ai_assisted')
- `educational_tier` (text)
- `question_ids` (uuid[], NOT NULL) — ordered list of question_bank IDs
- `total_marks` (integer, default 0)
- `estimated_minutes` (integer)
- `status` (text, default 'draft') — draft, published
- `created_at`, `updated_at` (timestamptz)

RLS: tutor can CRUD own rows.

## New Route
- `/tutor/exams/create-manual` → `ManualExamCreator` page (wrapped in TutorLayout)

## New Components

### 1. `src/pages/tutor/ManualExamCreator.tsx` — Main Page
Split-view layout:
- **Left panel**: Question editor form (question text via textarea with LaTeX auto-convert, expected answer, max marks, topic tag dropdown, marking preference toggle)
- **Right panel**: Live preview rendering the question as students would see it (using `MathRenderer`)
- **Bottom/sidebar**: Exam stats sidebar showing total marks, topic distribution pie chart, estimated time

Key behaviors:
- "Add Question" appends to a sortable list (drag-and-drop reorder via `@dnd-kit`)
- Inline editing: click question number to rename, click mark bubble to change
- Focus mode: when editing a question, dim others with opacity
- Auto-save indicator in header
- Empty state illustration when no questions exist

### 2. `src/components/tutor/ManualQuestionEditor.tsx`
- Rich text fields for question and mark scheme
- LaTeX detection: if tutor types `1/2` or `sqrt`, offer to convert to `$\frac{1}{2}$` or `$\sqrt{}$`
- Topic tag dropdown pulling from class sub-topics (`subject_master_topics`)
- Max marks input (1-10)
- "Polish with AI" button

### 3. `src/components/tutor/ManualQuestionPreview.tsx`
- Renders the question exactly as students see it using `MathRenderer`
- Shows mark allocation badge, topic tag

### 4. `src/components/tutor/MarkingPreferenceSelector.tsx`
- Segmented card with 3 options: AI-Assisted (Sparkles icon), Manual (User icon), Self-Marking (CheckCircle icon)
- Each option has description text

### 5. `src/components/tutor/ExamCompositionSidebar.tsx`
- Sticky sidebar showing:
  - Total marks counter
  - Topic distribution (mini pie chart via recharts)
  - Estimated completion time (marks × 1.5 min ratio)
  - Question count

## Edge Function: `polish-question`
- Takes raw question text + subject + educational tier
- Uses Lovable AI (gemini-2.5-flash) to rephrase into formal exam-board style
- Returns polished text preserving mathematical requirements

## Integration Points

1. **Saving to Question Bank**: Each question is saved to `tutor_question_bank` independently, enabling reuse across exams.

2. **Publishing as Exam**: When the tutor clicks "Publish", create an entry in the `exams` table (type = 'manual') and copy questions to `exam_questions`. This integrates with existing assignment/grading flows.

3. **AI Marking**: When `marking_preference = 'ai_assisted'`, the existing `submit-exam` edge function will compare student answers against `expected_answer` from the question bank, awarding partial credit based on mark scheme steps.

4. **Class Stats Integration**: Manual exam results flow through existing `exam_submissions` and `student_answers` tables, so the Class Performance Dashboard and weak-topic detection work automatically.

5. **Tutor's "Create Exam" page**: Add a toggle/tab at the top of `CreateTutorExam.tsx` — "Upload & Generate" vs "Build Manually" — routing to the new page.

## UI Details
- Subject-themed accent colors on save buttons, active borders, progress bars
- Glassmorphism floating toolbar (`backdrop-blur-md bg-white/5 border border-white/10`)
- Dark-themed empty state with illustration text: "Your masterpiece starts here"
- Auto-save with subtle "All changes saved ✓" indicator that pulses

## Files to Create
1. `src/pages/tutor/ManualExamCreator.tsx`
2. `src/components/tutor/ManualQuestionEditor.tsx`
3. `src/components/tutor/ManualQuestionPreview.tsx`
4. `src/components/tutor/MarkingPreferenceSelector.tsx`
5. `src/components/tutor/ExamCompositionSidebar.tsx`
6. `supabase/functions/polish-question/index.ts`

## Files to Edit
1. `src/App.tsx` — add route `/tutor/exams/create-manual`
2. `src/pages/tutor/CreateTutorExam.tsx` — add "Build Manually" button/link
3. `src/pages/tutor/ManageExams.tsx` — add manual exams in listing

