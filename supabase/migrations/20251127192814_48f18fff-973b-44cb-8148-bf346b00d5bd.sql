-- Create security definer function to check if a user is a member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND student_id = _student_id
      AND is_active = true
  )
$$;

-- Create security definer function to check if a user is the tutor of a group
CREATE OR REPLACE FUNCTION public.is_group_tutor(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_groups
    WHERE id = _group_id
      AND tutor_id = _user_id
  )
$$;

-- Drop and recreate the student_groups SELECT policy to use the security definer function
DROP POLICY IF EXISTS "Students view assigned groups" ON public.student_groups;
CREATE POLICY "Students view assigned groups" ON public.student_groups
FOR SELECT
USING (public.is_group_member(id, auth.uid()));

-- Drop and recreate the group_members ALL policy to use the security definer function
DROP POLICY IF EXISTS "Tutors manage group members" ON public.group_members;
CREATE POLICY "Tutors manage group members" ON public.group_members
FOR ALL
USING (public.is_group_tutor(group_id, auth.uid()))
WITH CHECK (public.is_group_tutor(group_id, auth.uid()));