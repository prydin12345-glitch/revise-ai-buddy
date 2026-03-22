ALTER TABLE practice_questions ADD COLUMN IF NOT EXISTS rationale text DEFAULT NULL;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS rationale text DEFAULT NULL;