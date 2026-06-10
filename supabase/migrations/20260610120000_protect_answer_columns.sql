-- =============================================================================
-- Protect answer columns on practice_questions
-- =============================================================================
-- Problem: even with the app fetching questions through the secure
-- get-practice-questions edge function, a determined student could query the
-- database directly from the browser console using the public anon key and
-- read correct_answer / worked_solution / rationale.
--
-- Fix: remove table-wide SELECT from browser roles and re-grant only the
-- safe columns. Edge functions are unaffected (they use the service role).
--
-- NOTE: if a new column is ever added to practice_questions and the app needs
-- to read it directly from the browser, it must be added to the GRANT list
-- below. Reads through edge functions need no change.
-- =============================================================================

REVOKE SELECT ON public.practice_questions FROM authenticated, anon;

GRANT SELECT (
  id,
  set_id,
  question_number,
  question_number_int,
  question_text,
  question_latex,
  question_type,
  marks,
  options,
  diagram_config,
  difficulty_level,
  equation_complexity,
  has_math,
  subtopic,
  resource_item_ids,
  resource_references,
  created_at
) ON public.practice_questions TO authenticated;
