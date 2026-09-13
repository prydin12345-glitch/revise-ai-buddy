CREATE OR REPLACE FUNCTION public.notify_students_on_exam_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam RECORD;
  v_student_id UUID;
  v_student_ids UUID[] := ARRAY[]::UUID[];
  v_tutor_name TEXT;
BEGIN
  SELECT e.id, e.title, e.assigned_by, e.user_id INTO v_exam
  FROM public.exams e WHERE e.id = NEW.exam_id;
  IF v_exam IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, first_name || ' ' || last_name, 'Your tutor')
  INTO v_tutor_name FROM public.user_profiles
  WHERE id = COALESCE(v_exam.assigned_by, v_exam.user_id);
  v_tutor_name := COALESCE(v_tutor_name, 'Your tutor');

  IF NEW.assignment_type IN ('student','individual') AND NEW.target_id IS NOT NULL THEN
    v_student_ids := array_append(v_student_ids, NEW.target_id);
  ELSIF NEW.assignment_type = 'group' AND NEW.target_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT gm.student_id), ARRAY[]::UUID[]) INTO v_student_ids
    FROM public.group_members gm WHERE gm.group_id = NEW.target_id AND gm.is_active = true;
  END IF;

  FOREACH v_student_id IN ARRAY COALESCE(v_student_ids, ARRAY[]::UUID[])
  LOOP
    PERFORM public.create_notification(
      p_user_id := v_student_id,
      p_type := 'exam_reminder',
      p_title := 'New Exam Assigned',
      p_body := format('%s assigned you "%s"', v_tutor_name, v_exam.title),
      p_link_url := format('/exam/%s/in-progress', NEW.exam_id),
      p_metadata := jsonb_build_object(
        'examId', NEW.exam_id, 'assignmentId', NEW.id,
        'groupId', CASE WHEN NEW.assignment_type = 'group' THEN NEW.target_id ELSE NULL END,
        'deadline', NEW.deadline, 'assignedBy', NEW.assigned_by),
      p_source_user_id := NEW.assigned_by,
      p_source_role := 'tutor',
      p_recipient_role := 'student');
  END LOOP;
  RETURN NEW;
END $$;