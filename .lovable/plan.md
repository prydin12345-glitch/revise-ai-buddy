
# Formula-Driven Graphing Architecture ("The Desmos Method")

## Executive Summary

This plan implements a **formula-driven source of truth** for all graph questions. Instead of letting the AI generate coordinate lists (which leads to hallucinations like showing parabolas for cubic questions), the system will:

1. **Store a mathematical formula** (`markingFormula`) with each graph question
2. **Evaluate the formula mathematically** to generate the "correct answer" curve
3. **Mark by coordinate sampling** - compare student Y values against formula-calculated Y values

---

## Problem Analysis

### Current Failure Mode (from screenshots)
- **Question**: "Sketch y = (x-1)(x-3)(x+2)"
- **Expected**: Cubic curve crossing x-axis at x=1, x=3, x=-2
- **Displayed**: Parabola (quadratic curve)

### Root Cause
The `parseFunctionFromText` function in `math-engine.ts` **cannot parse general factored cubics** like `(x-1)(x-3)(x+2)`. It only handles:
- Cubics through origin: `x(x+a)(x+b)` 
- Quadratic factors: `(x-a)^2(x+b)`

When parsing fails (returns `null`), the system falls back to a default quadratic or uses the AI's (incorrect) coordinate data.

---

## Solution Architecture

### New Field: `markingFormula`

Every graph question will store a **mathematical formula string** that can be evaluated:

```typescript
// In plottingAnswer (stored in correct_answer JSON)
{
  markingFormula: "(x-1)*(x-3)*(x+2)",  // New: evaluable expression
  formulaType: "factored_cubic",          // Type hint for UI
  expectedCurve: [...],                   // Computed from formula, not AI-generated
  expectedPoints: [...]                   // Computed turning points/intercepts
}
```

### Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                    GENERATION PIPELINE                           │
├─────────────────────────────────────────────────────────────────┤
│ 1. AI generates question text with function (validated)         │
│ 2. Parser extracts markingFormula from question text             │
│ 3. Math evaluator computes expectedCurve from formula           │
│ 4. Store: { markingFormula, expectedCurve (computed), ... }     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REVIEW/DISPLAY                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Load question with markingFormula                             │
│ 2. Re-evaluate formula to generate "green line" coordinates     │
│ 3. Render curve from formula (not cached AI data)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MARKING ENGINE                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Get student's plotted X values                                │
│ 2. Evaluate markingFormula at each X                             │
│ 3. Compare student Y vs formula Y (within tolerance)            │
│ 4. Award marks for shape, intercepts, key features              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Phase 1: Enhanced Formula Parser

**File**: `supabase/functions/_shared/math-engine.ts`

Add support for general factored cubics and other common forms:

```typescript
// NEW: General factored cubic (x-a)(x-b)(x-c)
// Matches: (x-1)(x-3)(x+2), (x+1)(x-2)(x+4), etc.
const generalFactoredCubicMatch = text.match(
  /\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)\s*\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)\s*\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)/i
);
if (generalFactoredCubicMatch) {
  // (x ± a)(x ± b)(x ± c) → roots at ∓a, ∓b, ∓c
  const roots = [
    (generalFactoredCubicMatch[1] === '-' ? 1 : -1) * parseFloat(generalFactoredCubicMatch[2]),
    (generalFactoredCubicMatch[3] === '-' ? 1 : -1) * parseFloat(generalFactoredCubicMatch[4]),
    (generalFactoredCubicMatch[5] === '-' ? 1 : -1) * parseFloat(generalFactoredCubicMatch[6])
  ];
  return {
    type: 'factored_cubic',
    roots: roots.sort((a, b) => a - b)
  };
}
```

### Phase 2: Store markingFormula in Generation

**File**: `supabase/functions/generate-practice-questions/index.ts`

When generating/processing graph questions:

1. **Extract formula from question text**:
```typescript
function extractMarkingFormula(questionText: string): string | null {
  // Match y = expression patterns
  const yEqualsMatch = questionText.match(/y\s*=\s*([^,.\s]+(?:\s*[^,.\s]+)*)/i);
  if (yEqualsMatch) {
    // Normalize to evaluable format: (x-1)(x-3)(x+2) → (x-1)*(x-3)*(x+2)
    return normalizeExpression(yEqualsMatch[1]);
  }
  return null;
}
```

