-- User-selectable subject symbol for the open dashboard layout.
ALTER TABLE public.user_subjects ADD COLUMN IF NOT EXISTS subject_icon text DEFAULT NULL;
