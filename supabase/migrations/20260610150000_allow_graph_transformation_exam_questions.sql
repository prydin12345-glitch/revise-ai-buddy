-- FILE: supabase/migrations/20260610150000_allow_graph_transformation_exam_questions.sql
-- =============================================================================
-- Allow graph_transformation in exam_questions
-- =============================================================================
-- The application fully supports graph_transformation questions (the exam
-- player renders them and publish-exam deliberately maps AI variants to this
-- type), but the database CHECK constraint was never updated when the feature
-- was added. Result: any uploaded exam containing one transformation question
-- failed to publish entirely — Postgres rejected the row (error 23514) and
-- aborted the whole insert batch, leaving the exam empty on My Exams.
--
-- This brings the constraint in line with publish-exam's validQuestionTypes.
-- =============================================================================

ALTER TABLE public.exam_questions DROP CONSTRAINT exam_questions_question_type_check;

ALTER TABLE public.exam_questions ADD CONSTRAINT exam_questions_question_type_check
  CHECK (question_type = ANY (ARRAY[
    'mcq'::text,
    'short_answer'::text,
    'long_form'::text,
    'graph_plotting'::text,
    'graph_interpretation'::text,
    'graph_transformation'::text,
    'bearings'::text,
    'table_grid'::text
  ]));
