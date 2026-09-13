-- PENDING — NOT APPLIED.
-- Batch 1: explicit assessment tier + stored generation context.
--
-- Held here rather than in supabase/migrations/ because that folder is owned
-- by the migration tool and cannot be hand-written. Apply this SQL through the
-- migration workflow when approved; it will then be written there.
--
-- Additive only. No new tables, so no new GRANTs are required: column
-- privileges follow the table, and the existing owner-scoped RLS policies on
-- subject_exam_profiles, exams and practice_question_sets apply unchanged to
-- these new columns.
--
-- `assessment_tier` is INDEPENDENT of `educational_tier` (the qualification
-- level). Existing rows stay NULL, which means "unknown / not recorded" — no
-- tier is inferred for any historical profile.

ALTER TABLE public.subject_exam_profiles
  ADD COLUMN IF NOT EXISTS assessment_tier text;

ALTER TABLE public.subject_exam_profiles
  DROP CONSTRAINT IF EXISTS subject_exam_profiles_assessment_tier_check;

ALTER TABLE public.subject_exam_profiles
  ADD CONSTRAINT subject_exam_profiles_assessment_tier_check
  CHECK (
    assessment_tier IS NULL
    OR assessment_tier IN ('foundation', 'higher', 'not_tiered')
  );

-- Resolved course snapshot stamped on an attempt at creation time, so later
-- profile edits never change a past exam or practice set.
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS generation_context jsonb;

ALTER TABLE public.practice_question_sets
  ADD COLUMN IF NOT EXISTS generation_context jsonb;

COMMENT ON COLUMN public.subject_exam_profiles.assessment_tier IS
  'Foundation/Higher/not_tiered assessment tier. NULL = unknown (legacy). Independent of educational_tier.';
COMMENT ON COLUMN public.exams.generation_context IS
  'Server-resolved course snapshot (board, qualification, assessment tier) captured when the attempt was created.';
COMMENT ON COLUMN public.practice_question_sets.generation_context IS
  'Server-resolved course snapshot (board, qualification, assessment tier) captured when the attempt was created.';

-- ---------------------------------------------------------------------------
-- Database boundary: generation_context is server-owned.
--
-- The JSON marker `resolved_by: "server"` must NOT be what establishes trust.
-- An authenticated client can neither insert a forged snapshot, nor overwrite
-- or clear an established one. Ordinary owner-authorised edits to every other
-- column keep working exactly as before. Only the trusted backend (service
-- role / migration owner) may create or change the snapshot.

CREATE OR REPLACE FUNCTION public.guard_generation_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_trusted boolean;
BEGIN
  v_trusted :=
    coalesce(auth.role(), '') = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'service_role');
  -- Deliberately SECURITY INVOKER: the guard must see the CALLER's role.

  IF v_trusted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.generation_context IS NOT NULL THEN
      RAISE EXCEPTION 'generation_context is managed by the server'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.generation_context IS DISTINCT FROM OLD.generation_context THEN
    RAISE EXCEPTION 'generation_context is managed by the server'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_generation_context ON public.exams;
CREATE TRIGGER guard_generation_context
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.guard_generation_context();

DROP TRIGGER IF EXISTS guard_generation_context ON public.practice_question_sets;
CREATE TRIGGER guard_generation_context
  BEFORE INSERT OR UPDATE ON public.practice_question_sets
  FOR EACH ROW EXECUTE FUNCTION public.guard_generation_context();
