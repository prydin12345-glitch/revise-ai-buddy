-- Create exam_submissions table
CREATE TABLE public.exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  time_taken_seconds INTEGER,
  total_score NUMERIC(5,2),
  total_marks INTEGER,
  status TEXT DEFAULT 'submitted',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

-- Enable RLS
ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for exam_submissions
CREATE POLICY "Students can insert their own submissions"
  ON public.exam_submissions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view their own submissions"
  ON public.exam_submissions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view submissions for their exams"
  ON public.exam_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = exam_submissions.exam_id
      AND exams.user_id = auth.uid()
    )
  );

-- Extend student_answers table with scoring columns
ALTER TABLE public.student_answers
ADD COLUMN score NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN feedback TEXT DEFAULT NULL,
ADD COLUMN is_correct BOOLEAN DEFAULT NULL;