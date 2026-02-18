

# Legal and Privacy Compliance Framework

## Overview

This plan implements a comprehensive legal and privacy layer across the platform to mitigate copyright and trademark liability while preserving full educational functionality. The changes span frontend UI, backend edge functions, and post-processing logic.

---

## 1. Ephemeral PDF Processing (Zero-Persistence)

### Current State
- Uploaded PDFs are stored permanently in the `exam-files` Supabase Storage bucket
- Files remain accessible indefinitely after upload

### Changes

**A. Upload Declaration Checkbox**
- Add a mandatory checkbox to all upload forms before the submit button:
  - `src/pages/UploadExam.tsx` (exam upload)
  - `src/pages/CreatePracticeQuestions.tsx` (spec/example file upload)
  - `src/components/practice/ResourcePackUploader.tsx` (resource pack upload)
  - `src/pages/CreateExam.tsx` (tutor exam creation)
- Checkbox text: "I confirm I have lawful access to this material and am using it for private study and non-commercial educational purposes only."
- Submit button remains disabled until checkbox is ticked

**B. Scheduled File Cleanup**
- Create a new edge function `cleanup-expired-files/index.ts` that:
  - Queries the `exams` table for records older than 24 hours with a non-null `file_url`
  - Deletes the corresponding file from storage
  - Sets `file_url` to `NULL` in the database
  - Does the same for `specification_file_url`, `source_file_url` on `resource_packs`, and practice set spec/example URLs
- The function processes in batches and logs deletions
- Note: The actual PDF content is already extracted into structured text/JSON during analysis -- the original file is not needed after processing

**C. Immediate Cleanup After Processing**
- In `upload-exam/index.ts` and `extract-resource-pack/index.ts`: after the AI has finished extracting content, delete the source file from storage immediately rather than waiting for the scheduled cleanup
- Add a `file_processed_at` timestamp column to track when extraction completed

---

## 2. Trademark and Branding Scrubbing

### Current State
- Exam board names (AQA, Edexcel, OCR, etc.) appear verbatim in:
  - Dropdown menus
  - AI prompts
  - Generated question text
  - PDF exports
  - Database records

### Changes

**A. Rebrand Dropdown Labels (Frontend)**
- Replace exam board dropdowns in `UploadExam.tsx`, `CreateExam.tsx`, `CreatePracticeQuestions.tsx`, and `tutor/EditExam.tsx` with generic descriptors:

```text
Current                          -->  New Label
AQA                              -->  "UK Board A (command-verb style)"
Edexcel                          -->  "UK Board B (Pearson style)"  
OCR                              -->  "UK Board C (structured response)"
Cambridge International (CIE)    -->  "International Board (Cambridge style)"
International Baccalaureate (IB) -->  "IB Programme"
WJEC                             -->  "Welsh Board (WJEC style)"
```

- Internal `id` values remain unchanged so existing database records still work
- Add a small info tooltip: "Board selection determines question style, command verbs, and mark scheme format. We are not affiliated with any examination board."

**B. AI Prompt Translation (Edge Functions)**
- In `generate-practice-questions/index.ts` (line ~898): before injecting the exam board into the prompt, translate it:
  - `aqa` becomes "UK exam board using command verbs like 'evaluate', 'explain', 'compare'; structured mark schemes"
  - `edexcel` becomes "UK exam board (Pearson) with data-response and multi-part questions"
  - `ocr` becomes "UK exam board with structured response format and synoptic assessment"
- The AI never sees the actual trademarked name in its system prompt

**C. Output Scrubbing (Post-Processing)**
- Create a utility function `scrubBoardReferences(text: string): string` used in the edge function after AI generation
- Removes:
  - Exam board names: AQA, Edexcel, OCR, WJEC, Pearson, Cambridge International, CIE
  - Year/session codes: "June 2023", "Jan 2011", "Paper 1 2022"
  - Original question references: "Question 21a", "Q3(b)(ii) from Paper 2"
- Applied to: `question_text`, `correct_answer` text fields, `feedback` text
- Does NOT touch: numerical values, coordinates, graph data, table data, or `expectedPath` arrays

**D. PDF Export Scrubbing**
- In `src/lib/exam-pdf-generator.ts`: run the subtitle line (line 691) through the scrubber so exported PDFs don't display raw board names

---

## 3. Content Authenticity Disclaimer

### Changes

**A. Quiz/Exam Footer (UI)**
- Add a persistent footer text to:
  - `src/pages/TakePracticeQuiz.tsx` -- bottom of the quiz interface
  - `src/pages/ExamInProgress.tsx` -- bottom of the exam interface
  - `src/pages/ExamReview.tsx` -- bottom of review pages
