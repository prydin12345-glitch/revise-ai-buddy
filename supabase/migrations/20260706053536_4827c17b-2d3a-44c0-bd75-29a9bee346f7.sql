-- Add insert_figures column to exams
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS insert_figures jsonb DEFAULT NULL;

-- Create user_custom_topics table
CREATE TABLE IF NOT EXISTS public.user_custom_topics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name text NOT NULL,
  topic text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_name, topic)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_topics TO authenticated;
GRANT ALL ON public.user_custom_topics TO service_role;

ALTER TABLE public.user_custom_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own custom topics" ON public.user_custom_topics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);