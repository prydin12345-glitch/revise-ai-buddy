ALTER TABLE public.user_subjects ADD COLUMN IF NOT EXISTS subject_icon TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subjects TO authenticated;
GRANT ALL ON public.user_subjects TO service_role;
