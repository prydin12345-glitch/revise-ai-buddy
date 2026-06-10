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