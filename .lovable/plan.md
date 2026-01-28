
# Expand Graph Modal - Technical Implementation Plan

**STATUS: ✅ IMPLEMENTED**

## Overview

This feature adds an "Expand Graph" button to all interactive graph questions, opening a full-screen modal with a larger drawing canvas. The goal is to improve drawing accuracy, reduce coordinate rounding issues, and provide clearer axis visibility.

## Current Architecture Analysis

The graph system is built around:

1. **`GraphPlottingQuestion.tsx`** (~2000 lines) - Core interactive graph component with:
   - Drawing toolbar (Straight, Curved, Freeform, Angle modes)
   - Point plotting, segment creation, drag handling
   - Coordinate conversion (data <-> pixel) via `dataToPixel` / `pixelToData`
   - ResizeObserver for container size tracking
   - Undo/redo history stack

2. **`GraphDrawingCanvas.tsx`** - Freeform drawing overlay that stores paths in **data coordinates** (not just pixels) for stable rendering

3. **Data Flow**:
   - `TakePracticeQuiz.tsx` / `QuestionItem.tsx` pass `studentPoints`, `segments`, `drawnPaths` as props
   - Changes propagate via `onPointsChange`, `onSegmentsChange`, `onDrawnPathsChange` callbacks
   - All data is already stored in graph coordinates (not pixels)

4. **Coordinate Stability**:
   - Recent fixes ensure `DrawingPath.dataPoints` are stored in graph coordinates
   - `GraphSegmentsLayer` uses domain-based coordinate conversion
   - The system is already designed for stable rendering across viewport sizes

## Implementation Strategy

### Core Principle: Single Source of Truth

The expanded modal will **share state** with the inline graph - no data duplication. When the modal closes, all changes are already committed via the existing callbacks.

### File Structure

```text
src/components/graph/
├── GraphPlottingQuestion.tsx     (updated - add expand button trigger)
├── ExpandedGraphModal.tsx        (NEW - modal wrapper)
├── GraphPlottingCanvas.tsx       (NEW - extracted core canvas logic)
└── index.ts                      (updated - export new components)
```

## Phase 1: Create ExpandedGraphModal Component

**New file: `src/components/graph/ExpandedGraphModal.tsx`**

A full-screen dialog that:
- Takes the same props as `GraphPlottingQuestion`
- Renders the graph at 80-90% of viewport size
- Provides a pinned toolbar at the top
- Includes zoom controls and "Reset View" button

```typescript
interface ExpandedGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Pass through all GraphPlottingQuestion props
  config: GraphPlottingConfig;
  studentPoints: GraphPoint[];
  onPointsChange: (points: GraphPoint[]) => void;
  segments: LineSegment[];
  onSegmentsChange: (segments: LineSegment[]) => void;
  drawnPaths?: DrawingPath[];
  onDrawnPathsChange?: (paths: DrawingPath[]) => void;
  joinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | null;
  onJoinModeChange?: (mode: ...) => void;
  
  // Domain/scale (locked between views)
  domainX: [number, number];
  domainY: [number, number];
  
  // Review mode data
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: GraphPlottingMarkingResult;
  referenceSeries?: GraphSeries[];
  expectedCurveSeries?: GraphSeries[];
  
  // Styling
  subjectColor?: string;
}
```

### Modal Layout

```text
┌─────────────────────────────────────────────────────────┐
│  [✕ Close]                     Graph Focus Mode         │
├─────────────────────────────────────────────────────────┤
│  [Undo] [Redo] [Clear] [Erase]  |  Straight Curved ...  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│                                                         │
│               LARGE GRAPH CANVAS                        │
│               (80% viewport height)                     │
│                                                         │
│                                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Helper text | [Snap to Grid ○] | [Done]               │
└─────────────────────────────────────────────────────────┘
```

### Key Implementation Details

1. **Shared State**: The modal receives the exact same callback props (`onPointsChange`, etc.) as the inline graph. Any drawing in the modal immediately updates the parent state.

2. **Locked Domain**: The `domainX` and `domainY` are passed from the parent and are identical in both views. This prevents scale mismatch.

3. **No Data Transformation**: Because `GraphDrawingCanvas` already stores `dataPoints` in graph coordinates, the same strokes render identically regardless of canvas size.

4. **Aspect Ratio**: The expanded canvas maintains `aspect-[4/3]` (matching inline) but at ~80% viewport width.

## Phase 2: Add Expand Button to GraphPlottingQuestion

**Update: `src/components/graph/GraphPlottingQuestion.tsx`**

Add state and trigger button:

```typescript
// New state
const [isExpanded, setIsExpanded] = useState(false);

// In the toolbar section (near Undo/Redo)
<Button
  variant="outline"
  size="icon"
  onClick={() => setIsExpanded(true)}
  title="Expand graph"
>
  <Maximize2 className="h-4 w-4" />
</Button>

// At component end
{isExpanded && (
  <ExpandedGraphModal
    isOpen={isExpanded}
    onClose={() => setIsExpanded(false)}
    config={config}
    studentPoints={studentPoints}
    onPointsChange={onPointsChange}
    segments={segments}
    onSegmentsChange={onSegmentsChange}
    drawnPaths={drawnPaths}
    onDrawnPathsChange={onDrawnPathsChange}
    joinMode={joinMode}
    onJoinModeChange={onJoinModeChange}
    domainX={domainX}
    domainY={domainY}
    readOnly={readOnly}
    showCorrectAnswers={showCorrectAnswers}
    markingData={markingData}
    referenceSeries={referenceSeries}
    expectedCurveSeries={expectedCurveSeries}
    subjectColor={subjectColor}
    questionId={questionId}
    showProtractor={showProtractor}
    protractorState={protractorState}
    onProtractorStateChange={onProtractorStateChange}
    selectedSegmentIds={selectedSegmentIds}
    onSelectedSegmentIdsChange={onSelectedSegmentIdsChange}
    angleMeasurements={angleMeasurements}
    onAngleMeasurementsChange={onAngleMeasurementsChange}
  />
)}
```

