ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS preferred_exam_board text,
ADD COLUMN IF NOT EXISTS preferred_educational_level text;