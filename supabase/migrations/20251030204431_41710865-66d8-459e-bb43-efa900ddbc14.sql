-- Create revision_tasks table to persist user revision plans
CREATE TABLE public.revision_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  subject_color text NOT NULL DEFAULT '#3B82F6',
  day text NOT NULL,
  date timestamp with time zone NOT NULL,
  time text NOT NULL,
  duration integer,
  focus_topic text,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  exam_title text,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.revision_tasks ENABLE ROW LEVEL SECURITY;

-- Users can view their own revision tasks
CREATE POLICY "Users can view their own revision tasks"
ON public.revision_tasks
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own revision tasks
CREATE POLICY "Users can create their own revision tasks"
ON public.revision_tasks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own revision tasks
CREATE POLICY "Users can update their own revision tasks"
ON public.revision_tasks
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own revision tasks
CREATE POLICY "Users can delete their own revision tasks"
ON public.revision_tasks
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_revision_tasks_updated_at
BEFORE UPDATE ON public.revision_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();