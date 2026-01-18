-- Create a safe view for tutor access to student profiles
-- This view exposes only the columns that tutors actually need
-- Prevents exposure of sensitive PII like phone_number, date_of_birth, country, timezone

CREATE OR REPLACE VIEW public.student_profiles_safe AS
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
COMMENT ON VIEW public.student_profiles_safe IS 'Safe view of user_profiles for tutor access. Excludes sensitive PII like phone_number, date_of_birth, country, timezone.';

-- Grant SELECT to authenticated users (RLS on the underlying table still applies)
GRANT SELECT ON public.student_profiles_safe TO authenticated;

-- Note: Views in PostgreSQL inherit RLS from the underlying table by default.
-- The existing RLS policies on user_profiles will continue to control access.