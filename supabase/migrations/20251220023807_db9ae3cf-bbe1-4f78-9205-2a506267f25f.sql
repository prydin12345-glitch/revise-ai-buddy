-- Add table_answers column to student_answers table for structured table input
ALTER TABLE student_answers 
ADD COLUMN IF NOT EXISTS table_answers jsonb DEFAULT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN student_answers.table_answers IS 'Stores structured table cell answers as JSON, e.g., {"row1_col1": "10.0", "row2_col2": true}';

-- Create index for better query performance on table answers
CREATE INDEX IF NOT EXISTS idx_student_answers_table_answers ON student_answers USING gin(table_answers) WHERE table_answers IS NOT NULL;