-- Add resolved_at and resolved_by columns to question_feedback_threads
ALTER TABLE public.question_feedback_threads 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_by UUID;

-- Add confirm_resolve_feedback preference column to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS confirm_resolve_feedback BOOLEAN DEFAULT true;

-- Update notifications type check constraint to include feedback_resolved
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'exam_reminder',
  'ai_suggestion', 
  'task_completion',
  'missed_task',
  'feedback_request',
  'feedback_response',
  'feedback_resolved',
  'grades_released',
  'verification_approved',
  'exam_assigned',
  'deadline_reminder',
  'system'
]));

-- Create function to notify tutor when student resolves a feedback thread
CREATE OR REPLACE FUNCTION public.notify_tutor_on_feedback_resolved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_exam RECORD;
  v_tutor_id UUID;
  v_student_name TEXT;
  v_question_number TEXT;
BEGIN
  -- Only trigger when status changes to 'resolved' and resolved_by is the student
  IF NEW.status != 'resolved' OR OLD.status = 'resolved' THEN
    RETURN NEW;
  END IF;
  
  -- Get exam details
  SELECT e.id, e.title, e.user_id, e.assigned_by
  INTO v_exam
  FROM public.exams e
  WHERE e.id = NEW.exam_id;
  
  IF v_exam IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get tutor to notify (the one who responded, or exam owner)
  v_tutor_id := COALESCE(NEW.tutor_id, v_exam.assigned_by, v_exam.user_id);
  
  -- Check if tutor wants to be notified on resolve
  IF NEW.notify_on_resolve = false THEN
    RETURN NEW;
  END IF;
  
  -- Don't notify if tutor is the one resolving (shouldn't happen but safety check)
  IF v_tutor_id = NEW.resolved_by THEN
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
  
  -- Create notification for tutor
  PERFORM public.create_notification(
    p_user_id := v_tutor_id,
    p_type := 'feedback_resolved',
    p_title := 'Feedback Resolved',
    p_body := format('%s marked Q%s feedback as resolved', 
                     v_student_name,
                     COALESCE(v_question_number, '?')),
    p_link_url := format('/tutor/feedback'),
    p_metadata := jsonb_build_object(
      'threadId', NEW.id,
      'examId', NEW.exam_id,
      'questionId', NEW.question_id,
      'studentId', NEW.student_id,
      'resolvedAt', NEW.resolved_at
    ),
    p_source_user_id := NEW.student_id,
    p_source_role := 'student',
    p_recipient_role := 'tutor'
  );
  
  RETURN NEW;
END;
$function$;

-- Create trigger for feedback resolved notification
DROP TRIGGER IF EXISTS trigger_notify_tutor_on_feedback_resolved ON public.question_feedback_threads;
CREATE TRIGGER trigger_notify_tutor_on_feedback_resolved
  AFTER UPDATE ON public.question_feedback_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tutor_on_feedback_resolved();