2. **Store in plottingAnswer**:
```typescript
const plottingAnswer = {
  markingFormula: extractMarkingFormula(q.question_text),
  formulaType: parsedFunction?.type || 'unknown',
  // Compute curve from formula, not from AI
  expectedCurve: generateCurveFromFormula(markingFormula, domainX),
  expectedPoints: computeKeyPoints(markingFormula),
  // ...
};
```

### Phase 3: Formula Evaluator (Safe Math Parser)

**File**: `supabase/functions/_shared/math-engine.ts`

Add a safe mathematical expression evaluator:

```typescript
/**
 * Safely evaluate a mathematical formula at a given x value.
 * Supports: +, -, *, /, ^, parentheses, sqrt, sin, cos, tan
 */
export function evaluateFormula(formula: string, x: number): number | null {
  // Tokenize and parse the expression
  // Build an AST and evaluate
  // Return null for invalid/undefined results
}

/**
 * Generate curve data from a formula string.
 */
export function generateCurveFromFormula(
  formula: string,
  domain: [number, number],
  pointDensity: number = 150
): GraphSeries[] {
  const points: GraphPoint[] = [];
  const step = (domain[1] - domain[0]) / pointDensity;
  
  for (let x = domain[0]; x <= domain[1]; x += step) {
    const y = evaluateFormula(formula, x);
    if (y !== null && Number.isFinite(y) && Math.abs(y) <= 200) {
      points.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
  }
  
  // Split into branches at discontinuities
  return splitIntoBranches(points);
}
```

### Phase 4: Transformation Chaining

When a sub-question references a transformed function:

```typescript
// Question 1a: y = f(x) where f(x) = x(x+2)(1-x)
// Question 1b: Sketch y = f(x-2)

// For 1b, the markingFormula becomes:
const baseFormula = "(x)*(x+2)*(1-x)";
const transformedFormula = applyFormulaTransform(baseFormula, { shiftX: 2 });
// Result: "(x-2)*((x-2)+2)*(1-(x-2))" = "(x-2)*(x)*(3-x)"
```

### Phase 5: Frontend Formula-Based Rendering

**File**: `src/pages/TakePracticeQuiz.tsx`

In review mode, compute the curve from `markingFormula` instead of using cached `expectedCurve`:

```typescript
// In review mode, if markingFormula exists, re-compute the curve
let expectedCurveSeries: GraphSeries[] = [];

if (isInReviewMode && plottingAnswer?.markingFormula) {
  // Compute curve client-side from formula (deterministic)
  expectedCurveSeries = computeCurveFromFormula(
    plottingAnswer.markingFormula,
    [config.domainX[0], config.domainX[1]]
  );
} else if (isInReviewMode && plottingAnswer?.expectedCurve) {
  // Fallback to cached curve data
  expectedCurveSeries = normalizeExpectedCurve(plottingAnswer.expectedCurve);
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/math-engine.ts` | Add general cubic parser, formula evaluator, `generateCurveFromFormula()` |
| `supabase/functions/generate-practice-questions/index.ts` | Extract and store `markingFormula`, compute curve from formula |
| `supabase/functions/grade-practice-question/index.ts` | Mark by evaluating formula at student X coordinates |
| `src/lib/formula-evaluator.ts` (NEW) | Client-side safe formula parser for review rendering |
| `src/pages/TakePracticeQuiz.tsx` | Use formula to compute green line in review mode |

---

## Key Benefits

1. **No More Wrong Curve Shapes**: A cubic formula MUST produce a cubic curve
2. **Transformation Accuracy**: `f(x-2)` mathematically transforms the formula
3. **Self-Healing**: Even if stored `expectedCurve` is wrong, formula re-evaluation produces correct curve
4. **Consistent Marking**: Same formula used for generation, display, and marking

---

## Migration Strategy

1. **New questions**: Generate with `markingFormula` field
2. **Existing questions**: Optional migration script to extract formula from `question_text` and recalculate `expectedCurve`
3. **Fallback**: If no `markingFormula`, use existing `expectedCurve` data

---

## Validation Checklist

After implementation:
- [ ] `y = (x-1)(x-3)(x+2)` displays correct cubic with 3 x-intercepts
- [ ] `y = x^2` displays parabola
- [ ] `y = f(x-2)` correctly shifts the base function RIGHT by 2
- [ ] Review mode green line matches the mathematical function
- [ ] Marking awards points for correct curve shape and key features
