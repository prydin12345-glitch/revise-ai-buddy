-- Phase 1: Database Schema Extension

-- Add exam board, qualification level, and spec file URL to exams table
ALTER TABLE exams
ADD COLUMN exam_board TEXT,
ADD COLUMN qualification_level TEXT,
ADD COLUMN specification_file_url TEXT;

-- Create exam_specifications table for parsed spec topics
CREATE TABLE exam_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  assessment_objectives TEXT[],
  page_numbers INTEGER[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on exam_specifications
ALTER TABLE exam_specifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for exam_specifications
CREATE POLICY "Users can manage own exam specifications"
ON exam_specifications
FOR ALL
USING (EXISTS (
  SELECT 1 FROM exams
  WHERE exams.id = exam_specifications.exam_id
  AND exams.user_id = auth.uid()
));

-- Add difficulty calibration to exam_format table
ALTER TABLE exam_format
ADD COLUMN difficulty_calibration TEXT DEFAULT 'exam_board_standard';

-- Add flagging columns to exam_question_drafts
ALTER TABLE exam_question_drafts
ADD COLUMN is_flagged BOOLEAN DEFAULT false,
ADD COLUMN flag_reason TEXT;