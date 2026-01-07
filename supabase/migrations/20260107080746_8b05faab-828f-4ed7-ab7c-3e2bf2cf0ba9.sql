-- Create trigger for notifying tutor when student resolves feedback
DROP TRIGGER IF EXISTS trigger_notify_tutor_on_feedback_resolved ON public.question_feedback_threads;

CREATE TRIGGER trigger_notify_tutor_on_feedback_resolved
  AFTER UPDATE ON public.question_feedback_threads
  FOR EACH ROW
  WHEN (NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved')
  EXECUTE FUNCTION public.notify_tutor_on_feedback_resolved();

-- Also create the trigger for notifying students on feedback response if it doesn't exist
DROP TRIGGER IF EXISTS trigger_notify_student_on_response ON public.question_feedback_threads;

CREATE TRIGGER trigger_notify_student_on_response
  AFTER UPDATE ON public.question_feedback_threads
  FOR EACH ROW
  WHEN (NEW.tutor_response IS NOT NULL AND OLD.tutor_response IS NULL)
  EXECUTE FUNCTION public.notify_student_on_feedback_response();

-- Create trigger for notifying tutor on new feedback thread
DROP TRIGGER IF EXISTS trigger_notify_tutor_on_feedback_created ON public.question_feedback_threads;

CREATE TRIGGER trigger_notify_tutor_on_feedback_created
  AFTER INSERT ON public.question_feedback_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tutor_on_feedback_created();