## Phase 3: Enhanced Modal Features

### 3.1 Toolbar (Pinned Top)

The toolbar is duplicated in the modal with the same functionality:
- Undo / Redo
- Clear All
- Erase mode toggle
- Mode toggle group (Straight, Curved, Freeform, Angle)
- **New**: Expand button replaced with "Exit Full Screen" button

### 3.2 Optional Controls Panel

**Nice-to-have toggles** (can be added later):

```typescript
// Local UI state (doesn't affect data)
const [snapToGrid, setSnapToGrid] = useState(false);
const [showGridLabels, setShowGridLabels] = useState(true);

// In footer area
<div className="flex items-center gap-4">
  <label className="flex items-center gap-2 text-sm">
    <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
    Snap to grid
  </label>
  <Button variant="ghost" size="sm" onClick={resetPan}>
    Reset View
  </Button>
</div>
```

### 3.3 "Done" Button Behavior

- Clicking "Done" or "✕ Close" simply calls `onClose()`
- No separate save action needed - state is already synced
- The inline graph immediately reflects all changes made in the modal

## Phase 4: Coordinate Stability Verification

### Acceptance Checks

The implementation must pass these tests:

1. **Draw in modal, view inline**: A line drawn in expanded view renders identically when collapsed.

2. **Draw inline, view in modal**: A line drawn in the small view looks the same when expanded.

3. **Submit stability**: After submitting, the student's drawing doesn't shift in the feedback/review overlay.

4. **Review mode parity**: The expected curve overlay (dashed green) aligns perfectly in both views.

### Technical Guarantees

- Both views use the **same `domainX`/`domainY`** (never recalculated)
- Both views use the **same coordinate conversion formulas** (data <-> pixel via `dataToPixel`/`pixelToData`)
- `DrawingPath.dataPoints` are stored in graph coordinates, not pixels
- `LineSegment.from`/`to` use graph coordinates with point IDs for stable matching

## Potential Pitfalls and Mitigations

| Pitfall | Mitigation |
|---------|------------|
| Modal causes parent re-render, losing draft state | Use stable callback refs; test with fast open/close cycles |
| Touch events conflict with modal backdrop | Use `touchAction: none` on canvas; portal modal above all overlays |
| Axis scale looks different due to ResponsiveContainer | Lock axis domain as props; use same `tickCount` formula |
| History (undo/redo) resets when entering modal | History state lives in parent `GraphPlottingQuestion`; passed as props |
| Focus trap in modal breaks keyboard shortcuts | Use `onPointerDownOutside` to close; avoid focus trap on canvas area |

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/graph/ExpandedGraphModal.tsx` | Full-screen modal containing large graph canvas with duplicated toolbar |

## Files to Update

| File | Changes |
|------|---------|
| `src/components/graph/GraphPlottingQuestion.tsx` | Add `isExpanded` state, expand button in toolbar, render modal conditionally |
| `src/components/graph/index.ts` | Export `ExpandedGraphModal` |

## Implementation Order

1. **Create `ExpandedGraphModal.tsx`** with basic dialog structure and large canvas
2. **Add expand button** to `GraphPlottingQuestion.tsx` toolbar
3. **Wire up all props** between parent and modal
4. **Test draw → close → verify inline** cycle
5. **Add optional controls** (snap to grid, reset view) if time permits
6. **Test on iPad/mobile** for touch interaction stability

## Technical Notes

### Modal Sizing

```tsx
<DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-4">
  {/* Toolbar: ~60px */}
  {/* Canvas: remaining height with aspect-[4/3] constraint */}
  {/* Footer: ~48px */}
</DialogContent>
```

### Graph Canvas Height Calculation

```tsx
// Available height = viewport - toolbar - footer - padding
const canvasHeight = `calc(95vh - 60px - 48px - 32px)`;
// Or use aspect ratio and constrain by width
<div className="w-full" style={{ height: canvasHeight }}>
  <ResponsiveContainer width="100%" height="100%">
    ...
  </ResponsiveContainer>
</div>
```

### Preserving Join Mode Across Views

The `joinMode` state and `onJoinModeChange` callback are passed to both views. Selecting "Curved" mode in the modal immediately reflects in the inline toolbar when closed.

## Expected Outcomes

After implementation:

1. **More accurate drawings** - Larger canvas = less coordinate cramming
2. **Clearer axis increments** - More space for tick labels
3. **Easier review comparison** - Student curve + expected curve visible without overlapping
4. **Consistent rendering** - Same drawing in both views, no shifting on submit
5. **Touch-friendly** - Full-screen works better on iPad than cramped inline view
