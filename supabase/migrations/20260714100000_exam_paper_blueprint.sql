-- Store the validated paper blueprint on the exam itself so the exam-taking
-- UI can honour section rules (e.g. "answer TWO of the three essays") without
-- re-fetching profile internals.
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS paper_blueprint jsonb DEFAULT NULL;
