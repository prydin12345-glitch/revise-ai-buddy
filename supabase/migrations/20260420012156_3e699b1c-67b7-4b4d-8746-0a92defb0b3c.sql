CREATE INDEX IF NOT EXISTS idx_exams_user_id ON public.exams (user_id);
CREATE INDEX IF NOT EXISTS idx_practice_question_sets_user_id ON public.practice_question_sets (user_id);