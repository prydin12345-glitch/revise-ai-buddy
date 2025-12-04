-- Create security definer function to check exam ownership (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.user_owns_exam(_user_id uuid, _exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exams
    WHERE id = _exam_id AND user_id = _user_id
  )
$$;

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Teachers create exam assignments" ON exam_assignments;

-- Create new policy using the SECURITY DEFINER function
CREATE POLICY "Teachers create exam assignments" ON exam_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_by = auth.uid()
  AND (has_role(auth.uid(), 'teacher') OR has_role(auth.uid(), 'tutor'))
  AND user_owns_exam(auth.uid(), exam_id)
);