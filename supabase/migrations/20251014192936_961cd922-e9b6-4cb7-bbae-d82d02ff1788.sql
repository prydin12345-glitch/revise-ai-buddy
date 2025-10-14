-- Create enum for exam types
CREATE TYPE exam_type AS ENUM ('uploaded', 'generated');
CREATE TYPE exam_status AS ENUM ('draft', 'analyzing', 'ready', 'published', 'in-progress', 'completed');

-- Create exams table
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type exam_type NOT NULL DEFAULT 'uploaded',
  status exam_status NOT NULL DEFAULT 'draft',
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create exam_topics table
CREATE TABLE public.exam_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  confidence_score DECIMAL(3,2)
);

-- Create exam_format table
CREATE TABLE public.exam_format (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE UNIQUE,
  use_original_structure BOOLEAN DEFAULT true,
  mcq_count INTEGER,
  mcq_marks_each INTEGER,
  short_answer_count INTEGER,
  short_answer_marks_each INTEGER,
  long_form_count INTEGER,
  long_form_marks_each INTEGER
);

-- Create exam_timer table
CREATE TABLE public.exam_timer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  duration_minutes INTEGER
);

-- Enable RLS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_format ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_timer ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exams
CREATE POLICY "Users can view own exams"
  ON public.exams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own exams"
  ON public.exams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exams"
  ON public.exams FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exams"
  ON public.exams FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for exam_topics
CREATE POLICY "Users can view own exam topics"
  ON public.exam_topics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_topics.exam_id 
    AND exams.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own exam topics"
  ON public.exam_topics FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_topics.exam_id 
    AND exams.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own exam topics"
  ON public.exam_topics FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_topics.exam_id 
    AND exams.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own exam topics"
  ON public.exam_topics FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_topics.exam_id 
    AND exams.user_id = auth.uid()
  ));

-- RLS Policies for exam_format
CREATE POLICY "Users can view own exam format"
  ON public.exam_format FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_format.exam_id 
    AND exams.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own exam format"
  ON public.exam_format FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_format.exam_id 
    AND exams.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own exam format"
  ON public.exam_format FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_format.exam_id 
    AND exams.user_id = auth.uid()
  ));

-- RLS Policies for exam_timer
CREATE POLICY "Users can view own exam timer"
  ON public.exam_timer FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_timer.exam_id 
    AND exams.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own exam timer"
  ON public.exam_timer FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_timer.exam_id 
    AND exams.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own exam timer"
  ON public.exam_timer FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_timer.exam_id 
    AND exams.user_id = auth.uid()
  ));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to exams table
CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for exam files
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-files', 'exam-files', false);

-- Storage policies for exam-files bucket
CREATE POLICY "Users can upload own exam files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exam-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own exam files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exam-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own exam files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exam-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );