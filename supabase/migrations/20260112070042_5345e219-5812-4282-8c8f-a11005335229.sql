-- Fix permissive INSERT policy on schools table
-- Only verified teachers should be able to create schools

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Teachers can create schools" ON public.schools;

-- Create a more restrictive policy requiring teacher role
CREATE POLICY "Teachers with role can create schools" 
ON public.schools 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- User must have the teacher role
  public.has_role(auth.uid(), 'teacher')
);

-- Add comment explaining the security rationale
COMMENT ON POLICY "Teachers with role can create schools" ON public.schools IS 
'Only authenticated users with teacher role can create schools. This prevents arbitrary school creation by non-teachers.';