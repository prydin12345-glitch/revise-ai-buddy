-- Add RLS policy to allow students to join groups (insert themselves as members)
CREATE POLICY "Students can join groups"
ON public.group_members
FOR INSERT
TO public
WITH CHECK (
  student_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.student_groups
    WHERE id = group_members.group_id
    AND is_active = true
  )
);