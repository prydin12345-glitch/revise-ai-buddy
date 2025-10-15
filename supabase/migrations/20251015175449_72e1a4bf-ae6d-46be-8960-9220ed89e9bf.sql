-- Create exam_questions table
CREATE TABLE public.exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'short_answer', 'long_form')),
  question_text TEXT NOT NULL,
  marks INTEGER NOT NULL,
  options JSONB,
  correct_answer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_exam_questions_exam_id ON public.exam_questions(exam_id);

-- Enable RLS
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_questions
CREATE POLICY "Teachers can view their exam questions"
  ON public.exam_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = exam_questions.exam_id
      AND exams.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert questions"
  ON public.exam_questions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = exam_questions.exam_id
      AND exams.user_id = auth.uid()
    )
  );

-- Create student_answers table
CREATE TABLE public.student_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  answer_text TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(question_id, student_id)
);

-- Create indexes
CREATE INDEX idx_student_answers_exam_id ON public.student_answers(exam_id);
CREATE INDEX idx_student_answers_student_id ON public.student_answers(student_id);

-- Enable RLS
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for student_answers
CREATE POLICY "Students can view their own answers"
  ON public.student_answers
  FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own answers"
  ON public.student_answers
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own answers"
  ON public.student_answers
  FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view all answers for their exams"
  ON public.student_answers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = student_answers.exam_id
      AND exams.user_id = auth.uid()
    )
  );