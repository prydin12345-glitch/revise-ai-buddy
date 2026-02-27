
-- Create subject_master_topics table
CREATE TABLE public.subject_master_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_name TEXT NOT NULL,
  topic TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject_name, topic)
);

ALTER TABLE public.subject_master_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own master topics"
  ON public.subject_master_topics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own master topics"
  ON public.subject_master_topics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own master topics"
  ON public.subject_master_topics FOR DELETE
  USING (auth.uid() = user_id);

-- Create subject_exam_profiles table
CREATE TABLE public.subject_exam_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_name TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  topics TEXT[] NOT NULL DEFAULT '{}',
  question_count INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_exam_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exam profiles"
  ON public.subject_exam_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exam profiles"
  ON public.subject_exam_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exam profiles"
  ON public.subject_exam_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exam profiles"
  ON public.subject_exam_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at on exam profiles
CREATE TRIGGER update_subject_exam_profiles_updated_at
  BEFORE UPDATE ON public.subject_exam_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger for question_count (5-50)
CREATE OR REPLACE FUNCTION public.validate_exam_profile_question_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.question_count < 5 OR NEW.question_count > 50 THEN
    RAISE EXCEPTION 'question_count must be between 5 and 50';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_exam_profile_question_count
  BEFORE INSERT OR UPDATE ON public.subject_exam_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_exam_profile_question_count();
