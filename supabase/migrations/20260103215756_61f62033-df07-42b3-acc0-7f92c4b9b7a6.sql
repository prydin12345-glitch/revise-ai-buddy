-- Add answer_latex column to practice_question_answers table
-- This stores the canonical LaTeX representation of math answers
ALTER TABLE public.practice_question_answers 
ADD COLUMN IF NOT EXISTS answer_latex TEXT;

-- Add comment explaining the columns
COMMENT ON COLUMN public.practice_question_answers.answer_latex IS 'Canonical LaTeX representation of the answer (primary for math)';
COMMENT ON COLUMN public.practice_question_answers.answer_text IS 'Plain text representation or fallback (for display/search)';