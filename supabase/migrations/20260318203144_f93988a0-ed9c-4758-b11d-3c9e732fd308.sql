ALTER TABLE public.subject_exam_profiles
  ADD COLUMN IF NOT EXISTS mcq_options_count integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS include_graphs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_tables boolean NOT NULL DEFAULT false;

ALTER TABLE public.exam_format
  ADD COLUMN IF NOT EXISTS profile_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;