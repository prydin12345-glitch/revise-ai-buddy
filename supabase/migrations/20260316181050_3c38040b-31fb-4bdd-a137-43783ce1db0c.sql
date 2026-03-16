ALTER TABLE public.user_subjects ADD COLUMN IF NOT EXISTS exam_board TEXT;
ALTER TABLE public.subject_exam_profiles ADD COLUMN IF NOT EXISTS exam_board TEXT;