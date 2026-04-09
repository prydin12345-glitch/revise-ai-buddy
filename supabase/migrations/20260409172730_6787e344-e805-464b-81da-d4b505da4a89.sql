ALTER TABLE public.exam_question_drafts
ADD COLUMN IF NOT EXISTS diagram_config jsonb DEFAULT NULL;

ALTER TABLE public.exam_questions
ADD COLUMN IF NOT EXISTS diagram_config jsonb DEFAULT NULL;

ALTER TABLE public.practice_questions
ADD COLUMN IF NOT EXISTS diagram_config jsonb DEFAULT NULL;