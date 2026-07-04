-- Insert figures: validated map/chart figure data attached to an exam.
-- Written by extract-exam-questions after server-side validation
-- (supabase/functions/_shared/insert-figures.ts); read by the exam page.
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS insert_figures jsonb DEFAULT NULL;
