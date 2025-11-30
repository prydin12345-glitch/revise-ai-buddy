-- Create group_announcements table
CREATE TABLE public.group_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on group_announcements
ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_announcements
-- Tutors can create announcements for their own groups
CREATE POLICY "Tutors can create announcements for own groups"
ON public.group_announcements
FOR INSERT
TO authenticated
WITH CHECK (public.is_group_tutor(group_id, auth.uid()));

-- Tutors can view announcements for their own groups
CREATE POLICY "Tutors can view own group announcements"
ON public.group_announcements
FOR SELECT
TO authenticated
USING (public.is_group_tutor(group_id, auth.uid()));

-- Students can view announcements for groups they're in
CREATE POLICY "Students can view group announcements"
ON public.group_announcements
FOR SELECT
TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

-- Tutors can update their own announcements
CREATE POLICY "Tutors can update own announcements"
ON public.group_announcements
FOR UPDATE
TO authenticated
USING (tutor_id = auth.uid())
WITH CHECK (tutor_id = auth.uid());

-- Tutors can delete their own announcements
CREATE POLICY "Tutors can delete own announcements"
ON public.group_announcements
FOR DELETE
TO authenticated
USING (tutor_id = auth.uid());

-- Create question_feedback_threads table
CREATE TABLE public.question_feedback_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  tutor_id UUID,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  student_comment TEXT NOT NULL,
  tutor_response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'responded', 'resolved'))
);

-- Enable RLS on question_feedback_threads
ALTER TABLE public.question_feedback_threads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for question_feedback_threads
-- Students can create feedback for their own exams
CREATE POLICY "Students can create own feedback"
ON public.question_feedback_threads
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.exam_submissions es
  WHERE es.exam_id = question_feedback_threads.exam_id
    AND es.student_id = auth.uid()
));

-- Students can view their own feedback threads
CREATE POLICY "Students can view own feedback"
ON public.question_feedback_threads
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Tutors/teachers can view feedback for exams they created or assigned
CREATE POLICY "Tutors can view feedback for their exams"
ON public.question_feedback_threads
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = question_feedback_threads.exam_id
    AND (e.user_id = auth.uid() OR e.assigned_by = auth.uid())
));

-- Tutors can update feedback threads to add responses
CREATE POLICY "Tutors can respond to feedback"
ON public.question_feedback_threads
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = question_feedback_threads.exam_id
    AND (e.user_id = auth.uid() OR e.assigned_by = auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = question_feedback_threads.exam_id
    AND (e.user_id = auth.uid() OR e.assigned_by = auth.uid())
));

-- Students can update their own pending feedback
CREATE POLICY "Students can update own pending feedback"
ON public.question_feedback_threads
FOR UPDATE
TO authenticated
USING (student_id = auth.uid() AND status = 'pending')
WITH CHECK (student_id = auth.uid() AND status = 'pending');

-- Students can delete their own pending feedback
CREATE POLICY "Students can delete own pending feedback"
ON public.question_feedback_threads
FOR DELETE
TO authenticated
USING (student_id = auth.uid() AND status = 'pending');

-- Create indexes for better query performance
CREATE INDEX idx_group_announcements_group_id ON public.group_announcements(group_id);
CREATE INDEX idx_group_announcements_created_at ON public.group_announcements(created_at DESC);
CREATE INDEX idx_feedback_threads_student_id ON public.question_feedback_threads(student_id);
CREATE INDEX idx_feedback_threads_exam_id ON public.question_feedback_threads(exam_id);
CREATE INDEX idx_feedback_threads_status ON public.question_feedback_threads(status);