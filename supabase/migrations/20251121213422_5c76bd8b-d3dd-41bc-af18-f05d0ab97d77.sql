-- Add indexes for performance on revision_tasks table
CREATE INDEX IF NOT EXISTS idx_revision_tasks_date ON public.revision_tasks(date);
CREATE INDEX IF NOT EXISTS idx_revision_tasks_user_id_date ON public.revision_tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_revision_tasks_status ON public.revision_tasks(status);

-- Add parent_task_id column for linking review tasks to original tasks
ALTER TABLE public.revision_tasks 
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.revision_tasks(id) ON DELETE SET NULL;

-- Add index on parent_task_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_revision_tasks_parent_task_id ON public.revision_tasks(parent_task_id);

-- Add indexes on other frequently queried tables
CREATE INDEX IF NOT EXISTS idx_exam_submissions_student_id ON public.exam_submissions(student_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam_id ON public.exam_submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_session_feedback_task_id ON public.session_feedback(task_id);