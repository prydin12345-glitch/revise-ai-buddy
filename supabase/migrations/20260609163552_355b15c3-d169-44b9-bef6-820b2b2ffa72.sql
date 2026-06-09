ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS generation_method TEXT,
  ADD COLUMN IF NOT EXISTS source_pdf_name TEXT,
  ADD COLUMN IF NOT EXISTS questions_filtered_count INTEGER DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exams_generation_method_check'
  ) THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_generation_method_check
      CHECK (generation_method IS NULL OR generation_method IN ('pdf_inspired','topic_based','manual'));
  END IF;
END $$;