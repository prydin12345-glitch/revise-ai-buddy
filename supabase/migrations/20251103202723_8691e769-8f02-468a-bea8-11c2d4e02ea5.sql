-- Add archived status to exam_status enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t 
                   JOIN pg_enum e ON t.oid = e.enumtypid  
                   WHERE t.typname = 'exam_status' 
                   AND e.enumlabel = 'archived') THEN
        ALTER TYPE exam_status ADD VALUE 'archived';
    END IF;
END $$;

-- Create favourite_exams junction table
CREATE TABLE IF NOT EXISTS public.favourite_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, exam_id)
);

-- Enable RLS
ALTER TABLE public.favourite_exams ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own favourites" 
ON public.favourite_exams 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favourites" 
ON public.favourite_exams 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favourites" 
ON public.favourite_exams 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_favourite_exams_user_id ON public.favourite_exams(user_id);
CREATE INDEX IF NOT EXISTS idx_favourite_exams_exam_id ON public.favourite_exams(exam_id);