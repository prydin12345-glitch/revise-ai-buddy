-- Drop and recreate the view with explicit SECURITY INVOKER
-- This ensures the view respects the RLS policies of the querying user, not the view creator

DROP VIEW IF EXISTS public.student_profiles_safe;

CREATE VIEW public.student_profiles_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  first_name,
  last_name,
  display_name,
  avatar_url,
  student_code,
  created_at
FROM public.user_profiles;

-- Add comment to document the view's purpose
COMMENT ON VIEW public.student_profiles_safe IS 'Safe view of user_profiles for tutor access. Excludes sensitive PII like phone_number, date_of_birth, country, timezone. Uses SECURITY INVOKER to respect RLS of querying user.';

-- Grant SELECT to authenticated users
GRANT SELECT ON public.student_profiles_safe TO authenticated;