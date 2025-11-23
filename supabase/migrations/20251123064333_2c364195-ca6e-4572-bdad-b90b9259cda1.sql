-- ============================================================================
-- PHASE 1: Multi-Role Authentication System - Database Schema & Security
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CREATE ENUM FOR ROLES
-- ----------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'tutor', 'admin');

-- ----------------------------------------------------------------------------
-- 2. CREATE ALL TABLES FIRST (without complex RLS policies)
-- ----------------------------------------------------------------------------

-- User Roles Table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_user_roles_active ON public.user_roles(is_active) WHERE is_active = TRUE;

-- User Profiles Table
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    avatar_url TEXT,
    date_of_birth DATE,
    phone_number TEXT,
    country TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schools Table
CREATE TABLE public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    country TEXT,
    region TEXT,
    license_type TEXT,
    license_start_date DATE,
    license_end_date DATE,
    max_teachers INTEGER,
    max_students INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_license_dates CHECK (license_end_date IS NULL OR license_end_date >= license_start_date)
);

CREATE INDEX idx_schools_domain ON public.schools(domain);
CREATE INDEX idx_schools_active ON public.schools(is_active) WHERE is_active = TRUE;

-- Teacher Verifications Table
CREATE TABLE public.teacher_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    verification_method TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_status CHECK (status IN ('pending', 'verified', 'rejected')),
    UNIQUE(teacher_id, school_id)
);

CREATE INDEX idx_teacher_verifications_teacher ON public.teacher_verifications(teacher_id);
CREATE INDEX idx_teacher_verifications_school ON public.teacher_verifications(school_id);
CREATE INDEX idx_teacher_verifications_status ON public.teacher_verifications(status);

-- Student Groups Table
CREATE TABLE public.student_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settings JSONB DEFAULT '{}'
);

CREATE INDEX idx_student_groups_tutor ON public.student_groups(tutor_id);

-- Group Members Table
CREATE TABLE public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    role TEXT DEFAULT 'member',
    UNIQUE(group_id, student_id)
);

CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_student ON public.group_members(student_id);

-- Class Assignments Table
CREATE TABLE public.class_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    academic_year TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(teacher_id, student_id, class_name, school_id)
);

CREATE INDEX idx_class_assignments_teacher ON public.class_assignments(teacher_id);
CREATE INDEX idx_class_assignments_student ON public.class_assignments(student_id);
CREATE INDEX idx_class_assignments_school ON public.class_assignments(school_id);

-- Exam Assignments Table
CREATE TABLE public.exam_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES auth.users(id),
    assignment_type TEXT NOT NULL,
    target_id UUID,
    class_name TEXT,
    deadline TIMESTAMPTZ,
    release_date TIMESTAMPTZ,
    is_grades_released BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_assignment_type CHECK (
        assignment_type IN ('individual', 'group', 'class', 'school')
    )
);

CREATE INDEX idx_exam_assignments_exam ON public.exam_assignments(exam_id);
CREATE INDEX idx_exam_assignments_assignedby ON public.exam_assignments(assigned_by);
CREATE INDEX idx_exam_assignments_target ON public.exam_assignments(target_id);
CREATE INDEX idx_exam_assignments_type ON public.exam_assignments(assignment_type);

-- Audit Log Table
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. CREATE SECURITY FUNCTIONS (after tables exist)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS TABLE(role public.app_role, is_primary BOOLEAN)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    role,
    (metadata->>'is_primary')::BOOLEAN AS is_primary
  FROM public.user_roles
  WHERE user_id = _user_id
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY is_primary DESC NULLS LAST, created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_roles(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. ENABLE RLS AND ADD POLICIES FOR ALL TABLES
-- ----------------------------------------------------------------------------

-- User Roles RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Only system can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (FALSE);

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No direct deletes"
ON public.user_roles FOR DELETE
USING (FALSE);

-- User Profiles RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
ON public.user_profiles FOR ALL
USING (id = auth.uid());

-- Schools RLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own school"
ON public.schools FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.teacher_verifications tv
        WHERE tv.school_id = schools.id
          AND tv.teacher_id = auth.uid()
          AND tv.status = 'verified'
    )
);

-- Teacher Verifications RLS
ALTER TABLE public.teacher_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view own verifications"
ON public.teacher_verifications FOR SELECT
USING (teacher_id = auth.uid());

CREATE POLICY "Teachers insert own verification"
ON public.teacher_verifications FOR INSERT
WITH CHECK (teacher_id = auth.uid() AND status = 'pending');

-- Student Groups RLS
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors manage own groups"
ON public.student_groups FOR ALL
USING (tutor_id = auth.uid());

CREATE POLICY "Students view assigned groups"
ON public.student_groups FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = student_groups.id
          AND gm.student_id = auth.uid()
          AND gm.is_active = TRUE
    )
);

-- Group Members RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors manage group members"
ON public.group_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.student_groups sg
        WHERE sg.id = group_members.group_id
          AND sg.tutor_id = auth.uid()
    )
);

CREATE POLICY "Students view own memberships"
ON public.group_members FOR SELECT
USING (student_id = auth.uid());

-- Class Assignments RLS
ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view own class assignments"
ON public.class_assignments FOR SELECT
USING (teacher_id = auth.uid());

CREATE POLICY "Students view own class assignments"
ON public.class_assignments FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Teachers create class assignments"
ON public.class_assignments FOR INSERT
WITH CHECK (
    teacher_id = auth.uid() 
    AND public.has_role(auth.uid(), 'teacher')
);

