-- Phase 2: Add enhanced question fields for graphs, tables, circuits, and scenarios

-- Add enhanced fields to exam_question_drafts table
ALTER TABLE exam_question_drafts 
ADD COLUMN IF NOT EXISTS data_type TEXT,
ADD COLUMN IF NOT EXISTS graph_description TEXT,
ADD COLUMN IF NOT EXISTS table_data TEXT,
ADD COLUMN IF NOT EXISTS circuit_type TEXT,
ADD COLUMN IF NOT EXISTS circuit_description TEXT,
ADD COLUMN IF NOT EXISTS needs_diagram BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS diagram_type TEXT,
ADD COLUMN IF NOT EXISTS scenario_context TEXT,
ADD COLUMN IF NOT EXISTS command_verb TEXT,
ADD COLUMN IF NOT EXISTS numerical_answer TEXT,
ADD COLUMN IF NOT EXISTS generated_diagram_url TEXT;

-- Mirror changes to exam_questions table
ALTER TABLE exam_questions 
ADD COLUMN IF NOT EXISTS data_type TEXT,
ADD COLUMN IF NOT EXISTS graph_description TEXT,
ADD COLUMN IF NOT EXISTS table_data TEXT,
ADD COLUMN IF NOT EXISTS circuit_type TEXT,
ADD COLUMN IF NOT EXISTS circuit_description TEXT,
ADD COLUMN IF NOT EXISTS needs_diagram BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS diagram_type TEXT,
ADD COLUMN IF NOT EXISTS scenario_context TEXT,
ADD COLUMN IF NOT EXISTS command_verb TEXT,
ADD COLUMN IF NOT EXISTS numerical_answer TEXT,
ADD COLUMN IF NOT EXISTS generated_diagram_url TEXT;

-- Add comments for clarity
COMMENT ON COLUMN exam_question_drafts.data_type IS 
  'Values: graph, table, both, none - indicates presence of data visualization';

COMMENT ON COLUMN exam_question_drafts.circuit_type IS 
  'Values: series, parallel, voltage_divider, complex, none - for electrical circuit questions';

COMMENT ON COLUMN exam_question_drafts.diagram_type IS 
  'Values: circuit, graph, apparatus, geometric, other - type of diagram needed';

COMMENT ON COLUMN exam_question_drafts.command_verb IS 
  'Primary command word: calculate, explain, describe, discuss, deduce, show, evaluate, etc.';

COMMENT ON COLUMN exam_question_drafts.scenario_context IS 
  'Real-world context or experimental setup description';

COMMENT ON COLUMN exam_question_drafts.numerical_answer IS 
  'Expected numerical answer if calculable';

COMMENT ON COLUMN exam_question_drafts.generated_diagram_url IS 
  'URL of AI-generated diagram image';