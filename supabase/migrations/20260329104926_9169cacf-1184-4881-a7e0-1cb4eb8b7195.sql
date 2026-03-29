ALTER TABLE public.tutor_profiles
ADD COLUMN IF NOT EXISTS teaching_region text,
ADD COLUMN IF NOT EXISTS custom_region text,
ADD COLUMN IF NOT EXISTS boards_taught text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS levels_taught text[] DEFAULT '{}';