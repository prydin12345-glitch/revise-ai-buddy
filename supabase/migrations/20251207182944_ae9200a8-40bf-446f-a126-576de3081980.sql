-- Add UPDATE policy for students on exam_submissions
-- This allows students to update their in-progress submissions (for saving progress)
CREATE POLICY "Students can update their own in_progress submissions"
ON public.exam_submissions
FOR UPDATE
USING (auth.uid() = student_id AND status = 'in_progress')
WITH CHECK (auth.uid() = student_id AND status = 'in_progress');