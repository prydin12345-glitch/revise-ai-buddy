
# Discrete Path Rendering for Non-Math Graph Questions

## Problem

The expected answer system is hardcoded around continuous mathematical formulas (`markingFormula`). For Physics (distance-time), Economics (supply/demand), and other subjects, the correct answer is a **piecewise sequence of vertices** (e.g., move, stop, move again). The current engine either tries to fit a smooth curve or falls back to a single best-fit line, producing scientifically incorrect visuals.

## Solution: "expectedPath" as an Alternative Answer Source

Add an optional `expectedPath` field to `GraphPlottingAnswer`. When present, the rendering and marking engines switch from formula evaluation to **straight-line vertex connection** ("connect-the-dots" mode). This is purely additive -- when `expectedPath` is absent, the existing `markingFormula` logic is unchanged.

```text
Decision flow in review mode:

  markingFormula exists?
       |
  YES: Use formula-driven curve (current math behavior)
       |
  NO:  expectedPath exists?
          |
     YES: Connect vertices with straight lines
          |
     NO:  Legacy expectedCurve fallback
```

---

## Changes

### 1. Type Extension (`src/components/graph/types.ts`)

Add to `GraphPlottingAnswer`:

```typescript
// Optional: For piecewise/event-based answers (Physics, Economics, etc.)
// When present, overrides formula-based rendering with straight-line vertex connection.
expectedPath?: GraphPoint[];
// Optional: Labels bound to specific path vertices
pathAnnotations?: Array<{ pointIndex: number; label: string }>;
```

No existing fields are modified. The `expectedPoints` array (used for point-matching marking) remains separate and unchanged.

### 2. Frontend Rendering (`src/pages/TakePracticeQuiz.tsx`)

In the review-mode `expectedCurveSeries` construction block (lines 1840-1961), add a new step between Step 1 (markingFormula) and Step 2 (legacy fallback):

```
Step 1:   markingFormula -> formula curve (unchanged)
Step 1.5: parent inheritance fallback (unchanged)
NEW Step 1.7: expectedPath -> straight-line series
Step 2:   legacy expectedCurve fallback (unchanged)
```

**Step 1.7 logic**: If `expectedCurveSeries` is still empty and `plottingAnswer.expectedPath` exists with 2+ points, create a single `GraphSeries` from those points directly. No smoothing, no curve fitting -- just the raw vertex array rendered as a solid polyline.

**Annotation binding**: If `plottingAnswer.pathAnnotations` exists, convert them to `GraphAnnotation` objects and merge into `config.annotations` so labels like "Bus Stop" or "Point B" appear at the correct vertices via the existing `AnnotationLayer`.

### 3. Backend Marking (`supabase/functions/grade-practice-question/index.ts`)

Add a new marking branch before the existing formula-based and sketch-based logic (around line 325):

**"Segment proximity" marking**: When `expectedPath` exists and `markingFormula` is absent:
- For each student point, find the nearest line segment in the expected path
- A point is "correct" if its perpendicular distance to the nearest segment is within `toleranceUnits`
- Score = (correct points / total student points) * marks
- Also check if student captured all key vertices (the path's corner points) within tolerance

This is more appropriate than formula sampling because piecewise paths have sharp corners and flat segments that cannot be expressed as y = f(x).

### 4. AI Generation Prompt (`supabase/functions/generate-practice-questions/index.ts`)

Add a new section to the prompt for non-mathematics subjects:

**Trigger**: When the detected subject is Physics, Economics, Biology, Geography, or any non-Mathematics subject, AND the question involves plotting/sketching a graph.

**Instruction addition**:
```
For non-mathematics graph_plotting questions (Physics, Economics, Biology, etc.):
- Use "expectedPath" instead of "markingFormula" in plottingAnswer
- expectedPath is an ordered array of vertices that define the correct journey/path
- Connect vertices with straight lines (no curve fitting)
- Each vertex represents a KEY EVENT (start, stop, direction change, equilibrium)
- Include "pathAnnotations" to label important vertices
- Example for a distance-time journey:
  "expectedPath": [
    {"x": 0, "y": 0},        // Start
    {"x": 100, "y": 300},    // Walking at constant speed
    {"x": 200, "y": 300},    // Stationary (bus stop)
    {"x": 300, "y": 600}     // Moving again
  ],
  "pathAnnotations": [
    {"pointIndex": 2, "label": "Bus Stop"}
  ]
- Do NOT provide markingFormula for piecewise journeys
- ALWAYS provide subjectProfile with appropriate axis labels
```

**Schema update**: Add `expectedPath` and `pathAnnotations` to the JSON schema definition for `plottingAnswer`.

### 5. GraphCanvasPlot Rendering (`src/components/graph/GraphCanvasPlot.tsx`)

No changes needed. The `expectedCurveSeries` is already rendered as a polyline through `CurveLayer`, which connects data points in order. As long as `TakePracticeQuiz.tsx` feeds the path vertices as a `GraphSeries`, the existing rendering handles it correctly -- straight segments between sequential points with no smoothing applied.

---

## Files Modified

| File | Change | Risk |
|------|--------|------|
| `src/components/graph/types.ts` | Add `expectedPath` and `pathAnnotations` to `GraphPlottingAnswer` | None -- additive |
| `src/pages/TakePracticeQuiz.tsx` | Add Step 1.7 for expectedPath rendering + annotation binding | Low -- only triggers when new field exists |
| `supabase/functions/grade-practice-question/index.ts` | Add segment-proximity marking branch | Low -- only triggers when expectedPath present, no markingFormula |
| `supabase/functions/generate-practice-questions/index.ts` | Add expectedPath schema + non-math prompt addendum | Low -- only affects non-math generation |

## Files NOT Modified

- `GraphCanvasPlot.tsx` -- existing `CurveLayer` already handles polyline rendering
- `GraphPlottingQuestion.tsx` -- no changes needed
- `GraphCanvas.tsx` -- no changes needed
- `AnnotationLayer.tsx` -- already supports point annotations
- `math-engine.ts` -- formula evaluation is unchanged
- `formula-evaluator.ts` -- unchanged

## Safety Guarantees

1. `expectedPath` is optional -- when absent, all existing math logic is identical
2. Marking priority: `markingFormula` (if present) always wins over `expectedPath`
3. Existing math quizzes have no `expectedPath` field, so they are completely unaffected
4. The only way `expectedPath` gets populated is through the AI generation prompt for non-math subjects
