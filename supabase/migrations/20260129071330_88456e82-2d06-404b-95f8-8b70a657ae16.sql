-- Create resource_packs table
CREATE TABLE public.resource_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Basic metadata
  title TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  educational_tier TEXT,
  exam_board TEXT,
  
  -- Pack type and source
  pack_type TEXT NOT NULL CHECK (pack_type IN ('uploaded', 'ai_generated', 'extracted')),
  source_file_url TEXT,
  
  -- Example paper for pattern learning (Phase 2)
  example_paper_url TEXT,
  learned_patterns JSONB,
  
  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'failed')),
  processing_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create resource_items table
CREATE TABLE public.resource_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES public.resource_packs(id) ON DELETE CASCADE NOT NULL,
  
  -- Resource identification
  source_label TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'text_extract',
    'case_study',
    'data_table',
    'map',
    'image',
    'graph',
    'transcript',
    'article',
    'experiment_data',
    'poem_excerpt',
    'primary_source',
    'historian_interpretation'
  )),
  
  -- Content storage
  content_text TEXT,
  content_html TEXT,
  content_url TEXT,
  content_json JSONB,
  
  -- Metadata
  word_count INTEGER,
  attribution TEXT,
  difficulty_contribution TEXT CHECK (difficulty_contribution IN ('simple', 'moderate', 'complex')),
  
  -- Ordering
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add resource_pack_id to practice_question_sets
ALTER TABLE public.practice_question_sets
ADD COLUMN IF NOT EXISTS resource_pack_id UUID REFERENCES public.resource_packs(id),
ADD COLUMN IF NOT EXISTS resource_mode TEXT DEFAULT 'none' CHECK (resource_mode IN ('none', 'uploaded', 'ai_generated'));

-- Add resource references to practice_questions
ALTER TABLE public.practice_questions
ADD COLUMN IF NOT EXISTS resource_item_ids UUID[],
ADD COLUMN IF NOT EXISTS resource_references TEXT[];

-- Add resource_pack_id to exams
ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS resource_pack_id UUID REFERENCES public.resource_packs(id);

-- Enable RLS on new tables
ALTER TABLE public.resource_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for resource_packs
CREATE POLICY "Users can view their own resource packs"
ON public.resource_packs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own resource packs"
ON public.resource_packs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resource packs"
ON public.resource_packs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resource packs"
ON public.resource_packs FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for resource_items (access through pack ownership)
CREATE POLICY "Users can view resource items from their packs"
ON public.resource_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.resource_packs
    WHERE resource_packs.id = resource_items.pack_id
    AND resource_packs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create resource items in their packs"
ON public.resource_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.resource_packs
    WHERE resource_packs.id = pack_id
    AND resource_packs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update resource items in their packs"
ON public.resource_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.resource_packs
    WHERE resource_packs.id = resource_items.pack_id
    AND resource_packs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete resource items from their packs"
ON public.resource_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.resource_packs
    WHERE resource_packs.id = resource_items.pack_id
    AND resource_packs.user_id = auth.uid()
  )
);

-- Create updated_at trigger for resource_packs
CREATE TRIGGER update_resource_packs_updated_at
BEFORE UPDATE ON public.resource_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();