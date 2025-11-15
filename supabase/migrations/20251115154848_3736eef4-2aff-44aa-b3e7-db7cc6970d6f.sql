-- Add priority, progress, and confidence tracking to revision_tasks
ALTER TABLE revision_tasks
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
ADD COLUMN IF NOT EXISTS confidence_before INTEGER CHECK (confidence_before >= 1 AND confidence_before <= 5),
ADD COLUMN IF NOT EXISTS confidence_after INTEGER CHECK (confidence_after >= 1 AND confidence_after <= 5),
ADD COLUMN IF NOT EXISTS auto_rescheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS missed_count INTEGER DEFAULT 0;

-- Add target scores and confidence to revision_goals
ALTER TABLE revision_goals
ADD COLUMN IF NOT EXISTS current_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5);

-- Create session_feedback table for tracking post-session reflections
CREATE TABLE IF NOT EXISTS session_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  task_id UUID NOT NULL REFERENCES revision_tasks(id) ON DELETE CASCADE,
  confidence_rating INTEGER NOT NULL CHECK (confidence_rating >= 1 AND confidence_rating <= 5),
  understood BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on session_feedback
ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for session_feedback
CREATE POLICY "Users can view own session feedback"
  ON session_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session feedback"
  ON session_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session feedback"
  ON session_feedback FOR UPDATE
  USING (auth.uid() = user_id);