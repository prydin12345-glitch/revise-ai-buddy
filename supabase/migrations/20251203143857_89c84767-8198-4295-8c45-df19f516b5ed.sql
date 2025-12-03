-- First, clean up orphaned group_members records
DELETE FROM public.group_members 
WHERE student_id NOT IN (SELECT id FROM public.user_profiles);

-- Now add the foreign key constraint
ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_student_id_fkey;

ALTER TABLE public.group_members
ADD CONSTRAINT group_members_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- Update RLS policy for user_profiles to allow tutors to view their students
DROP POLICY IF EXISTS "Users manage own profile" ON public.user_profiles;

-- Policy for users to manage their own profile
CREATE POLICY "Users can manage own profile"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy for tutors to view students in their groups
CREATE POLICY "Tutors can view students in their groups"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM group_members gm
    JOIN student_groups sg ON sg.id = gm.group_id
    WHERE gm.student_id = user_profiles.id
      AND gm.is_active = true
      AND sg.tutor_id = auth.uid()
      AND sg.is_active = true
  )
);