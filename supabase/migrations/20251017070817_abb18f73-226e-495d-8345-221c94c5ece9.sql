-- Add generation tracking columns to exam_question_drafts
ALTER TABLE exam_question_drafts 
ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'extracted',
ADD COLUMN IF NOT EXISTS image_handling_strategy TEXT,
ADD COLUMN IF NOT EXISTS original_question_text TEXT;

-- Add index for filtering by generation status
CREATE INDEX IF NOT EXISTS idx_generation_status ON exam_question_drafts(generation_status);

-- Add comments for clarity
COMMENT ON COLUMN exam_question_drafts.generation_status IS 
  'Values: extracted, ai_generated, image_referenced, structure_inspired';

COMMENT ON COLUMN exam_question_drafts.image_handling_strategy IS 
  'Values: concept_replacement, original_reference, none';