- Text: "Original AI-generated content for educational practice. Not affiliated with or endorsed by any official examination board."
- Styled as a small, muted footer that doesn't interfere with the educational content

**B. PDF Export Footer**
- In `exam-pdf-generator.ts`: add the same disclaimer text at the bottom of every generated PDF page as a footer line

**C. Generated Data Metadata**
- In the edge function, stamp each generated question's metadata with `{ "content_origin": "ai_generated", "disclaimer_version": "1.0" }` for audit trail

---

## 4. Account Type Awareness

### Changes

**A. Tutor Content Sharing Warning**
- When a tutor assigns an AI-generated exam to a group, show a one-time advisory modal:
  - "This content is AI-generated for educational practice. Sharing AI-generated materials that closely replicate copyrighted exam structures may have legal implications. Please ensure all distributed content is sufficiently original."
- Track dismissal in `tutor_profiles.settings` JSON so it only shows once

**B. Quiz Transformativeness Enforcement**
- In the AI prompt for practice quiz generation, add an explicit instruction:
  - "All scenarios, case studies, and data sets MUST be entirely original. Do not reproduce or closely paraphrase real exam questions, published mark schemes, or copyrighted source texts. Create novel contexts that test the same skills."
- For "Mock Exam" generation (tutor flow), strengthen this to:
  - "The structure (number of questions, mark distribution, question types) should follow the specified board style, but ALL content -- scenarios, data, source texts, numerical values -- MUST be 100% original."

---

## 5. Engine Integrity Safeguard

### The Rule
- The scrubbing layer operates exclusively on string fields: `question_text`, `feedback`, `correct_answer` (when it's a text string), and display labels
- It explicitly skips:
  - `graphConfig` (series data, domain ranges, axis configuration)
  - `plottingAnswer` (expectedPath, pathAnnotations coordinates)
  - `options` arrays (MCQ choices -- these are scrubbed separately for text only)
  - `table_data`, `content_json` in resource items
  - Any numeric or coordinate data

---

## 6. Additional Enforcement Items Identified

**A. Landing Page Copy**
- Update `src/components/LandingPage.tsx` feature descriptions to avoid implying we host or distribute copyrighted papers:
  - Change "Upload Past Papers" to "Upload Study Materials"
  - Change "Upload your past exam papers as PDFs" to "Upload your study documents for AI-powered practice generation"

**B. Notes Field Board Name Advisory**
- In `src/lib/notes-sanitizer.ts`, update the example text (line 231) from "GCSE AQA style" to "GCSE style; structured mark scheme format"
- Add a soft warning (not a block) when users type board names in notes: "Tip: Board names are used internally for style matching only. Generated content will not reference specific boards."

**C. Exam Title Validation**
- Add a soft warning when users name their exam/quiz with board names + year codes (e.g., "AQA Physics June 2024") suggesting they use a generic title instead

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/UploadExam.tsx` | Add declaration checkbox, rebrand board dropdown, title warning |
| `src/pages/CreateExam.tsx` | Add declaration checkbox, rebrand board dropdown |
| `src/pages/CreatePracticeQuestions.tsx` | Add declaration checkbox, rebrand board dropdown |
| `src/components/practice/ResourcePackUploader.tsx` | Add declaration checkbox |
| `src/pages/tutor/EditExam.tsx` | Rebrand board dropdown |
| `src/pages/tutor/CreateTutorExam.tsx` | Rebrand board dropdown |
| `src/pages/TakePracticeQuiz.tsx` | Add disclaimer footer |
| `src/pages/ExamInProgress.tsx` | Add disclaimer footer |
| `src/pages/ExamReview.tsx` | Add disclaimer footer |
| `src/components/LandingPage.tsx` | Update marketing copy |
| `src/lib/notes-sanitizer.ts` | Update examples, add board name advisory |
| `src/lib/exam-pdf-generator.ts` | Add disclaimer footer, scrub board names |
| `src/lib/board-scrubber.ts` | NEW -- shared scrubbing utility |
| `supabase/functions/generate-practice-questions/index.ts` | Prompt translation, output scrubbing, originality instructions |
| `supabase/functions/cleanup-expired-files/index.ts` | NEW -- scheduled file deletion |
| `supabase/functions/upload-exam/index.ts` | Post-processing file deletion |
| `supabase/functions/extract-resource-pack/index.ts` | Post-processing file deletion |

## Database Migration
- Add `file_processed_at` timestamp column to `exams` table (nullable, default NULL)
- Add `file_processed_at` timestamp column to `resource_packs` table (nullable, default NULL)

