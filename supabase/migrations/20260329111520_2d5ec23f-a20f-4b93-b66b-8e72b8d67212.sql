ALTER TABLE exam_format
ADD COLUMN IF NOT EXISTS question_structure text DEFAULT 'standalone',
ADD COLUMN IF NOT EXISTS difficulty_progression text DEFAULT 'ascending',
ADD COLUMN IF NOT EXISTS calculator_policy text DEFAULT 'allowed',
ADD COLUMN IF NOT EXISTS include_extended boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS extended_marks integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS mark_distribution jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS mcq_position text DEFAULT 'start',
ADD COLUMN IF NOT EXISTS include_graphs boolean DEFAULT null,
ADD COLUMN IF NOT EXISTS include_tables boolean DEFAULT null,
ADD COLUMN IF NOT EXISTS include_diagrams boolean DEFAULT null;