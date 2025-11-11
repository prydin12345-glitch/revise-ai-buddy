-- Phase 1: Add new columns to revision_tasks table
ALTER TABLE public.revision_tasks
ADD COLUMN status TEXT DEFAULT 'scheduled' CHECK (status IN ('inbox', 'scheduled', 'archived')),
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN idle_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN focus_session_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN focus_session_duration INTEGER DEFAULT 0,
ADD COLUMN next_review_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_private BOOLEAN DEFAULT FALSE,
ADD COLUMN last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to update last_modified_at
CREATE OR REPLACE FUNCTION public.update_revision_task_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_revision_task_modified_trigger
BEFORE UPDATE ON public.revision_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_revision_task_modified();

-- Phase 2: Create daily_goals table
CREATE TABLE public.daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  target_minutes INTEGER NOT NULL DEFAULT 180,
  completed_minutes INTEGER NOT NULL DEFAULT 0,
  blocks_completed INTEGER NOT NULL DEFAULT 0,
  longest_focus_block INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS on daily_goals
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_goals
CREATE POLICY "Users can view their own daily goals"
ON public.daily_goals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily goals"
ON public.daily_goals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily goals"
ON public.daily_goals
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily goals"
ON public.daily_goals
FOR DELETE
USING (auth.uid() = user_id);

-- Phase 3: Create weekly_subject_stats table
CREATE TABLE public.weekly_subject_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  subject TEXT NOT NULL,
  subject_color TEXT NOT NULL DEFAULT '#3B82F6',
  total_minutes INTEGER NOT NULL DEFAULT 0,
  blocks_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week_start, subject)
);

-- Enable RLS on weekly_subject_stats
ALTER TABLE public.weekly_subject_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for weekly_subject_stats
CREATE POLICY "Users can view their own weekly stats"
ON public.weekly_subject_stats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own weekly stats"
ON public.weekly_subject_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly stats"
ON public.weekly_subject_stats
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weekly stats"
ON public.weekly_subject_stats
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for weekly_subject_stats updated_at
CREATE TRIGGER update_weekly_subject_stats_updated_at
BEFORE UPDATE ON public.weekly_subject_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();