

# "My Subjects" with Exam Profiles, Master Topics, and AI Integration

## Overview

Add a "My Subjects" tab to the Stats page where users can manage per-subject topic lists and create "Exam Profiles" (e.g., "Maths Paper 1", "Maths Paper 2") with curated topic subsets and question count limits. These profiles feed directly into exam and practice quiz generation.

## Database Changes

### New Table: `subject_exam_profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | NOT NULL |
| subject_name | text | NOT NULL (e.g., "Mathematics") |
| profile_name | text | NOT NULL (e.g., "Paper 1") |
| topics | text[] | NOT NULL, the curated topic list |
| question_count | integer | NOT NULL, default 20, max 50 |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: Standard user_id = auth.uid() for all CRUD operations.

### New Table: `subject_master_topics`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | NOT NULL |
| subject_name | text | NOT NULL |
| topic | text | NOT NULL |
| created_at | timestamptz | default now() |

Unique constraint on (user_id, subject_name, topic). RLS: user_id = auth.uid() for all CRUD.

## Frontend Changes

### 1. Stats Page — Add "My Subjects" Tab
**File: `src/pages/Stats.tsx`**

Add a third tab "My Subjects" (with a BookOpen icon) alongside "Stats" and "Weak Topics". This tab renders a new `MySubjectsPanel` component.

### 2. New Component: `src/components/stats/MySubjectsPanel.tsx`
- Lists user's subjects (from `useUserSubjects`) as expandable accordion cards
- Each subject card shows:
  - **Master Topics section**: Input field + "Add" button to add topics. Shows existing topics as removable chips/badges. Sources from `subject_master_topics` table. Also pre-populates suggestions from the existing `SUBTOPIC_DICTIONARY` in SubtopicSelector.
  - **Exam Profiles section**: List of profiles (e.g., "Paper 1", "Paper 2") with a "+ Create Profile" button
  - Each profile shows: name, selected topics (as chips from the master list), question count slider (5-50)

### 3. New Component: `src/components/stats/ExamProfileModal.tsx`
- Modal for creating/editing an exam profile
- Fields: Profile Name (text input), Topics (multi-select from master topics as chips), Question Count (slider, 5-50)
- Save writes to `subject_exam_profiles` table

### 4. New Hook: `src/hooks/useSubjectProfiles.ts`
- CRUD operations for `subject_master_topics` and `subject_exam_profiles`
- `addTopic(subject, topic)`, `removeTopic(subject, topic)`, `getTopics(subject)`
- `createProfile(...)`, `updateProfile(...)`, `deleteProfile(...)`, `getProfiles(subject)`

### 5. CreatePracticeQuestions Integration
**File: `src/pages/CreatePracticeQuestions.tsx`**

- After subject selection, if profiles exist for that subject, show a "Use Exam Profile" dropdown
- Selecting a profile auto-fills: subtopics (from profile topics), question count (from profile)
- User can still override or use manual selection

### 6. CreateExam Integration
**File: `src/pages/CreateExam.tsx`**

- Same pattern: after subject selection, optional profile dropdown
- Profile selection pre-fills relevant fields

### 7. AI Prompt Integration
**File: `supabase/functions/generate-practice-questions/index.ts`**

When an exam profile is used, the system message includes:
```
"Generate questions using ONLY topics from this curated list: [topics]. 
Select an appropriate subset of [questionCount] questions. 
Do not use topics outside this list."
```

The profile info will be passed via the `practice_question_sets` record (a new `profile_id` column or the topics are already stored in `subtopics`). Since `subtopics` already feeds into the prompt, the main change is ensuring the profile's topic list populates `subtopics` on creation — no backend prompt changes needed beyond what already exists.

## Files to Create/Modify

| File | Action |
|---|---|
| Migration SQL | Create `subject_master_topics` and `subject_exam_profiles` tables with RLS |
| `src/hooks/useSubjectProfiles.ts` | New — CRUD hook |
| `src/components/stats/MySubjectsPanel.tsx` | New — main panel component |
| `src/components/stats/ExamProfileModal.tsx` | New — create/edit profile modal |
| `src/pages/Stats.tsx` | Add "My Subjects" tab |
| `src/pages/CreatePracticeQuestions.tsx` | Add profile selector dropdown |
| `src/pages/CreateExam.tsx` | Add profile selector dropdown |

## Technical Notes
- The existing `subtopics` field on `practice_question_sets` already feeds into the AI prompt, so selecting a profile just pre-fills that field — no edge function changes needed
- Question count limit: 5 minimum, 50 maximum enforced both in UI slider and DB check
- Master topics use the same `SUBTOPIC_DICTIONARY` for autocomplete suggestions but allow fully custom entries

