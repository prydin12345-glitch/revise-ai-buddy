-- Create table for storing user subject preferences with colors
CREATE TABLE IF NOT EXISTS public.user_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_name TEXT NOT NULL,
  subject_color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject_name)
);

-- Enable RLS
ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;

-- Create policies for user subject preferences
CREATE POLICY "Users can view their own subjects"
ON public.user_subjects
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subjects"
ON public.user_subjects
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subjects"
ON public.user_subjects
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subjects"
ON public.user_subjects
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_subjects_updated_at
BEFORE UPDATE ON public.user_subjects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();