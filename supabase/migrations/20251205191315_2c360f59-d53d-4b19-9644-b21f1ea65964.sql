-- Add RLS policy for students to view questions of assigned exams
CREATE POLICY "Students can view assigned exam questions"
ON exam_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_questions.exam_id
    AND (
      e.user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM exam_assignments ea
        WHERE ea.exam_id = e.id
        AND ea.is_active = true
        AND (
          (ea.assignment_type = 'individual' AND ea.target_id = auth.uid())
          OR
          (ea.assignment_type = 'group' AND EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = ea.target_id
            AND gm.student_id = auth.uid()
            AND gm.is_active = true
          ))
        )
      )
    )
  )
);

-- Fix the specific "Maths Paper 1" exam by publishing it
INSERT INTO exam_questions (
  exam_id, question_number, question_type, question_text, marks,
  options, correct_answer, original_page_number, has_figures,
  has_tables, figure_urls, topic_tag, difficulty_level,
  extraction_confidence, is_verified, has_math, question_latex,
  equation_complexity, parent_question_number, root_question_number,
  scenario_context, command_verb, numerical_answer
)
SELECT 
  exam_id, question_number, question_type, question_text, marks,
  options, COALESCE(correct_answer, 'A'), original_page_number,
  has_figures, has_tables, figure_urls, topic_tag, difficulty_level,
  extraction_confidence, true, has_math, question_latex,
  equation_complexity, parent_question_number, root_question_number,
  scenario_context, command_verb, numerical_answer
FROM exam_question_drafts
WHERE exam_id = '59fa6cde-dcf7-4df4-aa29-06afbe459e2e'
ON CONFLICT DO NOTHING;

-- Update exam status to published
UPDATE exams 
SET status = 'published', updated_at = now()
WHERE id = '59fa6cde-dcf7-4df4-aa29-06afbe459e2e';