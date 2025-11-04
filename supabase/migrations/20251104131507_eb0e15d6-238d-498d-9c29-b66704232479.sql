-- Add timer persistence fields to exam_submissions
ALTER TABLE exam_submissions 
ADD COLUMN IF NOT EXISTS time_remaining_seconds INTEGER,
ADD COLUMN IF NOT EXISTS exam_started_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries on in-progress exams
CREATE INDEX IF NOT EXISTS idx_exam_submissions_in_progress 
ON exam_submissions(exam_id, student_id, status) 
WHERE status = 'in_progress';