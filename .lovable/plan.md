

# Insert / Resource Pack System - Implementation Plan

## Overview

This plan introduces a Resource Pack system that mirrors how real exams are structured across all subjects (English, History, Geography, Economics, Sciences, etc.). Instead of generating disconnected standalone questions, the system will generate or accept shared resources (inserts) and then build all questions around that unified material.

## Current State Analysis

### Existing Architecture

**Database Tables:**
- `practice_question_sets` - Stores metadata for question sets (subject, difficulty, notes, subtopics)
- `practice_questions` - Individual questions with `set_id` foreign key
- `exams` - Exam metadata with `file_url` for uploaded PDFs
- `exam_question_drafts` / `exam_questions` - Questions with `scenario_context` field (partial support)

**Edge Functions:**
- `generate-practice-questions/index.ts` - Generates questions from subtopics/notes using Lovable AI
- `extract-exam-questions/index.ts` - Extracts/generates questions from uploaded PDFs

**Current Problem:**
The AI generates questions independently, sometimes inventing content inline within each question. There is no:
- Shared source text
- Resource booklet concept
- Scenario/case study linking
- Dataset that questions reference together

---

## Database Schema Design

### New Table: `resource_packs`

```sql
CREATE TABLE resource_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Basic metadata
  title TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  educational_tier TEXT,
  exam_board TEXT,
  
  -- Pack type and source
  pack_type TEXT NOT NULL CHECK (pack_type IN ('uploaded', 'ai_generated', 'extracted')),
  source_file_url TEXT,  -- For uploaded inserts
  
  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'failed')),
  processing_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### New Table: `resource_items`

```sql
CREATE TABLE resource_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES resource_packs(id) ON DELETE CASCADE NOT NULL,
  
  -- Resource identification
  source_label TEXT NOT NULL,  -- e.g., "Source A", "Extract 1", "Figure 3.2"
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'text_extract',      -- English/History source texts
    'case_study',        -- Economics/Business case studies
    'data_table',        -- Statistics/Science data tables
    'map',               -- Geography maps
    'image',             -- Diagrams, photographs
    'graph',             -- Pre-drawn graphs for interpretation
    'transcript',        -- Interview/speech transcripts
    'article',           -- News articles, reports
    'experiment_data'    -- Science experiment results
  )),
  
  -- Content storage
  content_text TEXT,           -- For text-based resources
  content_html TEXT,           -- For rich formatted content
  content_url TEXT,            -- For images/files stored in storage
  content_json JSONB,          -- For structured data (tables, graphs)
  
  -- Metadata
  word_count INTEGER,
  attribution TEXT,            -- Source attribution for authenticity
  difficulty_contribution TEXT CHECK (difficulty_contribution IN ('simple', 'moderate', 'complex')),
  
  -- Ordering
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Modified Table: `practice_question_sets`

```sql
-- Add column to link sets to resource packs
ALTER TABLE practice_question_sets
ADD COLUMN resource_pack_id UUID REFERENCES resource_packs(id);

-- Add column to track resource mode
ALTER TABLE practice_question_sets
ADD COLUMN resource_mode TEXT DEFAULT 'none' 
  CHECK (resource_mode IN ('none', 'uploaded', 'ai_generated'));
```

### Modified Table: `practice_questions`

```sql
-- Add columns to link questions to specific resources
ALTER TABLE practice_questions
ADD COLUMN resource_item_ids UUID[],  -- Can reference multiple resources
ADD COLUMN resource_references TEXT[];  -- e.g., ["Source A", "Source B"]
```

### Modified Table: `exams`

```sql
ALTER TABLE exams
ADD COLUMN resource_pack_id UUID REFERENCES resource_packs(id);
```

---

## Phase 1: Upload Resource + Generate Questions

### User Flow

1. User navigates to Create Practice Questions
2. User sees new option: "Add Resource Pack"
3. User uploads Insert PDF (e.g., English sources, History documents)
4. System extracts and structures resources
5. User configures question count/difficulty
6. AI generates questions that ALL reference the uploaded resources

### Technical Implementation

#### Frontend: Updated `CreatePracticeQuestions.tsx`

Add new UI section for resource pack selection:

```text
┌─────────────────────────────────────────────────────┐
│  Resource Mode                                       │
├─────────────────────────────────────────────────────┤
│  ○ No resources (standalone questions)              │
│  ● Upload Insert/Resource Pack                       │
│  ○ Generate AI Resource Pack                        │
├─────────────────────────────────────────────────────┤
│  [📄 Upload Insert PDF]                             │
│  "AQA_English_Insert_June2024.pdf" ✓                │
└─────────────────────────────────────────────────────┘
```