-- Exam Assignments RLS
ALTER TABLE public.exam_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assigners view own assignments"
ON public.exam_assignments FOR SELECT
USING (assigned_by = auth.uid());

CREATE POLICY "Students view assigned exams"
ON public.exam_assignments FOR SELECT
USING (
    (assignment_type = 'individual' AND target_id = auth.uid())
    OR (assignment_type = 'group' AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = target_id
          AND gm.student_id = auth.uid()
          AND gm.is_active = TRUE
    ))
    OR (assignment_type = 'class' AND EXISTS (
        SELECT 1 FROM public.class_assignments ca
        WHERE ca.teacher_id = exam_assignments.assigned_by
          AND ca.student_id = auth.uid()
          AND ca.class_name = exam_assignments.class_name
          AND ca.is_active = TRUE
    ))
);

CREATE POLICY "Teachers create exam assignments"
ON public.exam_assignments FOR INSERT
WITH CHECK (
    assigned_by = auth.uid()
    AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'tutor'))
    AND EXISTS (
        SELECT 1 FROM public.exams e
        WHERE e.id = exam_id AND e.user_id = auth.uid()
    )
);

-- Audit Log RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log"
ON public.audit_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- 5. UPDATE EXISTING TABLES
-- ----------------------------------------------------------------------------

-- Add new columns to exams table
ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS grade_released BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private';

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'exams_visibility_check'
    ) THEN
        ALTER TABLE public.exams 
        ADD CONSTRAINT exams_visibility_check 
        CHECK (visibility IN ('private', 'school', 'public'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exams_assigned_by ON public.exams(assigned_by);
CREATE INDEX IF NOT EXISTS idx_exams_template ON public.exams(is_template) WHERE is_template = TRUE;

-- Drop existing policies and recreate with multi-role support
DROP POLICY IF EXISTS "Users can view own exams" ON public.exams;
DROP POLICY IF EXISTS "Users can create own exams" ON public.exams;
DROP POLICY IF EXISTS "Users can update own exams" ON public.exams;
DROP POLICY IF EXISTS "Users can delete own exams" ON public.exams;

CREATE POLICY "Students view own exams"
ON public.exams FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.exam_assignments ea
        WHERE ea.exam_id = exams.id
          AND ea.is_active = TRUE
          AND (
              (ea.assignment_type = 'individual' AND ea.target_id = auth.uid())
              OR (ea.assignment_type = 'group' AND EXISTS (
                  SELECT 1 FROM public.group_members gm
                  WHERE gm.group_id = ea.target_id AND gm.student_id = auth.uid()
              ))
              OR (ea.assignment_type = 'class' AND EXISTS (
                  SELECT 1 FROM public.class_assignments ca
                  WHERE ca.teacher_id = ea.assigned_by
                    AND ca.student_id = auth.uid()
                    AND ca.class_name = ea.class_name
              ))
          )
    )
);

CREATE POLICY "Teachers view created exams"
ON public.exams FOR SELECT
USING (
    user_id = auth.uid()
    OR assigned_by = auth.uid()
);

CREATE POLICY "Users can create own exams"
ON public.exams FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exams"
ON public.exams FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exams"
ON public.exams FOR DELETE
USING (auth.uid() = user_id);

-- Add new columns to revision_tasks table
ALTER TABLE public.revision_tasks
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_teacher_assigned BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_revision_tasks_created_by ON public.revision_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_revision_tasks_assigned_to ON public.revision_tasks(assigned_to);

-- ----------------------------------------------------------------------------
-- 6. CREATE TRIGGERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    signup_role public.app_role;
    temp_role TEXT;
BEGIN
    temp_role := NEW.raw_user_meta_data->>'signup_role';
    signup_role := COALESCE(temp_role::public.app_role, 'student'::public.app_role);
    
    INSERT INTO public.user_roles (user_id, role, metadata)
    VALUES (
        NEW.id,
        signup_role,
        jsonb_build_object('is_primary', TRUE, 'signup_method', 'email')
    );
    
    INSERT INTO public.user_profiles (id, first_name, last_name, display_name)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            CONCAT(NEW.raw_user_meta_data->>'first_name', ' ', NEW.raw_user_meta_data->>'last_name')
        )
    );
    
    INSERT INTO public.audit_log (user_id, action, resource_type, new_values)
    VALUES (
        NEW.id,
        'user_signup',
        'user_role',
        jsonb_build_object('role', signup_role, 'email', NEW.email)
    );
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

CREATE OR REPLACE FUNCTION public.handle_teacher_verification_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'verified' AND (OLD.status IS NULL OR OLD.status != 'verified') THEN
        UPDATE public.user_roles
        SET is_active = TRUE
        WHERE user_id = NEW.teacher_id AND role = 'teacher';
        
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (
            NEW.teacher_id,
            'verification_approved',
            'Teacher Account Verified',
            'Your teacher account has been verified. You can now create and assign exams.'
        );
        
        INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, new_values)
        VALUES (
            NEW.verified_by,
            'teacher_verified',
            'teacher_verification',
            NEW.id,
            jsonb_build_object('teacher_id', NEW.teacher_id, 'school_id', NEW.school_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_teacher_verification_update ON public.teacher_verifications;
CREATE TRIGGER on_teacher_verification_update
    AFTER UPDATE ON public.teacher_verifications
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.handle_teacher_verification_change();