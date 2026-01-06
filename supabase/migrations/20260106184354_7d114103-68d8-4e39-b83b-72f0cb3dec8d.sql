-- Drop the old restrictive CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

-- Add a more comprehensive CHECK constraint with all notification types used
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'exam_reminder',
  'ai_suggestion', 
  'task_completion',
  'missed_task',
  'feedback_request',
  'feedback_response',
  'grades_released',
  'verification_approved',
  'exam_assigned',
  'deadline_reminder',
  'system'
]));