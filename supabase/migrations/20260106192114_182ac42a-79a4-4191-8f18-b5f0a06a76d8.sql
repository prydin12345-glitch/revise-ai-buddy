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
  'announcement',
  'grades_released',
  'verification_approved',
  'exam_assigned',
  'deadline_reminder',
  'deadline_changed',
  'exam_submitted',
  'system'
]));