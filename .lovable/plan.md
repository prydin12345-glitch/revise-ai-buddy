
# Fix Graph Marking: Transformed Curve Data & Expected Points

## Problem Summary
When students submit graph answers for transformation questions (e.g., "Sketch y = f(x) + 3"), the green "correct answer" curve and points displayed in review mode are **wrong** - they show the original base function coordinates instead of the mathematically transformed coordinates.

**Example Issue:**
- Question: "Sketch y = f(x) + 3" where f(x) has turning points at (-1, 2) and (1, -2)
- Expected correct answer: Turning points at (-1, 5) and (1, 1) [shifted UP by 3]
- What's currently displayed: Turning points at (-1, 2) and (1, -2) [original curve]

---

## Root Cause Analysis

The bug is in `supabase/functions/generate-practice-questions/index.ts` at lines 2207-2209:

```typescript
expectedPoints: features.intercepts.x.map(xi => ({ x: xi, y: 0 }))
  .concat(features.turningPoints.map(tp => ({ x: tp.x, y: tp.y })))
  .slice(0, 5),
```

**The `features` object contains the BASE function's key points, NOT the transformed points.**

While `expectedCurve` correctly uses `transformedBranches` (the curve data IS transformed), the `expectedPoints` array (used for point-matching marking and the green dots in review mode) pulls from the untransformed `features`.

---

## Sign Logic Verification (Per User Request)

I verified the existing horizontal shift logic is **CORRECT**:

### Standard Function Notation Rules
- `f(x - 2)` → shifts graph **RIGHT** by 2 (positive direction)
- `f(x + 2)` → shifts graph **LEFT** by 2 (negative direction)

### Current Implementation in `parseTransformFromText` (lines 793-803)
```typescript
// f(x + a) → shift LEFT by a (shiftX = -a for display)
const shiftLeftMatch = text.match(/f\s*\(\s*x\s*\+\s*(\d+(?:\.\d+)?)\s*\)/i);
if (shiftLeftMatch) {
  transform.shiftX = -parseFloat(shiftLeftMatch[1]); // ✓ Correct: negative
}

// f(x - a) → shift RIGHT by a (shiftX = +a for display)
const shiftRightMatch = text.match(/f\s*\(\s*x\s*-\s*(\d+(?:\.\d+)?)\s*\)/i);
if (shiftRightMatch) {
  transform.shiftX = parseFloat(shiftRightMatch[1]); // ✓ Correct: positive
}
```

### How It's Applied in Curve Generation (line 436)
```typescript
inputX = inputX - transforms.shiftX;
// With shiftX = +2 (from "f(x-2)"):
// For output x=2, we compute f(2 - 2) = f(0)
// → Point originally at x=0 now renders at x=2 ✓ (shifted RIGHT)
```

### How It's Applied in applyTransform (line 486)
```typescript
newX = point.x + transforms.shiftX;
// With shiftX = +2: point at x=0 → x=0+2 = 2 ✓ (shifted RIGHT)
```

**Conclusion: The sign convention is already implemented correctly.** The issue is purely that `expectedPoints` isn't using the transform at all.

---

## Solution Design

### Part A: Create `transformKeyFeatures` Utility

Add a new function to `supabase/functions/_shared/math-engine.ts`:

```typescript
export interface TransformedKeyFeatures extends KeyFeatures {
  // Same structure as KeyFeatures, but coordinates are transformed
}

/**
 * Apply transformation to key features (intercepts, turning points, asymptotes).
 * Uses the same sign convention as curve generation.
 */
export function transformKeyFeatures(
  features: KeyFeatures,
  transform: TransformSpec
): KeyFeatures {
  return {
    intercepts: {
      // X-intercepts: x-coordinate shifts, y stays 0 then shifts
      // For f(x-a)+b, the x-intercept solves: f(x-a)+b = 0 → f(x-a) = -b
      // Original x-intercept xi has f(xi) = 0
      // New intercept: x - a = xi → x = xi + a (shiftX is already +a for f(x-a))
      x: features.intercepts.x.map(xi => xi + transform.shiftX),
      // Y-intercept transforms: if original y-int is y0, new is y0 * scaleY * reflectX + shiftY
      y: features.intercepts.y !== null
        ? (features.intercepts.y * transform.scaleY * (transform.reflectX ? -1 : 1)) + transform.shiftY
        : null
    },
    turningPoints: features.turningPoints.map(tp => ({
      x: tp.x + transform.shiftX,
      y: (tp.y * transform.scaleY * (transform.reflectX ? -1 : 1)) + transform.shiftY,
      type: transform.reflectX 
        ? (tp.type === 'max' ? 'min' : 'max') // Reflection in x-axis swaps max/min
        : tp.type
    })),
    asymptotes: {
      // Vertical asymptotes shift horizontally
      vertical: features.asymptotes.vertical.map(x => x + transform.shiftX),
      // Horizontal asymptotes transform vertically
      horizontal: features.asymptotes.horizontal.map(y =>
        (y * transform.scaleY * (transform.reflectX ? -1 : 1)) + transform.shiftY
      )
    }
  };
}
```

