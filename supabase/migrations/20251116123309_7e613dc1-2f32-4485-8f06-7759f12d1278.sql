-- Add due_date and reminder settings to revision_tasks table
ALTER TABLE revision_tasks 
ADD COLUMN due_date DATE,
ADD COLUMN reminder_days_before INTEGER DEFAULT 1;

-- Add index for efficient due date queries
CREATE INDEX idx_revision_tasks_due_date 
ON revision_tasks(user_id, due_date) 
WHERE due_date IS NOT NULL;