ALTER TABLE practice_question_sets
ADD COLUMN IF NOT EXISTS question_format text DEFAULT 'written_only',
ADD COLUMN IF NOT EXISTS mcq_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS written_count integer DEFAULT 0;