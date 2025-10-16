-- Add display_order column to exams table for custom ordering
ALTER TABLE public.exams ADD COLUMN display_order integer;

-- Set initial display_order based on created_at (oldest first)
UPDATE public.exams 
SET display_order = row_number 
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as row_number 
  FROM public.exams
) as numbered 
WHERE exams.id = numbered.id;