New components to create:
- `ResourceModeSelector.tsx` - Toggle between modes
- `ResourcePackUploader.tsx` - Upload and preview resources
- `ResourceItemPreview.tsx` - Display extracted resources

#### New Edge Function: `extract-resource-pack/index.ts`

```text
Purpose: Parse uploaded Insert PDFs into structured resource items

Process:
1. Accept PDF file URL
2. Extract text using pdfjs-serverless
3. Use AI to identify discrete sources (Source A, Source B, etc.)
4. Structure each source with:
   - Label (Source A)
   - Type (text_extract, data_table, image)
   - Content (cleaned text)
   - Metadata (word count, attribution)
5. Store in resource_items table
6. Return pack_id for linking
```

#### Updated Edge Function: `generate-practice-questions/index.ts`

Add resource-aware generation:

```text
If resource_pack_id is provided:
1. Fetch all resource_items for the pack
2. Build resource context section for AI prompt:
   
   "=== RESOURCE PACK (SHARED INSERT) ===
   
   SOURCE A: [Title]
   [Full text of Source A]
   
   SOURCE B: [Title]  
   [Full text of Source B]
   
   === END RESOURCE PACK ===
   
   CRITICAL: ALL questions MUST reference the above sources.
   - Question 1 should use Source A
   - Question 2 should compare Sources A and B
   - Question 3 should evaluate Source B
   - etc.
   
   DO NOT invent new content. Use ONLY the provided sources."

3. Generate questions with explicit source references
4. Store resource_item_ids on each question
```

---

## Phase 2: Upload Resource + Example Paper

### User Flow

1. User uploads Insert PDF
2. User uploads Past Question Paper PDF
3. System learns:
   - Question structure per resource
   - Difficulty patterns
   - Command verb usage
4. System generates NEW questions matching the learned style

### Technical Implementation

Add to resource_packs table:

```sql
ALTER TABLE resource_packs
ADD COLUMN example_paper_url TEXT,
ADD COLUMN learned_patterns JSONB;
-- learned_patterns stores: {
--   "questions_per_source": 3,
--   "typical_marks": [4, 8, 12],
--   "command_verbs": ["analyse", "evaluate", "compare"],
--   "difficulty_progression": ["simple", "moderate", "complex"]
-- }
```

Update `extract-resource-pack/index.ts`:
- If example paper provided, analyze question patterns
- Store learned patterns in `learned_patterns` JSONB
- Use patterns to guide generation

---

## Phase 3: AI-Generated Resource Pack

### User Flow

1. User selects "Generate AI Resource Pack"
2. User specifies:
   - Subject (English Literature, Geography, etc.)
   - Topic (Victorian novels, Climate change, etc.)
   - Complexity level (GCSE, A-Level, etc.)
3. AI generates realistic resources:
   - English: Prose extracts, poetry excerpts
   - History: Primary source documents, historian interpretations
   - Geography: Case study data, maps, statistics
   - Economics: Company reports, market data
   - Sciences: Experiment data, result tables
4. User can preview/edit resources
5. Questions generated from AI resources

### Technical Implementation

#### New Edge Function: `generate-resource-pack/index.ts`

```text
Purpose: Generate realistic exam-style resources

Process:
1. Accept subject, topic, educational tier
2. Determine appropriate resource types for subject
3. Use AI to generate:
   - Authentic-feeling text extracts
   - Realistic data tables
   - Appropriate case studies
4. Apply difficulty scaling based on tier
5. Store in resource_items
6. Return pack_id
```

Subject-specific resource templates:

```typescript
const SUBJECT_RESOURCE_TYPES = {
  'english_literature': ['text_extract', 'poem_excerpt'],
  'english_language': ['article', 'transcript', 'text_extract'],
  'history': ['primary_source', 'historian_interpretation', 'image'],
  'geography': ['case_study', 'data_table', 'map', 'article'],
  'economics': ['case_study', 'data_table', 'article', 'graph'],
  'business': ['case_study', 'data_table', 'article'],
  'biology': ['experiment_data', 'data_table', 'graph', 'image'],
  'chemistry': ['experiment_data', 'data_table', 'graph'],
  'physics': ['experiment_data', 'data_table', 'graph'],
  'psychology': ['case_study', 'data_table', 'article'],
  'sociology': ['case_study', 'data_table', 'article'],
};
```

---

## Difficulty Scaling via Resources

Resources control difficulty more than question wording:

| Level | Resource Complexity | Example |
|-------|---------------------|---------|
| GCSE | Simple, 150-300 words | Clear extract with obvious themes |
| A-Level | Moderate, 300-500 words | Nuanced source requiring analysis |
| University | Complex, 500-800 words | Dense academic text with subtle arguments |

