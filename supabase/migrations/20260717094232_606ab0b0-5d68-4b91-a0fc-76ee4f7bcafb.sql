CREATE OR REPLACE FUNCTION public.validate_exam_profile_question_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.question_count IS NULL OR NEW.question_count < 1 OR NEW.question_count > 50 THEN
    RAISE EXCEPTION 'question_count must be between 1 and 50 (got %)', NEW.question_count;
  END IF;
  RETURN NEW;
END;
$function$;