-- Add visual question preference columns to practice_question_sets
ALTER TABLE public.practice_question_sets
ADD COLUMN IF NOT EXISTS include_graphs boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS include_tables boolean DEFAULT false;