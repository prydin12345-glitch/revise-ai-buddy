-- Add is_late column to exam_submissions for tracking late submissions
ALTER TABLE public.exam_submissions 
ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE;