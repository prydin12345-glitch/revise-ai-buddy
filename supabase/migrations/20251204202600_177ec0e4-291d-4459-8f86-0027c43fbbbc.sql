-- Backfill missing user_profiles from auth.users
INSERT INTO public.user_profiles (id, first_name, last_name, display_name, student_code)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'first_name', 'Student'),
  au.raw_user_meta_data->>'last_name',
  COALESCE(
    au.raw_user_meta_data->>'display_name',
    TRIM(CONCAT(
      COALESCE(au.raw_user_meta_data->>'first_name', 'Student'),
      ' ',
      COALESCE(au.raw_user_meta_data->>'last_name', '')
    ))
  ),
  public.generate_student_code(
    au.raw_user_meta_data->>'first_name',
    au.raw_user_meta_data->>'last_name'
  )
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Backfill missing user_roles from auth.users
INSERT INTO public.user_roles (user_id, role, metadata)
SELECT 
  au.id,
  COALESCE(
    NULLIF(au.raw_user_meta_data->>'signup_role', '')::public.app_role,
    NULLIF(au.raw_user_meta_data->>'role', '')::public.app_role,
    'student'::public.app_role
  ),
  jsonb_build_object('is_primary', TRUE, 'signup_method', 'email', 'backfilled', TRUE)
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.id IS NULL
ON CONFLICT DO NOTHING;