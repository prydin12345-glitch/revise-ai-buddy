-- Fix 1: Add authorization check to create_student_notification function
-- This ensures only tutors of the student's group or admins can send notifications

CREATE OR REPLACE FUNCTION public.create_student_notification(
  p_student_id uuid, 
  p_type text, 
  p_title text, 
  p_body text, 
  p_action_data jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id uuid;
  caller_id uuid;
BEGIN
  -- Get the caller's user ID
  caller_id := auth.uid();
  
  -- Authorization check: caller must be either:
  -- 1. A tutor of a group the student belongs to
  -- 2. An admin
  -- 3. The owner of an exam assigned to this student
  IF NOT EXISTS (
    -- Check if caller is tutor of student's group
    SELECT 1 FROM public.group_members gm
    JOIN public.student_groups sg ON sg.id = gm.group_id
    WHERE gm.student_id = p_student_id 
      AND sg.tutor_id = caller_id
      AND gm.is_active = true
  ) AND NOT EXISTS (
    -- Check if caller owns an exam assigned to this student (individual or group)
    SELECT 1 FROM public.exams e
    JOIN public.exam_assignments ea ON ea.exam_id = e.id
    WHERE e.user_id = caller_id
      AND ea.is_active = true
      AND (
        (ea.assignment_type = 'individual' AND ea.target_id = p_student_id)
        OR (ea.assignment_type = 'student' AND ea.target_id = p_student_id)
        OR (ea.assignment_type = 'group' AND EXISTS (
          SELECT 1 FROM public.group_members gm 
          WHERE gm.group_id = ea.target_id 
          AND gm.student_id = p_student_id
          AND gm.is_active = true
        ))
      )
  ) AND NOT public.has_role(caller_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to send notifications to this student';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, action_data)
  VALUES (p_student_id, p_type, p_title, p_body, p_action_data)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Fix 2: Update storage policy to allow students to access files from assigned exams
-- First, drop the existing restrictive policy if it exists
DROP POLICY IF EXISTS "Users can view own exam files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view assigned exam files" ON storage.objects;

-- Create comprehensive policy that allows:
-- 1. Users to access their own files
-- 2. Students to access files from exams assigned to them (individually or via group)
CREATE POLICY "Users can view exam files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-files' 
  AND (
    -- Own files (user_id is first folder segment)
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Files from exams owned by user
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.user_id = auth.uid()
      AND (
        e.file_url LIKE '%' || name
        OR e.specification_file_url LIKE '%' || name
      )
    )
    OR
    -- Files from exams assigned to user (individual assignment)
    EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.exam_assignments ea ON ea.exam_id = e.id
      WHERE ea.is_active = true
      AND (
        e.file_url LIKE '%' || name
        OR e.specification_file_url LIKE '%' || name
      )
      AND (
        (ea.assignment_type IN ('individual', 'student') AND ea.target_id = auth.uid())
        OR (ea.assignment_type = 'group' AND EXISTS (
          SELECT 1 FROM public.group_members gm 
          WHERE gm.group_id = ea.target_id 
          AND gm.student_id = auth.uid()
          AND gm.is_active = true
        ))
        OR (ea.assignment_type = 'class' AND EXISTS (
          SELECT 1 FROM public.class_assignments ca
          WHERE ca.class_name = ea.class_name
          AND ca.student_id = auth.uid()
          AND ca.is_active = true
        ))
      )
    )
    OR
    -- Figure URLs from exam questions for assigned exams
    EXISTS (
      SELECT 1 FROM public.exam_questions eq
      JOIN public.exams e ON e.id = eq.exam_id
      LEFT JOIN public.exam_assignments ea ON ea.exam_id = e.id
      WHERE name = ANY(eq.figure_urls)
      AND (
        -- Exam owner
        e.user_id = auth.uid()
        OR
        -- Assigned student
        (ea.is_active = true AND (
          (ea.assignment_type IN ('individual', 'student') AND ea.target_id = auth.uid())
          OR (ea.assignment_type = 'group' AND EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.group_id = ea.target_id 
            AND gm.student_id = auth.uid()
            AND gm.is_active = true
          ))
        ))
      )
    )
  )
);

-- Ensure upload/update/delete policies still exist for own files only
DROP POLICY IF EXISTS "Users can upload own exam files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own exam files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own exam files" ON storage.objects;

CREATE POLICY "Users can upload own exam files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exam-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own exam files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'exam-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own exam files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exam-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);