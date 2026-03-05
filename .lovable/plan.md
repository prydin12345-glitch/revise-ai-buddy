

# UI Logic & Data Rendering Upgrade

## Overview

Three workstreams: (1) Profile-locking with reference override toggle on the `/upload` page (already partially exists on `/create`), (2) new statistical chart renderers (scatter with regression, histogram with unequal class widths), and (3) marks-adaptive answer box sizing in ExamInProgress.

---

## 1. Profile Locking with Reference Override on `/upload` Page

**Current state**: The `/upload` page (`UploadExam.tsx`) has no Exam Profile integration. The `/create` page (`CreateExam.tsx`) already has profile-locking logic (lines 730-740) with "Locked by Profile" badges.

**Changes**:
- **`src/pages/UploadExam.tsx`**: Import `useSubjectProfiles` and add profile selector. When a profile is selected, lock question count, educational tier, and timer to the profile values (mirror the pattern from `CreateExam.tsx` lines 225-244).
- Add a **"Follow Reference Structure"** toggle (Lock icon) that appears only when both a profile AND a reference PDF are uploaded. Default: locked to profile. When unlocked, the AI uses the PDF's question count instead.
- Pass a `structureMode: 'profile' | 'reference'` flag via formData to the `upload-exam` edge function.

**`supabase/functions/extract-exam-questions/index.ts`** (lines 116-141): Update `desiredQuestionCount` resolution to check for the `structureMode` flag. If `structureMode === 'profile'`, always use the profile's question count regardless of the PDF. If `structureMode === 'reference'`, let the PDF dictate question count.

---

## 2. New Statistical Chart Renderers

**Current state**: `BoxPlotChart.tsx` exists and renders SVG box plots. `GraphRenderer.tsx` supports `line` and `scatter` chart types via Recharts. No histogram or regression line support.

**Changes**:

### 2a. Scatter Graph with Regression Line
- **`src/components/graph/GraphRenderer.tsx`**: Add optional `regressionLine` rendering. When `series` data includes a `regressionLine: { slope, intercept }` field, overlay a dashed `ReferenceLine` or a computed `Line` series connecting the regression endpoints.
- No new component needed — extend the existing scatter rendering path (lines 221-291).

### 2b. Histogram with Unequal Class Widths
- **Create `src/components/graph/HistogramChart.tsx`**: New SVG component similar to `BoxPlotChart.tsx`. Accepts `chart_data` with type `'histogram'` containing `{ bins: [{ lower, upper, frequency }], xLabel, yLabel }`. Renders frequency density bars (`frequency / classWidth`) with axis labels.
- **`src/components/graph/index.ts`**: Export `HistogramChart`.
- **`src/pages/ExamInProgress.tsx`**: Add detection for `chart_data.type === 'histogram'` alongside existing `isBoxPlotQuestion` check, and render the new component.
- **`src/pages/ExamPreview.tsx`** and **`src/pages/ExamReview.tsx`**: Same histogram rendering.

### 2c. AI Prompt Updates
- **`supabase/functions/extract-exam-questions/index.ts`**: Extend the `chart_data` JSON schema documentation in the prompt (around line 900) to include `histogram` and `scatter_regression` types with their expected data shapes.
- Add `Σx`, `Σx²`, `Σxy`, `S_{xx}` to the LaTeX notation examples in the prompt.

---

## 3. Marks-Adaptive Answer Box Sizing

**Current state**: All math answers use `min-h-[300px]`, all non-math use `min-h-[200px]` — fixed regardless of question difficulty.

**Changes in `src/pages/ExamInProgress.tsx`**:
- Create a helper function `getAnswerBoxHeight(marks: number, isMath: boolean): string` that maps marks to min-height:
  - 1-2 marks → `min-h-[120px]` (hypothesis statement, short answer)
  - 3-4 marks → `min-h-[200px]` (standard calculation)
  - 5-7 marks → `min-h-[300px]` (multi-step derivation)
  - 8+ marks → `min-h-[400px]` (extended "Show that" proof)
- Replace the hardcoded `min-h-[300px]` (line 1840) and `min-h-[200px]` (line 1953) with calls to this function using `question.marks`.

---

## 4. Reference Mark Distribution Cloning (Prompt Enhancement)

**`supabase/functions/extract-exam-questions/index.ts`** in `buildPrompt()`:
- When a reference PDF is present (`!fallback`), add an instruction block:
  ```
  MARK DISTRIBUTION CLONING: When a reference PDF is provided, replicate the mark allocation pattern from the original paper. If the reference gives 5 marks to a 'Show that' derivation, your generated equivalent must also allocate 5 marks. Match the ratio of low-mark (1-2) to high-mark (5+) questions.
  ```

---

## Files to Modify

1. **`src/pages/UploadExam.tsx`** — Profile selector + lock toggle
2. **`src/pages/ExamInProgress.tsx`** — Marks-adaptive answer box heights
3. **`src/components/graph/HistogramChart.tsx`** — New histogram renderer (create)
4. **`src/components/graph/GraphRenderer.tsx`** — Regression line overlay
5. **`src/components/graph/index.ts`** — Export histogram
6. **`src/pages/ExamPreview.tsx`** + **`src/pages/ExamReview.tsx`** — Histogram rendering
7. **`supabase/functions/extract-exam-questions/index.ts`** — Chart data schemas, mark cloning, structure mode flag

