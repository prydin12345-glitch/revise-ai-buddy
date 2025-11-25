-- Phase 1: Database Schema Enhancements for Role-Based Onboarding (Fixed)

-- 1.1 Create Master Subjects Table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('sciences', 'humanities', 'languages', 'maths', 'other')),
  icon_name TEXT,
  default_exam_types JSONB DEFAULT '[]'::jsonb,
  default_spaced_profile JSONB DEFAULT '{"intervals": [1, 3, 7, 14, 30]}'::jsonb,
  common_topics JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pre-populate with standard subjects
INSERT INTO public.subjects (name, slug, category, icon_name, default_exam_types, common_topics) VALUES
  ('Mathematics', 'mathematics', 'maths', 'Calculator', '["mock_exam", "topic_test", "practice_set"]', '["Algebra", "Geometry", "Calculus", "Statistics"]'),
  ('English', 'english', 'languages', 'BookOpen', '["essay", "comprehension", "literature_analysis"]', '["Grammar", "Literature", "Creative Writing"]'),
  ('Physics', 'physics', 'sciences', 'Zap', '["practical", "theory_exam"]', '["Mechanics", "Electricity", "Waves", "Thermodynamics"]'),
  ('Chemistry', 'chemistry', 'sciences', 'Flask', '["practical", "theory_exam"]', '["Organic", "Inorganic", "Physical Chemistry"]'),
  ('Biology', 'biology', 'sciences', 'Microscope', '["practical", "theory_exam"]', '["Cell Biology", "Genetics", "Ecology", "Human Biology"]'),
  ('Computer Science', 'computer-science', 'sciences', 'Code', '["programming", "theory_exam"]', '["Algorithms", "Data Structures", "Networks"]'),
  ('History', 'history', 'humanities', 'Landmark', '["essay", "source_analysis"]', '["World Wars", "Ancient Civilizations", "Modern History"]'),
  ('Geography', 'geography', 'humanities', 'Globe', '["fieldwork", "case_study", "exam"]', '["Physical Geography", "Human Geography", "GIS"]');

-- Enable RLS on subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active subjects"
  ON public.subjects FOR SELECT
  USING (is_active = true);

-- 1.2 Enhance user_subjects Table (Add columns first)
ALTER TABLE public.user_subjects
  ADD COLUMN subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN custom_name TEXT,
  ADD COLUMN curriculum_tag TEXT,
  ADD COLUMN proficiency_estimate INTEGER CHECK (proficiency_estimate >= 1 AND proficiency_estimate <= 5),
  ADD COLUMN is_custom BOOLEAN DEFAULT false;

-- Migrate existing user_subjects to link with master subjects
UPDATE public.user_subjects us
SET subject_id = (
  SELECT id FROM public.subjects s
  WHERE LOWER(s.name) = LOWER(us.subject_name)
  LIMIT 1
)
WHERE subject_id IS NULL 
  AND EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE LOWER(s.name) = LOWER(us.subject_name)
  );

-- Mark remaining as custom subjects (set is_custom=true and custom_name)
UPDATE public.user_subjects
SET is_custom = true,
    custom_name = subject_name
WHERE subject_id IS NULL;

-- NOW add the constraint after data is migrated
ALTER TABLE public.user_subjects
  ADD CONSTRAINT user_subjects_reference_check 
  CHECK (
    (subject_id IS NOT NULL AND is_custom = false) OR 
    (is_custom = true AND custom_name IS NOT NULL)
  );

-- Create index for faster lookups
CREATE INDEX idx_user_subjects_user_subject ON public.user_subjects(user_id, subject_id);

-- 1.3 Enhance revision_goals Table (Structured SMART Goals)
ALTER TABLE public.revision_goals
  ADD COLUMN goal_type TEXT,
  ADD COLUMN custom_goal_text TEXT,
  ADD COLUMN target_metric JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN effort_estimate INTEGER,
  ADD COLUMN auto_schedule BOOLEAN DEFAULT false,
  ADD COLUMN schedule_status TEXT DEFAULT 'pending',
  ADD COLUMN scheduled_tasks_count INTEGER DEFAULT 0,
  ADD COLUMN subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- Backfill existing goals with default type
UPDATE public.revision_goals 
SET goal_type = 'improve_grade',
    target_metric = jsonb_build_object(
      'score', COALESCE(target_percentage, 80),
      'unit', '%',
      'exam_count', COALESCE(target_exams, 10)
    )
WHERE goal_type IS NULL;

-- Add constraints after backfill
ALTER TABLE public.revision_goals 
  ALTER COLUMN goal_type SET NOT NULL,
  ADD CONSTRAINT goal_type_check CHECK (goal_type IN ('improve_grade', 'build_confidence', 'exam_techniques', 'reduce_stress', 'track_progress', 'custom')),
  ADD CONSTRAINT schedule_status_check CHECK (schedule_status IN ('pending', 'scheduled', 'failed'));

-- 1.4 Create tutor_profiles Table
CREATE TABLE public.tutor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subjects_taught JSONB DEFAULT '[]'::jsonb,
  student_count_estimate INTEGER,
  teaching_mode TEXT CHECK (teaching_mode IN ('groups', 'one_on_one', 'mixed')),
  preferred_group_size INTEGER,
  availability JSONB DEFAULT '{}'::jsonb,
  bio TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on tutor_profiles
ALTER TABLE public.tutor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors can manage own profile"
  ON public.tutor_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 1.5 Enhance student_groups Table
ALTER TABLE public.student_groups
  ADD COLUMN invite_code TEXT,
  ADD COLUMN capacity INTEGER DEFAULT 10,
  ADD COLUMN is_suggested BOOLEAN DEFAULT false,
  ADD COLUMN subjects_covered JSONB DEFAULT '[]'::jsonb;

-- Generate invite codes for existing groups
UPDATE public.student_groups
SET invite_code = SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 8)
WHERE invite_code IS NULL;

-- Add unique constraint on invite_code
ALTER TABLE public.student_groups ADD CONSTRAINT student_groups_invite_code_unique UNIQUE (invite_code);

-- Create index for invite code lookups
CREATE INDEX idx_student_groups_invite_code ON public.student_groups(invite_code);

-- 1.6 Enhance revision_tasks Table
ALTER TABLE public.revision_tasks
  ADD COLUMN spaced_profile JSONB DEFAULT NULL,
  ADD COLUMN generated_from_goal_id UUID REFERENCES public.revision_goals(id) ON DELETE SET NULL,
  ADD COLUMN is_auto_scheduled BOOLEAN DEFAULT false;

-- Create index for goal-task lookups
CREATE INDEX idx_revision_tasks_goal ON public.revision_tasks(generated_from_goal_id);

-- 1.7 Create user_onboarding_status Table
CREATE TABLE public.user_onboarding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  subjects_completed BOOLEAN DEFAULT false,
  goals_completed BOOLEAN DEFAULT false,
  tutor_profile_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_step TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_onboarding_status
ALTER TABLE public.user_onboarding_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own onboarding status"
  ON public.user_onboarding_status FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Data Migration for Existing Users
-- Backfill user_onboarding_status for existing users
INSERT INTO public.user_onboarding_status (user_id, role, last_step, created_at)
SELECT 
  ur.user_id,
  ur.role::TEXT,
  CASE 
    WHEN EXISTS (SELECT 1 FROM user_subjects WHERE user_id = ur.user_id) 
    THEN 'subjects'
    ELSE NULL
  END,
  ur.created_at
FROM user_roles ur
WHERE ur.is_active = true
ON CONFLICT (user_id, role) DO NOTHING;