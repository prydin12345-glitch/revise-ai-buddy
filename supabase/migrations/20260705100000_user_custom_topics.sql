-- Custom topics a user adds beyond the presaved subject lists (e.g. from the
-- exam-profile topic picker). Surfaced in practice-quiz topic search.
CREATE TABLE IF NOT EXISTS public.user_custom_topics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name text NOT NULL,
  topic text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_name, topic)
);
ALTER TABLE public.user_custom_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own custom topics" ON public.user_custom_topics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
