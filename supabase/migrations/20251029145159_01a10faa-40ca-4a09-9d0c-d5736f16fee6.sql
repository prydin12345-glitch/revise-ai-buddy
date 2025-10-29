-- Create revision_goals table
CREATE TABLE public.revision_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  target_exams INTEGER NOT NULL DEFAULT 10,
  target_percentage NUMERIC,
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.revision_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for revision goals
CREATE POLICY "Users can view their own goals" 
ON public.revision_goals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals" 
ON public.revision_goals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" 
ON public.revision_goals 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" 
ON public.revision_goals 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_revision_goals_updated_at
BEFORE UPDATE ON public.revision_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();