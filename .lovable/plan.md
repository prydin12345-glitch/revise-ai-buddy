
# Fix: Stop Math Curve Regeneration from Overwriting Non-Math Graph Data

## Root Cause (The Real Bug)

The pipeline has two conflicting phases that run in sequence:

1. **Phase 5.5** (lines 1592-1678): Correctly strips `markingFormula`, validates `expectedPath`, and clears `series.data` for non-math subjects.

2. **Graph Question Validation** (lines 2462-3031): Checks if `series[0].data.length >= 3` to determine `hasValidData`. Since Phase 5.5 just emptied `series.data`, this check **always returns false** for non-math subjects. The code then enters the `!hasValidData` branch, which runs the full math engine -- parsing functions from question text, generating polynomial curves, creating `markingFormula`, running Lagrange interpolation, and generating "secret marking formulas." This **overwrites** the correct `expectedPath` data with cubic/polynomial curves.

In short: Phase 5.5 does its job perfectly, then the Graph Validation block undoes all of it.

## The Fix

### Change 1: Update `hasValidData` to recognize `expectedPath` as valid (line ~2468-2483)

Before checking series data, check if this is a non-math question with a valid `expectedPath`. If so, mark `hasValidData = true` and skip the entire math curve generation block.

```text
// After parsing graphData (around line 2470):
// NEW: For non-math subjects, expectedPath IS the valid data -- don't regenerate
if (!isMathSubject && graphData?.plottingAnswer?.expectedPath?.length >= 2) {
  hasValidData = true;
  console.info(`Q${q.question_number}: expectedPath has ${graphData.plottingAnswer.expectedPath.length} vertices -- skipping math curve generation`);
}
```

This single guard prevents the entire 500+ line math engine block from running on physics/economics questions.

### Change 2: Final safety net before storage (around line 3181-3197)

Add a second check in the existing "pre-storage assertion" block: if a non-math `graph_plotting` question somehow still has a `markingFormula` at storage time, strip it.

```text
// Extend the existing pre-storage assertion block:
if (!isMathSubject && gd?.plottingAnswer?.markingFormula) {
  console.warn(`Q${q.question_number}: FINAL SAFETY NET -- stripping markingFormula for non-math subject`);
  gd.plottingAnswer.markingFormula = null;
  q.correct_answer = gd;
}
```

### Change 3: Live test via edge function call

After deploying the fix, I will:
1. Call the `generate-practice-questions` edge function with a "Speed-Time" physics quiz configuration for the `prydin12345@gmail.com` account
2. Inspect the raw JSON output from the edge function logs
3. Verify: no `markingFormula`, valid `expectedPath` with discrete vertices, `pathAnnotations` present, `quadrantMode: "q1"`, and `series.data` is empty
4. If anything is wrong, iterate on the fix before finalizing

### Change 4: Insert verified quiz data

If the automated generation now works correctly, the quiz will appear on the account automatically. If it still has issues, I will manually insert a correct "Speed-Time Challenge v2" quiz using the same Gold Standard structure as the working quiz.

## Why This Permanently Fixes It

- The previous attempts added more instructions to the AI prompt and more post-processing rules, but never addressed the fact that the downstream code **re-generates math curves regardless**
- This fix attacks the actual code path: the `hasValidData` boolean gate that controls whether the math engine runs
- Even if the AI produces perfect `expectedPath` data and Phase 5.5 validates it, the math engine was always overwriting it -- this fix stops that from happening

## Files to Modify

- `supabase/functions/generate-practice-questions/index.ts` (2 surgical changes + redeploy)

## Technical Summary

```text
Before:
  Phase 5.5 strips markingFormula, validates expectedPath, clears series.data
     |
     v
  hasValidData = (series[0].data.length >= 3)  --> FALSE (series was cleared!)
     |
     v
  Math engine generates cubic curves, overwrites correct_answer  --> BROKEN

After:
  Phase 5.5 strips markingFormula, validates expectedPath, clears series.data
     |
     v
  hasValidData = (expectedPath.length >= 2)  --> TRUE (path exists!)
     |
     v
  Math engine SKIPPED  --> CORRECT expectedPath preserved
```
