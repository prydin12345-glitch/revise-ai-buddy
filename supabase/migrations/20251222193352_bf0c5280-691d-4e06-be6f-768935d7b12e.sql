-- =====================================================
-- NOTIFICATION SYSTEM FIX - SCHEMA + TRIGGERS
-- =====================================================

-- 1) EXTEND NOTIFICATIONS TABLE with missing columns
-- =====================================================
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS link_url TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recipient_role TEXT,
ADD COLUMN IF NOT EXISTS source_user_id UUID,
ADD COLUMN IF NOT EXISTS source_role TEXT;

-- 2) ADD INDEXES for efficient queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications(user_id, is_read) 
WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_type_created 
ON public.notifications(type, created_at DESC);

-- 3) ENABLE REALTIME for notifications table
-- =====================================================
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 4) HELPER FUNCTION: Create notification (SECURITY DEFINER to bypass RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_link_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_source_user_id UUID DEFAULT NULL,
  p_source_role TEXT DEFAULT NULL,
  p_recipient_role TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  dedupe_window INTERVAL := INTERVAL '2 minutes';
  existing_id UUID;
BEGIN
  -- Dedupe: Check if similar notification exists within window
  SELECT id INTO existing_id
  FROM public.notifications
  WHERE user_id = p_user_id
    AND type = p_type
    AND metadata->>'examId' = p_metadata->>'examId'
    AND metadata->>'threadId' = p_metadata->>'threadId'
    AND created_at > NOW() - dedupe_window
  LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Update existing instead of creating duplicate
    UPDATE public.notifications
    SET updated_at = NOW(),
        body = p_body
    WHERE id = existing_id;
    RETURN existing_id;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, body, link_url, metadata,
    source_user_id, source_role, recipient_role,
    is_read, is_pinned
  ) VALUES (
    p_user_id, p_type, p_title, p_body, p_link_url, p_metadata,
    p_source_user_id, p_source_role, p_recipient_role,
    false, false
  )
  RETURNING id INTO new_id;
  
  RAISE LOG 'Notification created: id=%, type=%, recipient=%', new_id, p_type, p_user_id;
  RETURN new_id;
END;
$$;

-- 5) TRIGGER FUNCTION: Student feedback created -> notify tutors
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_tutor_on_feedback_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam RECORD;
  v_tutor_id UUID;
  v_student_name TEXT;
  v_question_number TEXT;
  v_tutor_ids UUID[] := ARRAY[]::UUID[];
  v_group RECORD;
BEGIN
  -- Get exam details
  SELECT e.id, e.title, e.user_id, e.assigned_by
  INTO v_exam
  FROM public.exams e
  WHERE e.id = NEW.exam_id;
  
  IF v_exam IS NULL THEN
    RAISE LOG 'notify_tutor_on_feedback_created: exam not found %', NEW.exam_id;
    RETURN NEW;
  END IF;
  
  -- Get student name
  SELECT COALESCE(display_name, first_name || ' ' || last_name, 'A student')
  INTO v_student_name
  FROM public.user_profiles
  WHERE id = NEW.student_id;
  
  -- Get question number
  SELECT question_number INTO v_question_number
  FROM public.exam_questions
  WHERE id = NEW.question_id;
  
  -- Primary tutor: exam assigner or owner
  v_tutor_id := COALESCE(v_exam.assigned_by, v_exam.user_id);
  IF v_tutor_id IS NOT NULL AND v_tutor_id != NEW.student_id THEN
    v_tutor_ids := array_append(v_tutor_ids, v_tutor_id);
  END IF;
  
  -- Also notify tutors of groups the student belongs to (that have this exam assigned)
  FOR v_group IN
    SELECT DISTINCT sg.tutor_id
    FROM public.group_members gm
    JOIN public.student_groups sg ON sg.id = gm.group_id
    JOIN public.exam_assignments ea ON ea.target_id = sg.id AND ea.assignment_type = 'group'
    WHERE gm.student_id = NEW.student_id
      AND gm.is_active = true
      AND ea.exam_id = NEW.exam_id
      AND sg.tutor_id != NEW.student_id
  LOOP
    IF NOT v_group.tutor_id = ANY(v_tutor_ids) THEN
      v_tutor_ids := array_append(v_tutor_ids, v_group.tutor_id);
    END IF;
  END LOOP;
  
  -- Create notification for each tutor
  FOREACH v_tutor_id IN ARRAY v_tutor_ids
  LOOP
    PERFORM public.create_notification(
      p_user_id := v_tutor_id,
      p_type := 'feedback_request',
      p_title := 'New Student Question',
      p_body := format('%s asked for help on Q%s in %s', 
                       v_student_name, 
                       COALESCE(v_question_number, '?'), 
                       v_exam.title),
      p_link_url := format('/tutor/feedback?thread=%s', NEW.id),
      p_metadata := jsonb_build_object(
        'threadId', NEW.id,
        'examId', NEW.exam_id,
        'questionId', NEW.question_id,
        'questionNumber', v_question_number,
        'studentId', NEW.student_id
      ),
      p_source_user_id := NEW.student_id,
      p_source_role := 'student',
      p_recipient_role := 'tutor'
    );
  END LOOP;
  
  RAISE LOG 'notify_tutor_on_feedback_created: notified % tutors for thread %', 
            array_length(v_tutor_ids, 1), NEW.id;
  
  RETURN NEW;
