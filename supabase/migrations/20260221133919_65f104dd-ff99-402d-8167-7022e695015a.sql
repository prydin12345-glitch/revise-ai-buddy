-- Allow graph question types in exam_questions table
ALTER TABLE public.exam_questions DROP CONSTRAINT exam_questions_question_type_check;
ALTER TABLE public.exam_questions ADD CONSTRAINT exam_questions_question_type_check 
  CHECK (question_type = ANY (ARRAY['mcq'::text, 'short_answer'::text, 'long_form'::text, 'graph_plotting'::text, 'graph_interpretation'::text, 'bearings'::text, 'table_grid'::text]));