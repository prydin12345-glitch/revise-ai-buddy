-- Phase 1: Fix Database Schema - Change question_number to TEXT to support sub-numbering (1.1, 2a, etc.)

-- Update exam_question_drafts table
ALTER TABLE exam_question_drafts 
ALTER COLUMN question_number TYPE TEXT;

-- Update exam_questions table
ALTER TABLE exam_questions 
ALTER COLUMN question_number TYPE TEXT;