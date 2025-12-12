-- Allow tutors to view exam questions for exams they assigned
CREATE POLICY "Tutors can view assigned exam questions" 
ON exam_questions
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_questions.exam_id
    AND e.assigned_by = auth.uid()
  )
);

-- Allow tutors to view student answers for exams they assigned  
CREATE POLICY "Tutors can view answers for assigned exams" 
ON student_answers
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = student_answers.exam_id
    AND e.assigned_by = auth.uid()
  )
);