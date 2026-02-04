
# Comprehensive Graph Exam Audit & Generation Plan

## Executive Summary

This plan outlines a systematic approach to generate a comprehensive Graph Practice Quiz and perform a "Deep Audit" against the Success Checklist you provided. The audit will verify the "Desmos Method" implementation across all graph question types.

---

## Current System Analysis

### Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    GRAPH QUESTION FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Edge Function]                    [Frontend]                          │
│  generate-practice-questions        TakePracticeQuiz.tsx                │
│         │                                   │                           │
│         ▼                                   ▼                           │
│  ┌─────────────────┐              ┌────────────────────┐               │
│  │ parseFunctionFromText()        │ parseGraphQuestionData()           │
│  │ parseTransformFromText()       │ generateCurveFromFormula()         │
│  │ extractMarkingFormula()        │                    │               │
│  └─────────────────┘              └────────────────────┘               │
│         │                                   │                           │
│         ▼                                   ▼                           │
│  ┌─────────────────┐              ┌────────────────────┐               │
│  │ math-engine.ts  │              │ formula-evaluator.ts               │
│  │ (Server-side)   │              │ (Client-side)      │               │
│  └─────────────────┘              └────────────────────┘               │
│         │                                   │                           │
│         ▼                                   ▼                           │
│  ┌─────────────────┐              ┌────────────────────┐               │
│  │ markingFormula  │───stored────▶│ GraphPlottingQuestion              │
│  │ expectedCurve   │   in DB      │ GraphCanvasPlot    │               │
│  │ shadowCurve     │              │ useGraphCamera     │               │
│  └─────────────────┘              └────────────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Components Under Test

| Component | Location | Purpose |
|-----------|----------|---------|
| `generate-practice-questions` | `supabase/functions/` | AI question generation + graph config |
| `math-engine.ts` | `supabase/functions/_shared/` | Server-side formula parsing & curve generation |
| `formula-evaluator.ts` | `src/lib/` | Client-side formula evaluation for green line |
| `GraphPlottingQuestion.tsx` | `src/components/graph/` | Interactive graph canvas with state management |
| `GraphCanvasPlot.tsx` | `src/components/graph/` | Camera-based renderer with zoom/pan |
| `useGraphCamera.ts` | `src/hooks/` | Desmos-style camera state hook |
| `TakePracticeQuiz.tsx` | `src/pages/` | Quiz orchestration + formula-driven review mode |

---

## Phase 1: Issue Diagnosis

### Issue #1: Zoom Interaction Not Working

**Root Cause Identified:**
The native wheel event listener in `GraphCanvasPlot.tsx` is correctly implemented, BUT there may be a race condition where:
1. The `zoomRef` is set via `useEffect` which runs after render
2. If the wheel event fires before the effect runs, `zoomRef.current` is `null`

**Current Code (Line 322-326):**
```typescript
const zoomRef = useRef<typeof zoom | null>(null);
useEffect(() => {
  zoomRef.current = zoom;
}, [zoom]);
```

**Fix Required:** Initialize `zoomRef` with the zoom function directly or use a more robust pattern.

### Issue #2: Double-Tap Point Selection Dead Zones

**Root Cause Identified:**
The hit detection uses `POINT_HIT_RADIUS` which was increased, but the fundamental issue is the **coordinate conversion chain**:
1. `screenToGraph()` converts click position to graph coordinates
2. `findNearestPointCamera()` compares against stored point coordinates
3. If camera state is stale during rapid interactions, coordinates may mismatch

**Current Thresholds:**
- Desktop: 40px hit radius
- Touch: 60-80px hit radius
- Double-tap threshold: 600ms, 80px distance

---

## Phase 2: Deep Audit Implementation

### Checklist Item 1: Formula-to-Line Mapping

**What We'll Verify:**
- Every graph question has a `markingFormula` in `plottingAnswer`
- The formula correctly renders the "Green Line" using `generateCurveFromFormula()`
- No fallbacks to generic parabolas when formula exists

**Current Implementation Status:**
```typescript
// TakePracticeQuiz.tsx line 1840-1852
if (markingFormula && typeof markingFormula === 'string' && markingFormula.trim() !== '') {
  formulaDrivenMode = true;
  const formulaCurve = generateCurveFromFormula(markingFormula, domainX);
  if (formulaCurve.length > 0) {
    expectedCurveSeries = formulaCurve;
  }
  // DO NOT FALL BACK - formula is source of truth
}
```

**Audit Action:** Generate questions with Quadratics, Cubics, Reciprocals and verify `markingFormula` is populated and renders correctly.

### Checklist Item 2: Sub-Question Inheritance

**What We'll Verify:**
- Part (b), (c) questions inherit `baseMarkingFormula` from part (a)
- `applyFormulaTransform()` performs algebraic substitution correctly
- Example: If f(x) = (x-1)(x-3)(x+2), then f(x-2) = ((x-2)-1)((x-2)-3)((x-2)+2)

**Current Implementation Status:**
```typescript
// generate-practice-questions/index.ts line 1586-1599
if (group.baseMarkingFormula) {
  transformedMarkingFormula = applyFormulaTransform(group.baseMarkingFormula, transformSpec);
  transformedCurveBranches = generateCurveFromMarkingFormula(transformedMarkingFormula, domainX);
}
```

**Audit Action:** Generate multi-part transformation questions (1a, 1b, 1c) and verify formula inheritance chain.

