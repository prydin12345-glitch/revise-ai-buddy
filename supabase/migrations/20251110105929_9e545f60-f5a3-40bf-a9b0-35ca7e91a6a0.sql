-- Add last_accessed_at field to exam_submissions for tracking when users last interacted with exams
ALTER TABLE exam_submissions 
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now();