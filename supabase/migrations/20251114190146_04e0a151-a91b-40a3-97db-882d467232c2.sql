-- Add session state fields to practice_set_progress for proper progress tracking
ALTER TABLE practice_set_progress 
ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS flagged_question_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_practice_progress_user_set 
ON practice_set_progress(user_id, set_id);

-- Add numeric column to practice_questions for proper sorting
ALTER TABLE practice_questions 
ADD COLUMN IF NOT EXISTS question_number_int INTEGER;

-- Populate numeric column from existing text values
UPDATE practice_questions 
SET question_number_int = CAST(question_number AS INTEGER)
WHERE question_number ~ '^\d+$' AND question_number_int IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_practice_questions_order 
ON practice_questions(set_id, question_number_int);