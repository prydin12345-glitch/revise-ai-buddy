
CREATE TABLE IF NOT EXISTS public.student_cache_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  base_cache_key text NOT NULL,
  last_slot_used integer DEFAULT 0,
  slots_exhausted boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, base_cache_key)
);

CREATE INDEX idx_student_cache_slots_lookup ON public.student_cache_slots (user_id, base_cache_key);

ALTER TABLE public.student_cache_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cache slots"
  ON public.student_cache_slots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cache slots"
  ON public.student_cache_slots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cache slots"
  ON public.student_cache_slots FOR UPDATE
  USING (auth.uid() = user_id);
