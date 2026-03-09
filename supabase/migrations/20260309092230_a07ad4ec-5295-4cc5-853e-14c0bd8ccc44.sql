
-- Topic aliases table for normalizing dirty topic tags to canonical names
CREATE TABLE public.topic_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  canonical_topic text NOT NULL,
  subject text,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_topic_aliases_alias_lower ON public.topic_aliases (lower(alias));
CREATE INDEX idx_topic_aliases_subject ON public.topic_aliases (subject);

-- Unique constraint to prevent duplicate aliases per subject
CREATE UNIQUE INDEX idx_topic_aliases_unique ON public.topic_aliases (lower(alias), COALESCE(subject, ''));

-- RLS: readable by all authenticated users, writable by service role only
ALTER TABLE public.topic_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read topic aliases"
  ON public.topic_aliases FOR SELECT
  TO authenticated
  USING (true);
