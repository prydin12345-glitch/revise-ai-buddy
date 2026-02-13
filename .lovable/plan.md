

# Universal Subject-Aware Graphing Engine

## Overview

Add an **Annotation Layer** and **Subject Profile** system on top of the existing math graph engine. This is purely additive -- the current math graphing system remains untouched as the default. New optional props and config fields enable subject-specific axis labels, point annotations, region shading, and quadrant restrictions.

## What Changes (and What Doesn't)

**UNCHANGED (the 90% that works):**
- All math formula evaluation, marking, camera, pan/zoom, touch input, curve rendering
- Existing `GraphPlottingConfig`, `GraphCanvasPlot`, `GraphCanvas` core logic
- Backend marking engine, formula inheritance, sub-question logic

**NEW (additive layers):**
- Annotation overlay (point labels, text annotations)
- Subject-aware axis labels (replacing hardcoded "x"/"y")
- Quadrant restriction mode
- Region shading (fill between curve and axis)

---

## Phase 1: Annotation Data Types

**File: `src/components/graph/types.ts`**

Add new interfaces at the bottom (no existing types modified):

```typescript
// Annotation for labeling points on the graph
interface GraphAnnotation {
  id: string;
  type: 'point' | 'intercept' | 'text' | 'region';
  // For point/intercept: the coordinates to label
  coords?: { x: number; y: number };
  // For intercept: which axis
  axis?: 'x' | 'y';
  // Display label (e.g., "Terminal Velocity", "A(3, 5)")
  label: string;
  // Whether to show coordinate values in the label
  showCoordinates?: boolean;
  // For region shading
  fillBetween?: {
    curveSeriesId: string;    // which series to shade under
    fromX?: number;           // start x (defaults to domainX[0])
    toX?: number;             // end x (defaults to domainX[1])
    fillColor?: string;       // defaults to subject color with low opacity
  };
}

// Subject profile for axis/viewport defaults
interface SubjectProfile {
  subject?: string;           // 'Mathematics' | 'Physics' | 'Economics' | etc.
  axisLabels?: { x: string; y: string };  // Override "x"/"y"
  quadrantMode?: 'all' | 'q1' | 'q1q2';  // Default: 'all'
}
```

Extend `GraphPlottingConfig` (additive, all optional):

```typescript
// Added to existing GraphPlottingConfig:
annotations?: GraphAnnotation[];
subjectProfile?: SubjectProfile;
```

---

## Phase 2: Axis Label Override

**File: `src/components/graph/GraphCanvas.tsx` -- `AxisLayer` component**

Currently the axis labels are hardcoded as `"x"` and `"y"` (lines 283-303). Change to accept optional props:

- Add `xAxisLabel?: string` and `yAxisLabel?: string` props to `AxisLayer`
- Replace the hardcoded `"x"` text with `xAxisLabel || "x"` and `"y"` with `yAxisLabel || "y"`
- Thread these through from `GraphCanvas` props (new optional `axisLabels` prop)

**File: `src/components/graph/GraphCanvasPlot.tsx`**

- Read `config.subjectProfile?.axisLabels` or fall back to `config.xLabel` / `config.yLabel`
- Pass to `GraphCanvas` as `axisLabels={{ x: label, y: label }}`

This is a ~10-line change total. Existing math questions have no `subjectProfile`, so they keep "x"/"y".

---

## Phase 3: Annotation Overlay Component

**New file: `src/components/graph/AnnotationLayer.tsx`**

A pure SVG `<g>` component that renders labels near graph coordinates:

- **Point labels**: A small tag near the coordinate showing the label text (e.g., "Maximum (3, 5)"). Uses `graphToScreen` to position. Renders as an SVG `<text>` with a subtle background `<rect>` for readability.
- **Intercept labels**: Automatically finds where a series crosses the specified axis and places a label there.
- **Region shading**: Renders an SVG `<path>` that follows the curve data and closes along the x-axis, filled with a semi-transparent color.