END;
$$;

-- 6) TRIGGER FUNCTION: Tutor responded to feedback -> notify student
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_student_on_feedback_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam RECORD;
  v_tutor_name TEXT;
  v_question_number TEXT;
BEGIN
  -- Only trigger when tutor_response changes from null to non-null
  IF OLD.tutor_response IS NOT NULL OR NEW.tutor_response IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get exam details
  SELECT e.id, e.title
  INTO v_exam
  FROM public.exams e
  WHERE e.id = NEW.exam_id;
  
  -- Get tutor name
  SELECT COALESCE(display_name, first_name || ' ' || last_name, 'Your tutor')
  INTO v_tutor_name
  FROM public.user_profiles
  WHERE id = NEW.tutor_id;
  
  -- Get question number
  SELECT question_number INTO v_question_number
  FROM public.exam_questions
  WHERE id = NEW.question_id;
  
  -- Create notification for student
  PERFORM public.create_notification(
    p_user_id := NEW.student_id,
    p_type := 'feedback_response',
    p_title := 'Tutor Responded',
    p_body := format('%s replied to your question on Q%s', 
                     v_tutor_name,
                     COALESCE(v_question_number, '?')),
    p_link_url := format('/exam/%s/review?q=%s', NEW.exam_id, COALESCE(v_question_number, '')),
    p_metadata := jsonb_build_object(
      'threadId', NEW.id,
      'examId', NEW.exam_id,
      'questionId', NEW.question_id,
      'questionNumber', v_question_number,
      'tutorId', NEW.tutor_id
    ),
    p_source_user_id := NEW.tutor_id,
    p_source_role := 'tutor',
    p_recipient_role := 'student'
  );
  
  RAISE LOG 'notify_student_on_feedback_response: notified student % for thread %', 
            NEW.student_id, NEW.id;
  
  RETURN NEW;
END;
$$;

-- 7) TRIGGER FUNCTION: Exam released -> notify students
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_students_on_exam_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam RECORD;
  v_student RECORD;
  v_student_ids UUID[] := ARRAY[]::UUID[];
  v_tutor_name TEXT;
  v_release_now BOOLEAN;
