-- Add answer_latex column to student_answers table for persisting math input
ALTER TABLE public.student_answers 
ADD COLUMN IF NOT EXISTS answer_latex TEXT NULL;

-- Add answer_format column to track which format was used
ALTER TABLE public.student_answers 
ADD COLUMN IF NOT EXISTS answer_format TEXT NULL DEFAULT 'text';

-- Add a comment for documentation
COMMENT ON COLUMN public.student_answers.answer_latex IS 'LaTeX representation of the answer for math input';
COMMENT ON COLUMN public.student_answers.answer_format IS 'Format of the answer: text or latex';