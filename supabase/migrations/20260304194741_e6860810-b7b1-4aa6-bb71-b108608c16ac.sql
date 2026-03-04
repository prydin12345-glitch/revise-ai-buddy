ALTER TABLE public.subject_exam_profiles 
  ADD COLUMN IF NOT EXISTS educational_tier TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER DEFAULT NULL;