-- Add missing RLS policies for admin functionality

-- Allow admins to view all teacher verifications
CREATE POLICY "Admins view all verifications"
ON public.teacher_verifications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to update verification status
CREATE POLICY "Admins update verifications"
ON public.teacher_verifications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow authenticated users to insert schools (during teacher verification)
CREATE POLICY "Teachers can create schools"
ON public.schools
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anyone to view schools for verification purposes
CREATE POLICY "Users can view schools"
ON public.schools
FOR SELECT
TO authenticated
USING (true);

-- Allow teachers to update their exam assignments
CREATE POLICY "Teachers update own assignments"
ON public.exam_assignments
FOR UPDATE
TO authenticated
USING (assigned_by = auth.uid())
WITH CHECK (assigned_by = auth.uid());