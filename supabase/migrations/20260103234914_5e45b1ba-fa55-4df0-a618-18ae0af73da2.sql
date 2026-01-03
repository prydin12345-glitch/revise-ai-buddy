-- Add is_flagged column to student_answers table for flag persistence
ALTER TABLE public.student_answers 
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;

-- Add flagged_at timestamp for when it was flagged
ALTER TABLE public.student_answers 
ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

-- Create index for efficient queries on flagged answers
CREATE INDEX IF NOT EXISTS idx_student_answers_flagged 
ON public.student_answers(exam_id, is_flagged) 
WHERE is_flagged = true;