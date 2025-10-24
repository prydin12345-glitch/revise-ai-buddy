-- Add math support columns to exam_question_drafts
ALTER TABLE exam_question_drafts 
ADD COLUMN IF NOT EXISTS question_latex TEXT,
ADD COLUMN IF NOT EXISTS has_math BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS equation_complexity TEXT,
ADD COLUMN IF NOT EXISTS parent_question_number TEXT,
ADD COLUMN IF NOT EXISTS root_question_number TEXT;

-- Add math support columns to exam_questions
ALTER TABLE exam_questions 
ADD COLUMN IF NOT EXISTS question_latex TEXT,
ADD COLUMN IF NOT EXISTS has_math BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS equation_complexity TEXT,
ADD COLUMN IF NOT EXISTS parent_question_number TEXT,
ADD COLUMN IF NOT EXISTS root_question_number TEXT;

-- Add comment for equation_complexity values
COMMENT ON COLUMN exam_question_drafts.equation_complexity IS 'Values: simple, medium, complex';
COMMENT ON COLUMN exam_questions.equation_complexity IS 'Values: simple, medium, complex';