### Part B: Fix Generation Pipeline

Update `supabase/functions/generate-practice-questions/index.ts` (around lines 2206-2224):

**Before:**
```typescript
const plottingAnswer = {
  expectedPoints: features.intercepts.x.map(xi => ({ x: xi, y: 0 }))
    .concat(features.turningPoints.map(tp => ({ x: tp.x, y: tp.y })))
    .slice(0, 5),
  // ...
};
```

**After:**
```typescript
// Transform key features if transformation detected
const transformedFeatures = hasTransform 
  ? transformKeyFeatures(features, parsedTransform)
  : features;

const plottingAnswer = {
  expectedPoints: transformedFeatures.intercepts.x.map(xi => ({ 
    x: xi, 
    y: transformedFeatures.intercepts.y ?? 0  // Use transformed y-intercept value at x-intercepts
  })).concat(transformedFeatures.turningPoints.map(tp => ({ x: tp.x, y: tp.y })))
    .slice(0, 5),
  toleranceUnits: 0.5,
  marksPerPoint: Math.max(1, Math.floor(q.marks / 3)),
  expectedCurve: transformedBranches.length > 1 
    ? transformedBranches 
    : transformedBranches[0] || { /* ... */ },
  markingTolerance: {
    intercepts: 1.0,
    turningPoints: 1.5,
    asymptoteAvoidance: 0.3
  },
  asymptotes: transformedFeatures.asymptotes.vertical, // Use transformed asymptotes
  // Store transformation metadata for marking verification
  appliedTransform: hasTransform ? parsedTransform : null,
  baseFeatures: features, // Keep original for reference
};
```

### Part C: Handle X-Intercepts After Vertical Shifts

**Important Edge Case:** When a vertical shift is applied (e.g., f(x) + 3), the original x-intercepts are no longer at y = 0. The curve now crosses the x-axis at different x values (or not at all).

For sketch marking purposes, we should:
1. Keep the transformed turning points (these remain important landmarks)
2. Recalculate new x-intercepts only if needed for specific questions
3. For general sketch questions, focus on shape, turning points, and asymptotes rather than exact x-intercepts

---

## Files to Modify

| File | Change | Purpose |
|------|--------|---------|
| `supabase/functions/_shared/math-engine.ts` | Add `transformKeyFeatures()` function | Utility to apply transforms to extracted features |
| `supabase/functions/generate-practice-questions/index.ts` | Call `transformKeyFeatures()` before building `expectedPoints` | Ensure correct coordinates are stored for marking |
| `supabase/functions/generate-practice-questions/index.ts` | Store `appliedTransform` in `plottingAnswer` | Enable marking engine to verify transformation logic |

---

## Technical Implementation Steps

### Step 1: Add `transformKeyFeatures` to math-engine.ts
- Add the function after the `extractKeyFeatures` function (around line 780)
- Export it for use in generation pipeline
- Include proper handling of all transform types (shift, scale, reflect)

### Step 2: Update generation pipeline
- Import `transformKeyFeatures` at the top of the file
- After `const hasTransform = ...` check (line 2169), add call to `transformKeyFeatures`
- Replace the `features.intercepts.x` references with `transformedFeatures.intercepts.x`
- Replace `features.turningPoints` with `transformedFeatures.turningPoints`
- Replace `features.asymptotes` with `transformedFeatures.asymptotes`

### Step 3: Deploy and test
- Deploy edge function
- Generate a new practice set with transformation questions
- Verify the green "expected" curve matches the mathematical transformation
- Verify marking awards correct marks

---

## Verification Checklist
After implementation:
- [ ] `f(x - 2)` shifts turning points RIGHT by 2 units
- [ ] `f(x + 2)` shifts turning points LEFT by 2 units
- [ ] `f(x) + 3` shifts turning points UP by 3 units
- [ ] `-f(x)` reflects turning points across x-axis (max ↔ min swap)
- [ ] `2f(x)` stretches y-coordinates by factor of 2
- [ ] Green expected curve matches the transformed function
- [ ] Marking awards full marks for correctly transformed sketches

---

## Note on Existing Data
Existing questions with incorrect `expectedPoints` will continue to display incorrectly. Options:
1. Re-generate affected practice sets (recommended)
2. Create a one-time migration script to recalculate stored `correct_answer` data for transformation questions