Props:
```typescript
interface AnnotationLayerProps {
  annotations: GraphAnnotation[];
  graphToScreen: (x: number, y: number) => { x: number; y: number };
  referenceSeries?: GraphSeries[];  // for intercept auto-detection
  subjectColor?: string;
}
```

**Integration in `GraphCanvasPlot.tsx`**: Render `<AnnotationLayer>` as a child of `<GraphCanvas>` after the curves layer but before the points layer (~line 565). Only renders if `config.annotations?.length > 0`.

---

## Phase 4: Quadrant Mode

**File: `src/components/graph/GraphCanvasPlot.tsx`**

When `config.subjectProfile?.quadrantMode === 'q1'`:
- Clamp `domainX[0]` and `domainY[0]` to `0` (or a small negative for axis visibility, e.g., -0.5)
- This restricts the initial camera view to Quadrant 1 only
- Pan/zoom still works freely (the student can scroll if needed)

This is a 5-line addition in the camera initialization block.

---

## Phase 5: Generation Pipeline Update

**File: `supabase/functions/generate-practice-questions/index.ts`**

Update the AI prompt schema to include optional annotation and subject profile fields when generating graph questions:

- Add `annotations` array to the graph question JSON schema (optional)
- Add `subjectProfile` object to the schema (optional)
- For Physics/Economics/Biology subtopics, include subject-specific axis label hints in the system prompt (e.g., "For a force-time graph, use axisLabels: { x: 'Time (s)', y: 'Force (N)' }")
- Detect subject from the `subject` field already passed to the generation function
- When subject is not Mathematics, include a prompt addendum: "Include appropriate axis labels with units and annotate key features"

**File: `supabase/functions/_shared/math-engine.ts`**

No changes needed -- formula evaluation is subject-agnostic.

---

## Phase 6: Point Labels on Math Graphs (the missing feature)

**File: `supabase/functions/generate-practice-questions/index.ts`**

For math "sketch" questions that mention turning points, roots, or intercepts:
- Add annotations to `graphConfig.annotations` with `type: 'point'`, `showCoordinates: true`
- Extract from the question text or `expectedPoints` data
- Example: if `expectedPoints` includes `{ x: 3, y: 5, label: "Maximum" }`, generate annotation `{ type: 'point', coords: { x: 3, y: 5 }, label: 'Maximum', showCoordinates: true }`

This also works for the review/marking line -- annotations render on the expected curve in review mode.

---

## Technical Details

### Files Modified

| File | Change | Risk |
|------|--------|------|
| `src/components/graph/types.ts` | Add `GraphAnnotation`, `SubjectProfile` interfaces; extend `GraphPlottingConfig` | None -- additive only |
| `src/components/graph/GraphCanvas.tsx` | Add optional `axisLabels` prop to `AxisLayer` and `GraphCanvas` | Minimal -- defaults preserve current behavior |
| `src/components/graph/GraphCanvasPlot.tsx` | Thread axis labels, render `AnnotationLayer`, quadrant clamping | Low -- all behind optional config checks |
| `src/components/graph/AnnotationLayer.tsx` | **NEW** -- SVG annotation renderer | None -- new file |
| `supabase/functions/generate-practice-questions/index.ts` | Add annotations/subjectProfile to schema and prompt | Low -- optional fields, existing questions unaffected |

### Files NOT Modified

- `useGraphCamera.ts` -- no changes
- `GraphDrawingCanvas.tsx` -- no changes
- `GraphPlottingQuestion.tsx` -- no changes (annotations are rendered inside `GraphCanvasPlot`)
- `formula-evaluator.ts` -- no changes
- `math-engine.ts` -- no changes

### Safety Guarantees

1. Every new field is **optional** with sensible defaults
2. Existing questions with no `annotations` or `subjectProfile` render identically to today
3. No marking logic is affected -- annotations are visual-only
4. The annotation layer is a separate SVG `<g>` element that cannot interfere with point hit-testing or curve rendering

