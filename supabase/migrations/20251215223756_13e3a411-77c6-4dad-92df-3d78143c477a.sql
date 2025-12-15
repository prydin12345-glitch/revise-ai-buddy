-- Add exam settings columns for advanced options
ALTER TABLE exams ADD COLUMN IF NOT EXISTS allow_retakes BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS show_feedback_per_question BOOLEAN DEFAULT true;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS time_limit_per_question INTEGER;

-- Add mark visibility columns to exam_assignments
ALTER TABLE exam_assignments ADD COLUMN IF NOT EXISTS marks_visibility TEXT DEFAULT 'immediate';
ALTER TABLE exam_assignments ADD COLUMN IF NOT EXISTS marks_release_date TIMESTAMP WITH TIME ZONE;