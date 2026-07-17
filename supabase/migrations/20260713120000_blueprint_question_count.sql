-- Blueprint profiles can legitimately define papers with fewer than 5
-- questions (e.g. an A-level History paper: one 30-mark interpretations
-- question plus two 25-mark essays). Relax the pre-blueprint 5-50 guard to
-- 1-50; generation counts are governed by the paper blueprint when present.
CREATE OR REPLACE FUNCTION public.validate_exam_profile_question_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.question_count IS NULL OR NEW.question_count < 1 OR NEW.question_count > 50 THEN
    RAISE EXCEPTION 'question_count must be between 1 and 50';
  END IF;
  RETURN NEW;
END;
$$;
