-- Fix PUBLIC_DATA_EXPOSURE: Tutoring Groups Publicly Accessible
-- Drop the insecure policy that allows unauthenticated access
DROP POLICY IF EXISTS "Anyone can view groups by invite code" ON public.student_groups;

-- Create a new policy that requires authentication for group lookups by invite code
CREATE POLICY "Authenticated users can view groups by invite code"
ON public.student_groups
FOR SELECT
TO authenticated
USING (is_active = true AND invite_code IS NOT NULL);

-- Create a secure RPC function for validating invite codes that returns minimal data
-- This is safer than exposing the full table through RLS
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS TABLE(
  group_id UUID, 
  group_name TEXT, 
  tutor_display_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sg.id,
    sg.name,
    COALESCE(up.display_name, 'Tutor')
  FROM student_groups sg
  LEFT JOIN user_profiles up ON up.id = sg.tutor_id
  WHERE sg.invite_code = p_code
    AND sg.is_active = true
  LIMIT 1;
$$;

-- Grant execute to authenticated users only (not public/anon)
GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO authenticated;