-- Fix CLIENT_SIDE_AUTH: Tutors Can Send Notifications to Any User Without Authorization
-- This vulnerability allows any authenticated user to insert notifications for any other user

-- Step 1: Drop the insecure INSERT policy that checks the wrong field
DROP POLICY IF EXISTS "Users can create their own notifications" ON public.notifications;

-- Step 2: Create a secure RPC for group announcement notifications
-- This validates the caller is the tutor of the group before creating notifications
CREATE OR REPLACE FUNCTION public.create_group_announcement_notifications(
  p_group_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_action_data JSONB DEFAULT NULL
)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_student_id UUID;
BEGIN
  -- Verify caller is tutor of this group
  IF NOT EXISTS (
    SELECT 1 FROM public.student_groups
    WHERE id = p_group_id AND tutor_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to send notifications to this group';
  END IF;
  
  -- Insert notifications for all active group members and return their IDs
  FOR v_student_id IN
    SELECT gm.student_id
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id AND gm.is_active = true
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, action_data)
    VALUES (v_student_id, p_type, p_title, p_body, p_action_data)
    RETURNING id INTO v_notification_id;
    
    RETURN NEXT v_notification_id;
  END LOOP;
  
  RETURN;
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.create_group_announcement_notifications(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Step 3: Create a secure RPC for deadline change notifications
-- This validates the caller owns or is assigned_by on the exam before creating notifications
CREATE OR REPLACE FUNCTION public.create_deadline_change_notifications(
  p_exam_id UUID,
  p_exam_title TEXT,
  p_new_deadline TIMESTAMPTZ
)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_student_id UUID;
  v_assignment RECORD;
  v_deadline_text TEXT;
BEGIN
  -- Verify caller owns this exam or is the assigned_by user
  IF NOT EXISTS (
    SELECT 1 FROM public.exams
    WHERE id = p_exam_id AND (user_id = auth.uid() OR assigned_by = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to send notifications for this exam';
  END IF;
  
  -- Format deadline for notification body
  v_deadline_text := to_char(p_new_deadline AT TIME ZONE 'UTC', 'Mon DD, YYYY "at" HH12:MI AM');
  
  -- Collect all student IDs from assignments
  FOR v_assignment IN
    SELECT target_id, assignment_type
    FROM public.exam_assignments
    WHERE exam_id = p_exam_id AND is_active = true
  LOOP
    IF v_assignment.assignment_type = 'group' AND v_assignment.target_id IS NOT NULL THEN
      -- Get all students in the group
      FOR v_student_id IN
        SELECT gm.student_id
        FROM public.group_members gm
        WHERE gm.group_id = v_assignment.target_id AND gm.is_active = true
      LOOP
        INSERT INTO public.notifications (user_id, type, title, body, action_data)
        VALUES (
          v_student_id,
          'deadline_changed',
          'Exam Deadline Updated',
          format('The deadline for "%s" has been changed to %s', p_exam_title, v_deadline_text),
          jsonb_build_object('exam_id', p_exam_id, 'new_deadline', p_new_deadline)
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_notification_id;
        
        IF v_notification_id IS NOT NULL THEN
          RETURN NEXT v_notification_id;
        END IF;
      END LOOP;
    ELSIF (v_assignment.assignment_type = 'individual' OR v_assignment.assignment_type = 'student') AND v_assignment.target_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, action_data)
      VALUES (
        v_assignment.target_id,
        'deadline_changed',
        'Exam Deadline Updated',
        format('The deadline for "%s" has been changed to %s', p_exam_title, v_deadline_text),
        jsonb_build_object('exam_id', p_exam_id, 'new_deadline', p_new_deadline)
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_notification_id;
      
      IF v_notification_id IS NOT NULL THEN
        RETURN NEXT v_notification_id;
      END IF;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.create_deadline_change_notifications(UUID, TEXT, TIMESTAMPTZ) TO authenticated;