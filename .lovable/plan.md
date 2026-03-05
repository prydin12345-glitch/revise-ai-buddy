

# Plan: Stealth Difficulty Engine + Scenario-Based Generation + Box Plot Component

## Problem
The AI generates shallow, standalone theoretical questions instead of A-Level exam board quality (as shown in the reference images). Questions lack real-world scenarios, multi-part hierarchical depth, and statistical chart support (box plots, tree diagrams).

## Approach

### 1. Stealth Exam Board Mapping (Edge Function)
Modify `supabase/functions/extract-exam-questions/index.ts` to add a "stealth archetype" system:

- Add a `resolveStealthArchetype()` function that maps `educationalTier` + `subject` to an internal difficulty archetype (e.g., `college_16_18` + `mathematics` = `"UK_A_LEVEL_MATHS"`)
- Inject archetype-specific prompt instructions without naming any exam board in the output
- For `UK_A_LEVEL_MATHS` archetype specifically: enforce Statistics paper conventions (hypothesis testing, normal distributions, binomial models, box plots, coding, regression)

### 2. Scenario-Based Complexity in AI Prompt
Rewrite the `buildPrompt()` function to include mandatory scenario instructions:

- Every parent question MUST begin with a named character and real-world dataset/context (e.g., "Barbara is investigating...", "A machine puts liquid...")
- All mathematical notation must use LaTeX (`$\mu$`, `$\sigma$`, `$\bar{x}$`)
- Sub-parts must escalate: (a) recall → (b) application → (c) evaluation/hypothesis testing
- Enforce "show that" questions and multi-step distribution problems for Statistics
- Add a "Statistics Question Blueprints" section with templates matching the reference images: probability trees, box plots with outliers, hypothesis testing, normal distribution problems, coded data/regression

### 3. Box Plot Rendering Component
Create `src/components/graph/BoxPlotChart.tsx`:

- Accept data: `{ min, q1, median, q3, max, outliers[], xLabel, unit }`
- Render a clean SVG-based box-and-whisker plot with a numbered axis scale
- Support outlier markers (crosses/dots) outside whisker boundaries
- Grid background matching existing graph visual hierarchy standards
- Integrate into `ExamInProgress.tsx` and `ExamReview.tsx` via question_type detection

### 4. AI Output Schema for Charts
Extend the graph generation instructions in `buildPrompt()` to include a `boxplot` chart type:

```json
{
  "question_type": "short_answer",
  "chart_data": {
    "type": "boxplot",
    "data": { "min": 7.6, "q1": 19.5, "med": 23.5, "q3": 26.5, "max": 32.5 },
    "outliers": [7.6, 8.1],
    "xLabel": "Temperature (°C)",
    "domainX": [7, 33]
  }
}
```

The frontend detects `chart_data.type === "boxplot"` and renders the `BoxPlotChart` component above the answer area.

### 5. Question Depth Validation
Add a post-generation validation step in `processExamExtraction()`:

- Check that each parent question has at least 2 sub-parts for Level 2+ exams
- Verify scenario text exists (question must contain a named subject or dataset context)
- Log warnings for questions that don't meet depth requirements

## Files to Create/Edit

| File | Action |
|------|--------|
| `supabase/functions/extract-exam-questions/index.ts` | Major edit: add stealth archetype, rewrite prompt with scenario+depth rules, add boxplot schema, add validation |
| `src/components/graph/BoxPlotChart.tsx` | Create: SVG box plot renderer |
| `src/components/graph/index.ts` | Edit: export BoxPlotChart |
| `src/pages/ExamInProgress.tsx` | Edit: render BoxPlotChart when chart_data present |
| `src/pages/ExamPreview.tsx` | Edit: render BoxPlotChart in preview |
| `src/pages/ExamReview.tsx` | Edit: render BoxPlotChart in review |

## Stealth Archetype Mapping (Internal Only)

```text
educationalTier        + subject      → archetype
─────────────────────────────────────────────────
college_16_18 / a_level + math*       → UK_A_LEVEL_MATHS
college_16_18 / a_level + english*    → UK_A_LEVEL_ENGLISH
college_16_18 / a_level + physics*    → UK_A_LEVEL_PHYSICS
gcse_igcse             + math*       → UK_GCSE_MATHS
secondary_14_16        + math*       → UK_GCSE_MATHS
*                      + *           → GENERIC_ACADEMIC
```

Each archetype injects a hidden prompt block with tone, mark-weighting, and question style expectations matching that level.

