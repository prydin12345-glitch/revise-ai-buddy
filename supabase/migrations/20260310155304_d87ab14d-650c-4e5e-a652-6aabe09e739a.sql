ALTER TABLE public.subject_exam_profiles
  ADD COLUMN IF NOT EXISTS mcq_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mcq_position text DEFAULT 'start',
  ADD COLUMN IF NOT EXISTS mark_distribution jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS include_extended boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extended_marks integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty_progression text DEFAULT 'ascending',
  ADD COLUMN IF NOT EXISTS calculator_policy text DEFAULT 'allowed',
  ADD COLUMN IF NOT EXISTS structure_preset text DEFAULT 'custom';