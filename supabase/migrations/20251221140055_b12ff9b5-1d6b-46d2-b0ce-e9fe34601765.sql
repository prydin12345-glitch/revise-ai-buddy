-- Create table for feedback tags/priorities
CREATE TABLE public.feedback_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.question_feedback_threads(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (tag IN ('urgent', 'needs_review', 'follow_up', 'high_priority')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(thread_id, tag)
);

-- Enable RLS
ALTER TABLE public.feedback_tags ENABLE ROW LEVEL SECURITY;

-- Create policies for tutors to manage tags
CREATE POLICY "Tutors can view feedback tags" 
ON public.feedback_tags 
FOR SELECT 
USING (true);

CREATE POLICY "Tutors can create feedback tags" 
ON public.feedback_tags 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Tutors can delete their feedback tags" 
ON public.feedback_tags 
FOR DELETE 
USING (auth.uid() = created_by);

-- Add notification preferences column to question_feedback_threads
ALTER TABLE public.question_feedback_threads 
ADD COLUMN IF NOT EXISTS notify_on_reply BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_on_resolve BOOLEAN DEFAULT false;