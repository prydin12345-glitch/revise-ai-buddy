-- Allow anyone to view active groups by invite code (for joining)
CREATE POLICY "Anyone can view groups by invite code"
ON public.student_groups
FOR SELECT
TO public
USING (is_active = true AND invite_code IS NOT NULL);