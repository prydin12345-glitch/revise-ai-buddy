-- Create practice_question_answers table for storing graded answers
CREATE TABLE IF NOT EXISTS public.practice_question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  set_id UUID NOT NULL REFERENCES public.practice_question_sets(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.practice_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  working_out TEXT,
  score DECIMAL(5,2) DEFAULT 0,
  method_marks DECIMAL(5,2),
  accuracy_marks DECIMAL(5,2),
  is_correct BOOLEAN DEFAULT false,
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- Add worked_solution column to practice_questions
ALTER TABLE public.practice_questions 
ADD COLUMN IF NOT EXISTS worked_solution TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_answers_user_set ON public.practice_question_answers(user_id, set_id);
CREATE INDEX IF NOT EXISTS idx_practice_answers_question ON public.practice_question_answers(question_id);

-- Enable RLS
ALTER TABLE public.practice_question_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own practice answers"
  ON public.practice_question_answers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own practice answers"
  ON public.practice_question_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice answers"
  ON public.practice_question_answers FOR UPDATE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_practice_question_answers_updated_at
  BEFORE UPDATE ON public.practice_question_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();