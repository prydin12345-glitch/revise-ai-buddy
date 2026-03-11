ALTER TABLE public.subject_exam_profiles
  ADD COLUMN IF NOT EXISTS written_question_count integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS question_structure text DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS parent_question_count integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS max_parts_per_question integer DEFAULT 3;