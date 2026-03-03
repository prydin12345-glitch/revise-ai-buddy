
-- Create tutor_question_bank table
CREATE TABLE public.tutor_question_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id UUID NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'short_answer',
  expected_answer TEXT,
  max_marks INTEGER NOT NULL DEFAULT 1,
  topic_tag TEXT,
  subject_name TEXT NOT NULL,
  options JSONB,
  marking_preference TEXT NOT NULL DEFAULT 'ai_assisted',
  estimated_minutes INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_question_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors can view own questions" ON public.tutor_question_bank FOR SELECT USING (auth.uid() = tutor_id);
CREATE POLICY "Tutors can create own questions" ON public.tutor_question_bank FOR INSERT WITH CHECK (auth.uid() = tutor_id);
CREATE POLICY "Tutors can update own questions" ON public.tutor_question_bank FOR UPDATE USING (auth.uid() = tutor_id);
CREATE POLICY "Tutors can delete own questions" ON public.tutor_question_bank FOR DELETE USING (auth.uid() = tutor_id);

CREATE TRIGGER update_tutor_question_bank_updated_at
  BEFORE UPDATE ON public.tutor_question_bank
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create tutor_manual_exams table
CREATE TABLE public.tutor_manual_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id UUID NOT NULL,
  title TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  subject_color TEXT DEFAULT '#3B82F6',
  marking_preference TEXT NOT NULL DEFAULT 'ai_assisted',
  educational_tier TEXT,
  question_ids UUID[] NOT NULL DEFAULT '{}',
  total_marks INTEGER DEFAULT 0,
  estimated_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_manual_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors can view own manual exams" ON public.tutor_manual_exams FOR SELECT USING (auth.uid() = tutor_id);
CREATE POLICY "Tutors can create own manual exams" ON public.tutor_manual_exams FOR INSERT WITH CHECK (auth.uid() = tutor_id);
CREATE POLICY "Tutors can update own manual exams" ON public.tutor_manual_exams FOR UPDATE USING (auth.uid() = tutor_id);
CREATE POLICY "Tutors can delete own manual exams" ON public.tutor_manual_exams FOR DELETE USING (auth.uid() = tutor_id);

CREATE TRIGGER update_tutor_manual_exams_updated_at
  BEFORE UPDATE ON public.tutor_manual_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
