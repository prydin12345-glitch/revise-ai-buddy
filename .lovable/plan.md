

# Pre-Calculated Source of Truth: Eliminating Runtime Transform Guessing

## Problem Summary

The current system stores formulas ambiguously -- sometimes as the base function, sometimes already transformed -- then runs ~100 lines of heuristic detection on the frontend (TakePracticeQuiz.tsx lines 1848-1966) to "guess" whether to apply a transformation. This causes:

- **1b bleeding**: Wrong curve appears because the runtime detection picks up the wrong formula
- **3a/3b wrong shape**: Cubic turning points not locked in at generation time
- **4a truncated/missing lines**: Runtime formula evaluation fails or produces partial curves

## Solution: Three-Layer Fix

### Layer 1 -- Generation Pipeline (Backend)

**File**: `supabase/functions/generate-practice-questions/index.ts`

Enforce that `markingFormula` is **always the final, expanded expression** before storing to the database:

1. For transformation sub-questions (e.g., "sketch f(x-2)"):
   - After calling `applyFormulaTransform()`, store the **result** as `markingFormula`
   - Remove `baseFormula` from `plottingAnswer` -- only the final formula matters
   - Add a validation step: evaluate the formula at the expected turning points to confirm they match

2. For cubic "sketch" questions describing max/min:
   - `generateSecretMarkingFormula()` must produce a fully expanded cubic `ax^3 + bx^2 + cx + d`
   - Validate by checking `f'(p) = 0` and `f'(q) = 0` at the described turning point x-coordinates
   - Store this expanded formula directly as `markingFormula`

3. Add a final "pre-storage assertion": if `markingFormula` is a bare reference like `f(x)` or `g(x)`, log an error and fall back to `expectedCurve` coordinate data

### Layer 2 -- Frontend Rendering (Remove Runtime Detection)

**File**: `src/pages/TakePracticeQuiz.tsx`

Delete the entire runtime transform detection block (~lines 1848-1966) and replace with a simple pipeline:

```text
if (markingFormula exists AND is not bare reference)
  -> generateCurveFromFormula(markingFormula, domainX)
  -> done (no transform guessing)
else if (expectedCurve coordinate data exists)
  -> use legacy fallback
else
  -> no answer line (log warning)
```

No `parseTransformFromQuestionText()`, no `formulaAlreadyTransformed` heuristic, no `evaluateFormula()` comparison. The formula in the database IS the answer.

**File**: `src/components/practice/QuestionItem.tsx`

Same simplification in the `expectedCurveSeries` computation (lines 270-300) -- trust the formula, skip detection.

### Layer 3 -- State Isolation and Cleanup

**File**: `src/components/graph/GraphCanvasPlot.tsx`

1. Ensure the component key includes the question ID (already `key={graph-plotting-${question.id}}` in QuestionItem) -- verify GraphCanvasPlot itself also resets internal state (camera, undo stack) on key change

**File**: `src/components/practice/QuestionItem.tsx`

2. When `isGraded` is true (answer.submitted and feedback exists):
   - Set `referenceSeries` to empty array (already done, but verify)
   - Ensure no "blue ghost" temporary drag points leak through
   - `expectedCurveSeries` becomes the sole visual authority

### Layer 4 -- Curve Rendering Quality

**File**: `src/lib/formula-evaluator.ts`

Already has 500-point density and 30% domain extension. Verify these values are applied consistently and the Y-threshold of 1000 units is not clipping valid curves.

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/generate-practice-questions/index.ts` | Enforce pre-expanded markingFormula, add validation assertion |
| `src/pages/TakePracticeQuiz.tsx` | Delete ~100 lines of runtime transform detection, replace with direct formula lookup |
| `src/components/practice/QuestionItem.tsx` | Simplify expectedCurveSeries computation to trust database formula |
| `src/lib/formula-evaluator.ts` | Minor: ensure prefix stripping handles all edge cases |

### What This Removes

- `parseTransformFromQuestionText()` usage in review rendering
- `formulaAlreadyTransformed` heuristic
- `applyFormulaTransform()` calls on the frontend
- Secondary numerical comparison checks (`evaluateFormula` at shifted points)

### What This Preserves

- Legacy fallback for old quizzes without `markingFormula`
- Bare reference detection (`f(x)` regex guard)
- Secret formula generation for sketch questions
- All pan/zoom/interaction features

### Risk Mitigation

Existing quizzes that stored base (untransformed) formulas will still work via the legacy `expectedCurve` fallback. Only **newly generated** quizzes will benefit from the pre-calculated formula guarantee. No database migration is needed -- the `markingFormula` field already exists in the JSON.

