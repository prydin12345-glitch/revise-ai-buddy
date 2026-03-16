

## Plan: Integrate Exam Board into Subjects, Fix Add Subject UX, and Sync Educational Levels

### Problem Summary
1. **Upload page (`/upload`)** and **Create Practice Questions** still use old hardcoded educational tier dropdowns (`secondary_14_16`, `college_16_18`, `university_18plus`) instead of the new board-linked `LEVEL_DISPLAY_NAMES` system
2. **Add Subject modal** doesn't close/confirm selection visually — user clicks a subject but the list stays open with no clear confirmation
3. **Subjects don't store exam board** — the `user_subjects` table has no `exam_board` column, so there's no per-subject board association
4. **Tutor Create Exam** page also uses old hardcoded tiers and doesn't auto-populate from preferences
5. **Exam profiles** (`subject_exam_profiles`) don't store `exam_board` either

### Implementation Steps

#### 1. Database Migration — Add `exam_board` to `user_subjects` and `subject_exam_profiles`
- Add `exam_board TEXT` column to `user_subjects`
- Add `exam_board TEXT` column to `subject_exam_profiles`
- Both nullable, no foreign key needed (stores board ID string like `'aqa'`, `'edexcel'`)

#### 2. Fix Upload Page (`src/pages/UploadExam.tsx`)
- Import `useUserPreferences`, `getLevelsForBoard`, `LEVEL_DISPLAY_NAMES`, `getRegionBoards`, `EXAM_BOARD_OPTIONS`
- Auto-populate `educationalTier` from `preferences.preferred_educational_level` and add `examBoard` state from `preferences.preferred_exam_board`
- Replace the hardcoded `<SelectItem>` list in Advanced Options with dynamic levels from `getLevelsForBoard(examBoard)`
- Add "Pre-filled from your profile · Change in Settings" note beneath

#### 3. Fix Create Practice Questions (`src/pages/CreatePracticeQuestions.tsx`)
- Replace **all three** hardcoded educational tier `<SelectContent>` blocks (desktop, mobile, mobile summary) with dynamic levels from `getLevelsForBoard(examBoard)`
- The `examBoard` state and preferences auto-population already exist (lines 71, 118-127), so just swap the dropdown items

#### 4. Fix Tutor Create Exam (`src/pages/tutor/CreateTutorExam.tsx`)
- Import `useUserPreferences`, board-level mapping utilities
- Add `useEffect` to auto-populate `educationalTier` and `examBoard` from preferences
- Replace hardcoded `EDUCATIONAL_TIERS` dropdown with dynamic `getLevelsForBoard`

#### 5. Fix Add Subject Modal UX (`src/components/stats/AddSubjectModal.tsx`)
- **Selection confirmation**: When user clicks a subject, immediately transition to a "confirmation view" showing the selected subject name prominently, the colour picker, and a new **exam board dropdown** (filtered by user's curriculum region via `getRegionBoards`)
- Hide the search list after selection — show a "← Back to list" button to re-select
- This fixes the confusion of the dropdown staying open
- Add `examBoard` local state, default to user's `preferences.preferred_exam_board`
- Save `exam_board` to `user_subjects` row on insert

#### 6. Update Subject Card (`src/components/stats/SubjectCard.tsx`)
- Show the exam board badge next to the subject name (e.g., "AQA" pill)
- If no board is set, show a subtle "Set board" link

#### 7. Update `useUserSubjects` hook
- Include `exam_board` in the fetched/returned data
- Update `saveOrUpdateSubject` to accept optional `examBoard` parameter
- Update the `UserSubject` interface

#### 8. Update Exam Profile Modal
- Add exam board field to `ExamProfileModal.tsx`, pre-filled from the subject's `exam_board` or user preferences
- Save `exam_board` to `subject_exam_profiles` table
- Pass board to generation context so AI uses correct mark scheme style

#### 9. Wire exam board from subject into Create Exam / Practice Quiz
- When a subject is selected in Create Exam or Create Practice Questions, look up its `exam_board` from `user_subjects` and auto-set the board dropdown (overriding the profile default if the subject has one)
- This means the board follows the subject, not just the global preference

#### 10. Tutor side parity
- Apply same educational level and board auto-population to `CreateTutorExam.tsx`

### Files to Modify
- `supabase/migrations/` — new migration for `exam_board` columns
- `src/hooks/useUserSubjects.ts` — add `exam_board` to interface and queries
- `src/components/stats/AddSubjectModal.tsx` — UX overhaul + exam board field
- `src/components/stats/SubjectCard.tsx` — show board badge
- `src/pages/UploadExam.tsx` — dynamic level dropdown + auto-populate
- `src/pages/CreatePracticeQuestions.tsx` — replace 3 hardcoded tier dropdowns
- `src/pages/tutor/CreateTutorExam.tsx` — dynamic levels + auto-populate
- `src/components/stats/ExamProfileModal.tsx` — add exam board field
- `src/hooks/useSubjectProfiles.ts` — include exam_board in profile data