### Checklist Item 3: Coordinate Mapping Integrity

**What We'll Verify:**
- `expectedPoints` (turning points, intercepts) are mathematically derived from `markingFormula`
- Visual render aligns perfectly with stored coordinates

**Current Implementation:**
```typescript
// generate-practice-questions/index.ts line 2350-2358
expectedPoints: transformedFeatures.turningPoints
  .map(tp => ({ x: tp.x, y: tp.y }))
  .concat(transformedFeatures.intercepts.x.map(xi => ({ x: xi, y: 0 })))
```

**Audit Action:** Sample several questions and verify turning points/intercepts match formula evaluation.

### Checklist Item 4: Canvas State Reset

**What We'll Verify:**
- Moving from Q1 to Q2 (or 1a to 1b) triggers full canvas clear
- No "ghost" lines from previous questions persist

**Current Implementation:**
```typescript
// TakePracticeQuiz.tsx line 1898-1899
<GraphPlottingQuestion
  key={`graph-plotting-${currentQuestion.id}-${currentIndex}`}
  // ...
/>
```

**Status:** Component key includes both ID and index, which should force re-mount. Need to verify this works in practice.

### Checklist Item 5: Interactive Alignment

**What We'll Verify:**
- Mouse wheel zoom updates camera scale
- Double-tap point selection works reliably
- Coordinate hitboxes align with rendered points

---

## Phase 3: Fixes Required

### Fix 1: Robust Zoom Handler Initialization

**File:** `src/components/graph/GraphCanvasPlot.tsx`

**Change:** Replace the `useRef` + `useEffect` pattern with direct initialization or a more robust callback pattern to ensure zoom is always available.

### Fix 2: Camera Initialization Guard

**File:** `src/hooks/useGraphCamera.ts`

**Change:** Add validation to ensure camera is properly initialized before zoom operations. The current guards exist but may not cover all edge cases during initial render.

### Fix 3: Edge Function Model Parameter Fix

**File:** `supabase/functions/generate-practice-questions/index.ts`

**Status:** Already fixed in previous edit - using `max_completion_tokens` for OpenAI models.

---

## Phase 4: Test Generation & Verification

### Step 1: Generate Comprehensive Graph Quiz

Create a quiz with:
- **Topic:** Polynomial Sketches, Transformations, Reciprocals
- **Educational Tier:** A-Level
- **Question Count:** 10-15 questions
- **Difficulty:** Hard

This will exercise:
- Quadratic functions: y = x², y = (x-a)²
- Cubic functions: y = x(x+a)(x-b), factored cubics
- Reciprocal functions: y = 1/x, y = 1/(x+a)
- Transformations: f(x+k), f(x)+k, af(x), -f(x)

### Step 2: Run Automated Verification

After generation, verify in database:
1. All graph_plotting questions have `markingFormula` populated
2. Sub-questions have `appliedTransform` and `baseFormula` fields
3. `expectedCurve.data` has sufficient points (>50) for smooth rendering

### Step 3: Manual UI Testing

Test in browser:
1. Navigate through all questions - verify no ghost lines
2. Test zoom with mouse wheel on each graph
3. Test double-tap point selection
4. Submit and verify green line renders from formula

---

## Technical Details

### Formula Transformation Logic (`applyFormulaTransform`)

**Location:** `src/lib/formula-evaluator.ts` lines 486-561

**Key Logic:**
```typescript
// Horizontal shift: f(x - a) means shift RIGHT by a
if (transform.shiftX && transform.shiftX !== 0) {
  const replacement = shift > 0 ? `(x-${shift})` : `(x+${Math.abs(shift)})`;
  formula = formula.replace(/\bx\b/g, replacement);
}

// Vertical transformations: wrap entire formula
if (transform.reflectX) {
  prefix = '(-1)*(' + prefix;
  suffix = suffix + ')';
}
```

**Example:**
- Base formula: `(x-1)*(x-3)*(x+2)`
- Transform: f(x-2) → shiftX = 2
- Result: `((x-2)-1)*((x-2)-3)*((x-2)+2)` → `(x-3)*(x-5)*(x)`

### Camera-Based Coordinate System

**Location:** `src/hooks/useGraphCamera.ts`

**Key Formula:**
```typescript
// Scale = graph units per 100 pixels
const pixelsPerUnit = 100 / camera.scale;

// Graph to Screen:
screenX = viewportWidth / 2 + (graphX - camera.centerX) * pixelsPerUnit;
screenY = viewportHeight / 2 - (graphY - camera.centerY) * pixelsPerUnit;
```

---

## Implementation Order

1. **Fix zoom handler initialization** - Ensures mouse wheel zoom works reliably
2. **Deploy edge function** - Already done with model parameter fix
3. **Generate test quiz** - Using the corrected generation pipeline
4. **Run database verification queries** - Check markingFormula population
5. **Manual UI verification** - Test all 5 checklist items in browser

---

## Success Metrics

| Metric | Target | Verification Method |
|--------|--------|---------------------|
| markingFormula populated | 100% of graph questions | Database query |
| Sub-question inheritance | Formula transforms correctly | Visual inspection of green line |
| Coordinate alignment | < 0.5 unit tolerance | Compare expectedPoints to formula evaluation |
| Canvas reset | No ghost lines | Navigate between questions |
| Zoom functional | Mouse wheel updates scale | Browser interaction test |
| Point selection | < 3 attempts to select | Touch/click testing |
