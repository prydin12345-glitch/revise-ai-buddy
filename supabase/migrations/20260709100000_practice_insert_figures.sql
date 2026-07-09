-- Insert figures for practice question sets (mirrors exams.insert_figures).
-- Written by generate-practice-questions after validation via
-- supabase/functions/_shared/insert-figures.ts; read by TakePracticeQuiz.
ALTER TABLE public.practice_question_sets ADD COLUMN IF NOT EXISTS insert_figures jsonb DEFAULT NULL;
