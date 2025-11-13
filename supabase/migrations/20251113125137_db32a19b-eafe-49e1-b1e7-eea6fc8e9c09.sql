-- Create practice set progress tracking table
CREATE TABLE practice_set_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  set_id UUID NOT NULL REFERENCES practice_question_sets(id) ON DELETE CASCADE,
  questions_attempted INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_spent_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, set_id)
);

-- Enable RLS
ALTER TABLE practice_set_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for practice_set_progress
CREATE POLICY "Users can view own progress"
  ON practice_set_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON practice_set_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON practice_set_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_practice_set_progress_updated_at
  BEFORE UPDATE ON practice_set_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create favorites table for practice sets
CREATE TABLE favourite_practice_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  set_id UUID NOT NULL REFERENCES practice_question_sets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, set_id)
);

-- Enable RLS
ALTER TABLE favourite_practice_sets ENABLE ROW LEVEL SECURITY;

-- RLS policies for favourite_practice_sets
CREATE POLICY "Users can view own favourites"
  ON favourite_practice_sets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favourites"
  ON favourite_practice_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own favourites"
  ON favourite_practice_sets FOR DELETE
  USING (auth.uid() = user_id);