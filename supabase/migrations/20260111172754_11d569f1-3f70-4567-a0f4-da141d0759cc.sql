-- Fix feedback_tags public exposure
-- Drop the overly permissive policy that allows any authenticated user to read all tags
DROP POLICY IF EXISTS "Tutors can view feedback tags" ON public.feedback_tags;

-- Create a restrictive policy that only allows tutors to view feedback tags for their own exams
CREATE POLICY "Tutors can view own feedback tags"
ON public.feedback_tags FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.question_feedback_threads qft
    JOIN public.exams e ON e.id = qft.exam_id
    WHERE qft.id = feedback_tags.thread_id
      AND (e.user_id = auth.uid() OR e.assigned_by = auth.uid())
  )
);