The system automatically scales:
- Word count
- Vocabulary complexity
- Data density (for tables/graphs)
- Ambiguity level (simple = clear answers, complex = nuanced interpretation)

---

## Core System Rules

1. **Every question set can optionally have one shared Resource Pack**
2. **If a resource exists, ALL questions must reference it**
3. **No random standalone content if resource mode is enabled**
4. **Questions explicitly cite sources**: "Using Source A, explain..." / "Compare Sources A and B..."
5. **Validation layer**: Reject questions that don't reference the pack

---

## UI/UX Design

### Resource Mode Selection

```text
┌─────────────────────────────────────────────────────────────┐
│  How would you like to create this question set?            │
├─────────────────────────────────────────────────────────────┤
│  [📝] Standalone Questions                                  │
│       Traditional questions without shared resources         │
│                                                             │
│  [📄] Upload Insert/Resources                               │
│       Upload an exam insert PDF to generate linked questions │
│                                                             │
│  [✨] AI-Generated Resources                                │
│       Let AI create realistic sources, then build questions │
└─────────────────────────────────────────────────────────────┘
```

### Resource Preview (after extraction/generation)

```text
┌─────────────────────────────────────────────────────────────┐
│  Resource Pack Preview                      [Edit] [Clear]  │
├─────────────────────────────────────────────────────────────┤
│  SOURCE A: "The Impact of Urbanisation" (342 words)         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Extract from a 2023 report on city development...    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SOURCE B: Population Data Table                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Year | Urban Pop | Rural Pop | Change               │   │
│  │ 2010 | 3.5bn     | 3.4bn     | +2.9%               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SOURCE C: World Map (Image)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Map showing urbanisation rates by country]          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/practice/ResourceModeSelector.tsx` | Toggle between resource modes |
| `src/components/practice/ResourcePackUploader.tsx` | Upload and manage resource PDFs |
| `src/components/practice/ResourcePackPreview.tsx` | Display extracted/generated resources |
| `src/components/practice/ResourceItemCard.tsx` | Individual resource item display |
| `supabase/functions/extract-resource-pack/index.ts` | Parse uploaded inserts |
| `supabase/functions/generate-resource-pack/index.ts` | AI-generate resources |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CreatePracticeQuestions.tsx` | Add resource mode UI, wire up new components |
| `src/pages/tutor/CreateTutorExam.tsx` | Add resource pack option for tutor exams |
| `supabase/functions/generate-practice-questions/index.ts` | Resource-aware generation logic |
| `supabase/functions/extract-exam-questions/index.ts` | Optional resource pack linking |
| `src/pages/TakePracticeQuiz.tsx` | Display resource pack alongside questions |
| `src/pages/PracticeSetPreview.tsx` | Show resource pack in preview |

---

## Database Migrations

Three migrations required:

1. **Create resource_packs table**
2. **Create resource_items table**
3. **Alter existing tables** (practice_question_sets, practice_questions, exams)

---

## Implementation Order

### Week 1: Foundation
1. Create database migrations for new tables
2. Build `ResourceModeSelector` component
3. Create `extract-resource-pack` edge function
4. Basic resource extraction from PDFs

### Week 2: Integration
5. Update `generate-practice-questions` with resource context
6. Build resource preview components
7. Wire up full upload flow
8. Test with English/History inserts

### Week 3: AI Generation
9. Create `generate-resource-pack` edge function
10. Subject-specific resource templates
11. AI resource generation UI
12. Difficulty scaling based on tier

### Week 4: Polish
13. Update quiz-taking UI to show resources
14. Add resource editing capabilities
15. Test across all subject types
16. Performance optimization

---

## Expected Outcomes

After implementation:

1. **Realistic exam structure** - Matches how real exam boards work
2. **Linked questions** - All questions reference shared materials
3. **Better difficulty control** - Complexity in resources, not just wording
4. **Cross-subject support** - English, History, Geography, Economics, Sciences
5. **Three creation paths** - Upload, upload+example, or AI-generate
6. **Exam simulator** - Not just a question generator

---

## Technical Considerations

### Storage
- Resource images stored in `exam-files` bucket under `resources/` prefix
- Text content stored directly in database (efficient for search)
- Large PDFs processed in background with status polling

### Performance
- Resource extraction runs async with `EdgeRuntime.waitUntil`
- Resources cached in state during question generation
- Lazy load resource previews to avoid blocking UI

### Validation
- Questions without resource references rejected in resource mode
- Resource items validated for minimum content length
- Difficulty scoring applied to resource complexity

