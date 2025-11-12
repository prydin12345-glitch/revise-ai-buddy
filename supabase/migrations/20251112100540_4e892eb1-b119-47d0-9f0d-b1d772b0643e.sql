-- Create practice_question_sets table
CREATE TABLE practice_question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_id TEXT NOT NULL,
  set_name TEXT NOT NULL,
  notes TEXT,
  subtopics TEXT[] NOT NULL,
  question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 30),
  difficulty_mode TEXT CHECK (difficulty_mode IN ('fixed', 'increasing', 'mixed')),
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  specification_file_url TEXT,
  example_questions_file_url TEXT,
  educational_tier TEXT,
  exam_board TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'extracting', 'completed', 'failed')),
  extraction_error TEXT,
  total_questions_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for practice_question_sets
ALTER TABLE practice_question_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own practice sets"
  ON practice_question_sets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own practice sets"
  ON practice_question_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice sets"
  ON practice_question_sets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice sets"
  ON practice_question_sets FOR DELETE
  USING (auth.uid() = user_id);

-- Create practice_questions table
CREATE TABLE practice_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID REFERENCES practice_question_sets(id) ON DELETE CASCADE,
  question_number TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_latex TEXT,
  question_type TEXT NOT NULL,
  marks INTEGER NOT NULL,
  subtopic TEXT NOT NULL,
  difficulty_level TEXT,
  has_math BOOLEAN DEFAULT FALSE,
  equation_complexity TEXT,
  correct_answer TEXT,
  options JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for practice_questions
ALTER TABLE practice_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions from own sets"
  ON practice_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM practice_question_sets 
    WHERE practice_question_sets.id = practice_questions.set_id 
    AND practice_question_sets.user_id = auth.uid()
  ));

-- Create subject_subtopics table
CREATE TABLE subject_subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  educational_tier TEXT,
  exam_board TEXT,
  is_user_added BOOLEAN DEFAULT FALSE,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject, subtopic, educational_tier, exam_board)
);

-- Add RLS policies for subject_subtopics
ALTER TABLE subject_subtopics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subtopics"
  ON subject_subtopics FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can add custom subtopics"
  ON subject_subtopics FOR INSERT
  WITH CHECK (is_user_added = TRUE AND auth.uid() = user_id);

-- Seed common subtopics
INSERT INTO subject_subtopics (subject, subtopic, educational_tier, exam_board) VALUES
  -- Mathematics A-Level
  ('Mathematics', 'Coordinate Geometry', 'a_level', 'edexcel'),
  ('Mathematics', 'Sequences and Series', 'a_level', 'edexcel'),
  ('Mathematics', 'Trigonometry', 'a_level', 'edexcel'),
  ('Mathematics', 'Calculus - Differentiation', 'a_level', 'edexcel'),
  ('Mathematics', 'Calculus - Integration', 'a_level', 'edexcel'),
  ('Mathematics', 'Vectors', 'a_level', 'edexcel'),
  ('Mathematics', 'Algebra', 'a_level', 'edexcel'),
  ('Mathematics', 'Functions', 'a_level', 'edexcel'),
  ('Mathematics', 'Binomial Expansion', 'a_level', 'edexcel'),
  ('Mathematics', 'Exponentials and Logarithms', 'a_level', 'edexcel'),
  -- Physics A-Level
  ('Physics', 'Mechanics', 'a_level', 'aqa'),
  ('Physics', 'Electricity and Magnetism', 'a_level', 'aqa'),
  ('Physics', 'Waves and Optics', 'a_level', 'aqa'),
  ('Physics', 'Thermal Physics', 'a_level', 'aqa'),
  ('Physics', 'Nuclear Physics', 'a_level', 'aqa'),
  -- Chemistry A-Level
  ('Chemistry', 'Organic Chemistry', 'a_level', 'aqa'),
  ('Chemistry', 'Physical Chemistry', 'a_level', 'aqa'),
  ('Chemistry', 'Inorganic Chemistry', 'a_level', 'aqa'),
  ('Chemistry', 'Thermodynamics', 'a_level', 'aqa'),
  ('Chemistry', 'Kinetics', 'a_level', 'aqa'),
  -- Biology A-Level
  ('Biology', 'Cell Biology', 'a_level', 'ocr'),
  ('Biology', 'Genetics', 'a_level', 'ocr'),
  ('Biology', 'Evolution', 'a_level', 'ocr'),
  ('Biology', 'Ecology', 'a_level', 'ocr'),
  ('Biology', 'Human Physiology', 'a_level', 'ocr');

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_practice_set_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_practice_set_updated_at
  BEFORE UPDATE ON practice_question_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_practice_set_modified();