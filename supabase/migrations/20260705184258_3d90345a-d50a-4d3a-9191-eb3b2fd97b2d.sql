
-- 1. Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.create_deadline_change_notifications(uuid, text, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_group_announcement_notifications(uuid, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb, uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_student_notification(uuid, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_student_code(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_signup() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_teacher_verification_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_tutor(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_student_on_feedback_response() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_students_on_exam_release() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_students_on_grades_release() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_tutor_on_feedback_created() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_tutor_on_feedback_resolved() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_revision_task_modified() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_owns_exam(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_invite_code(text) FROM anon;

-- 2. Schools
DROP POLICY IF EXISTS "Users can view schools" ON public.schools;

CREATE OR REPLACE FUNCTION public.ensure_school(p_name text, p_domain text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'School name required';
  END IF;

  SELECT id INTO v_id FROM public.schools WHERE name = p_name LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.schools (name, domain, is_active)
  VALUES (p_name, NULLIF(p_domain, ''), true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_school(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_school(text, text) TO authenticated;

-- 3. Student groups: remove broad invite-code read; extend validate_invite_code
DROP POLICY IF EXISTS "Authenticated users can view groups by invite code" ON public.student_groups;

DROP FUNCTION IF EXISTS public.validate_invite_code(text);

CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code text)
RETURNS TABLE(
  group_id uuid,
  group_name text,
  description text,
  settings jsonb,
  subjects_covered jsonb,
  capacity integer,
  tutor_id uuid,
  tutor_display_name text,
  member_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sg.id,
    sg.name,
    sg.description,
    sg.settings,
    sg.subjects_covered,
    sg.capacity,
    sg.tutor_id,
    COALESCE(up.display_name,
             NULLIF(trim(concat_ws(' ', up.first_name, up.last_name)), ''),
             'Tutor') AS tutor_display_name,
    (SELECT count(*) FROM public.group_members gm
       WHERE gm.group_id = sg.id AND gm.is_active = true) AS member_count
  FROM public.student_groups sg
  LEFT JOIN public.user_profiles up ON up.id = sg.tutor_id
  WHERE sg.invite_code = p_code
    AND sg.is_active = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO authenticated;

-- 4. user_roles insert path
DROP POLICY IF EXISTS "Only system can insert roles" ON public.user_roles;

CREATE POLICY "Only admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMENT ON TABLE public.user_roles IS
  'Role grants. Client inserts require admin; signup role assignment runs via SECURITY DEFINER trigger handle_new_user_signup which bypasses RLS.';
