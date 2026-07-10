-- User-defined paper structure on exam profiles: sections of questions with
-- exact marks and style, e.g. AQA English Lang P1's 4/8/8/20 + 40 writing.
ALTER TABLE public.subject_exam_profiles ADD COLUMN IF NOT EXISTS paper_blueprint jsonb DEFAULT NULL;
