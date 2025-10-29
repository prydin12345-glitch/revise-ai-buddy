-- Add subject_color column to revision_goals table
ALTER TABLE public.revision_goals 
ADD COLUMN IF NOT EXISTS subject_color text DEFAULT '#3B82F6';

-- Add comment to explain the column
COMMENT ON COLUMN public.revision_goals.subject_color IS 'Hex color code for subject visual identity';