BEGIN
  -- Get exam details
  SELECT e.id, e.title, e.assigned_by, e.user_id
  INTO v_exam
  FROM public.exams e
  WHERE e.id = NEW.exam_id;
  
  IF v_exam IS NULL THEN
    RAISE LOG 'notify_students_on_exam_release: exam not found %', NEW.exam_id;
    RETURN NEW;
  END IF;
  
  -- Check if release is now or future
  v_release_now := NEW.release_date IS NULL OR NEW.release_date <= NOW();
  
  -- Get tutor name
  SELECT COALESCE(display_name, first_name || ' ' || last_name, 'Your tutor')
  INTO v_tutor_name
  FROM public.user_profiles
  WHERE id = COALESCE(v_exam.assigned_by, v_exam.user_id);
  
  -- Resolve recipients based on assignment type
  IF NEW.assignment_type = 'student' AND NEW.target_id IS NOT NULL THEN
    v_student_ids := array_append(v_student_ids, NEW.target_id);
  ELSIF NEW.assignment_type = 'group' AND NEW.target_id IS NOT NULL THEN
    -- Get all active members of the group
    SELECT array_agg(DISTINCT gm.student_id)
    INTO v_student_ids
    FROM public.group_members gm
    WHERE gm.group_id = NEW.target_id
      AND gm.is_active = true;
  END IF;
  
  -- Create notification for each student
  IF v_student_ids IS NOT NULL THEN
    FOREACH v_student.id IN ARRAY v_student_ids
    LOOP
      PERFORM public.create_notification(
        p_user_id := v_student.id,
        p_type := 'exam_reminder',
        p_title := 'New Exam Assigned',
        p_body := format('%s assigned you "%s"', v_tutor_name, v_exam.title),
        p_link_url := format('/exam/%s/in-progress', NEW.exam_id),
        p_metadata := jsonb_build_object(
          'examId', NEW.exam_id,
          'assignmentId', NEW.id,
          'groupId', CASE WHEN NEW.assignment_type = 'group' THEN NEW.target_id ELSE NULL END,
          'deadline', NEW.deadline,
          'assignedBy', NEW.assigned_by
        ),
        p_source_user_id := NEW.assigned_by,
        p_source_role := 'tutor',
        p_recipient_role := 'student'
      );
    END LOOP;
    
    RAISE LOG 'notify_students_on_exam_release: notified % students for exam %', 
              array_length(v_student_ids, 1), NEW.exam_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8) TRIGGER FUNCTION: Grades released -> notify students
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_students_on_grades_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam RECORD;
  v_student RECORD;
  v_tutor_name TEXT;
BEGIN
  -- Only trigger when is_grades_released changes from false to true
  IF OLD.is_grades_released = true OR NEW.is_grades_released = false THEN
    RETURN NEW;
  END IF;
  
  -- Get exam details
  SELECT e.id, e.title, e.assigned_by, e.user_id
  INTO v_exam
  FROM public.exams e
  WHERE e.id = NEW.exam_id;
  
  IF v_exam IS NULL THEN
    RAISE LOG 'notify_students_on_grades_release: exam not found %', NEW.exam_id;
    RETURN NEW;
  END IF;
  
  -- Get tutor name
  SELECT COALESCE(display_name, first_name || ' ' || last_name, 'Your tutor')
  INTO v_tutor_name
  FROM public.user_profiles
  WHERE id = COALESCE(v_exam.assigned_by, v_exam.user_id);
  
  -- Find all students who have submitted this exam
  FOR v_student IN
    SELECT DISTINCT es.student_id
    FROM public.exam_submissions es
    WHERE es.exam_id = NEW.exam_id
      AND es.status = 'submitted'
  LOOP
    PERFORM public.create_notification(
      p_user_id := v_student.student_id,
      p_type := 'grades_released',
      p_title := 'Grades Released',
      p_body := format('Your grades for "%s" are now available', v_exam.title),
      p_link_url := format('/exam/%s/review', NEW.exam_id),
      p_metadata := jsonb_build_object(
        'examId', NEW.exam_id,
        'assignmentId', NEW.id
      ),
      p_source_user_id := COALESCE(v_exam.assigned_by, v_exam.user_id),
      p_source_role := 'tutor',
      p_recipient_role := 'student'
    );
  END LOOP;
  
  RAISE LOG 'notify_students_on_grades_release: notified students for exam %', NEW.exam_id;
  
  RETURN NEW;
END;
$$;

-- 9) CREATE TRIGGERS (drop if exist to avoid duplicates)
-- =====================================================

-- Feedback created trigger
DROP TRIGGER IF EXISTS trigger_notify_tutor_on_feedback ON public.question_feedback_threads;
CREATE TRIGGER trigger_notify_tutor_on_feedback
  AFTER INSERT ON public.question_feedback_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tutor_on_feedback_created();

-- Feedback response trigger
DROP TRIGGER IF EXISTS trigger_notify_student_on_response ON public.question_feedback_threads;
CREATE TRIGGER trigger_notify_student_on_response
  AFTER UPDATE ON public.question_feedback_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_student_on_feedback_response();

-- Exam assignment trigger
DROP TRIGGER IF EXISTS trigger_notify_students_exam_release ON public.exam_assignments;
CREATE TRIGGER trigger_notify_students_exam_release
  AFTER INSERT ON public.exam_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_students_on_exam_release();

-- Grades released trigger
DROP TRIGGER IF EXISTS trigger_notify_students_grades ON public.exam_assignments;
CREATE TRIGGER trigger_notify_students_grades
  AFTER UPDATE ON public.exam_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_students_on_grades_release();