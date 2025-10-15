-- Phase 1: Database Schema Enhancement

-- Add new columns to exam_questions for extracted content metadata
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS 
  original_page_number INTEGER;

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS 
  has_figures BOOLEAN DEFAULT FALSE;

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS 
  has_tables BOOLEAN DEFAULT FALSE;

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS 
  figure_urls TEXT[];

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS 
  topic_tag TEXT;

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS 
  difficulty_level TEXT;

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS 
  extraction_confidence NUMERIC(3,2);

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS 
  is_verified BOOLEAN DEFAULT FALSE;

-- Create exam_question_drafts table for preview/editing before publishing
CREATE TABLE IF NOT EXISTS exam_question_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  marks INTEGER NOT NULL,
  options JSONB,
  correct_answer TEXT,
  original_page_number INTEGER,
  has_figures BOOLEAN DEFAULT FALSE,
  has_tables BOOLEAN DEFAULT FALSE,
  figure_urls TEXT[],
  topic_tag TEXT,
  difficulty_level TEXT,
  extraction_confidence NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, question_number)
);

-- Enable RLS on exam_question_drafts
ALTER TABLE exam_question_drafts ENABLE ROW LEVEL SECURITY;

-- RLS policies for exam_question_drafts
CREATE POLICY "Users can manage own exam question drafts"
  ON exam_question_drafts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM exams 
      WHERE exams.id = exam_question_drafts.exam_id 
      AND exams.user_id = auth.uid()
    )
  );

-- Add extraction status tracking to exams table
ALTER TABLE exams ADD COLUMN IF NOT EXISTS 
  extraction_status TEXT DEFAULT 'pending';

ALTER TABLE exams ADD COLUMN IF NOT EXISTS 
  total_questions_extracted INTEGER DEFAULT 0;

ALTER TABLE exams ADD COLUMN IF NOT EXISTS 
  extraction_error TEXT;