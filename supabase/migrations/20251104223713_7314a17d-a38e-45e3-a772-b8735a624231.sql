-- Add subject detection columns to exams table
ALTER TABLE exams 
ADD COLUMN IF NOT EXISTS detected_subject TEXT,
ADD COLUMN IF NOT EXISTS subject_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS subject_mismatch BOOLEAN DEFAULT FALSE;

-- Add index for faster queries on mismatched exams
CREATE INDEX IF NOT EXISTS idx_exams_subject_mismatch 
ON exams(subject_mismatch) 
WHERE subject_mismatch = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN exams.detected_subject IS 'AI-detected subject from PDF content (e.g., Physics, Mathematics)';
COMMENT ON COLUMN exams.subject_confidence IS 'Confidence score (0.0-1.0) for detected subject';
COMMENT ON COLUMN exams.subject_mismatch IS 'TRUE if detected_subject differs from user-selected subject_id';