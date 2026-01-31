# Implementation Status

## ✅ Phase 1 Complete: Camera State & Coordinate System
- Added `CameraState`, `GraphViewport` interfaces to `types.ts`
- Added helper functions `getVisibleDomain`, `createCameraFromDomain`
- Updated `DrawingPath` to deprecate pixel coords, prefer `dataPoints`

## ✅ Phase 2 Complete: Canvas-Based Renderer
- Created `useGraphCamera` hook with pan/zoom, coordinate conversion
- Created `GraphCanvas` component with GridLayer, AxisLayer
- Created `CurveLayer` and `PointLayer` helper components

## 🔄 Phase 3-4: Integration (Next)
- Integrate GraphCanvas into GraphPlottingQuestion (replace Recharts)
- Add pan/zoom gesture handling
- Migrate drawing storage to graph-only coordinates


# Desmos-Style Camera-Based Graph System

## Executive Summary

This is a **major architectural refactor** of the graph system — transitioning from a fixed-size, fixed-scale Recharts-based graph to a camera-based, pan/zoom-enabled canvas that behaves like Desmos.

**Key Insight**: The current bugs (lines shifting after submit, cramped graphs, precision loss, inconsistent rendering) all stem from a fundamental problem: **the graph is tied to pixel/viewport dimensions rather than a stable mathematical coordinate system**.

---

## Current Architecture (Problems)

The current system uses Recharts' `ResponsiveContainer` + `ComposedChart` with fixed domains:

```
┌─────────────────────────────────────┐
│        ResponsiveContainer          │
│  ┌───────────────────────────────┐  │
│  │    ComposedChart              │  │
│  │  - Fixed domainX/domainY      │  │
│  │  - Fixed aspect-ratio         │  │
│  │  - Pixel-based hit detection  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Current Weaknesses**:
1. `GraphDrawingCanvas` stores paths in pixel coords (converts to data coords on save, but original capture is pixel-based)
2. Axis scales are captured from Recharts state after render — creating timing/sync issues
3. Fixed `aspect-[4/3]` forces rectangular graphs that compress curves
4. No pan/zoom — students can't explore larger domains
5. Different viewport sizes in drawing vs. review mode cause visual shifts
6. `pixelToData` / `dataToPixel` conversions happen in multiple places with slight variations

---

## Proposed Architecture (Camera Model)

```
┌─────────────────────────────────────────────────────────┐
│                   Canvas/SVG Layer                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Camera Viewport                       │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  centerX, centerY                           │  │  │
│  │  │  scaleX, scaleY (units per pixel)          │  │  │
│  │  │  viewportWidth, viewportHeight (pixels)     │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                    │  │
│  │   All data stored in GRAPH COORDINATES only       │  │
│  │   Camera converts graph → screen for rendering    │  │
│  │   Camera converts screen → graph for input        │  │
│  │                                                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Core Principle**: "Graph data lives in math space. Camera controls how we look at it. The camera never changes the data."

---

## Technical Implementation Plan

### Phase 1: Camera State & Coordinate System (Foundation)

**New Types** (`src/components/graph/types.ts`):
```typescript
interface CameraState {
  centerX: number;    // Graph x-coordinate at viewport center
  centerY: number;    // Graph y-coordinate at viewport center
  scale: number;      // Graph units per 100 pixels (unified scale)
  // Computed from scale + viewport:
  // visibleDomainX = [centerX - (viewportWidth * scale / 200), centerX + (viewportWidth * scale / 200)]
}

interface GraphViewport {
  width: number;      // Pixel width
  height: number;     // Pixel height
  camera: CameraState;
}
```

**New Hook** (`src/hooks/useGraphCamera.ts`):
- Manages camera state (pan/zoom)
- Provides stable `graphToScreen(x, y)` and `screenToGraph(px, py)` functions
- Handles zoom (wheel/pinch) centered on cursor
- Handles pan (drag/two-finger)
- Auto-scales grid tick labels based on zoom level

---

### Phase 2: Canvas-Based Renderer (Replace Recharts)

**New Component** (`src/components/graph/GraphCanvas.tsx`):

Replace Recharts' `ComposedChart` with a custom SVG/Canvas renderer:

```
┌──────────────────────────────────────┐
│ GraphCanvas                          │
│  ├── GridLayer (dynamic based on    │
│  │    camera zoom level)            │
│  ├── AxisLayer (x/y axes at 0)      │
│  ├── CurvesLayer (reference/        │
│  │    expected curves)              │
│  ├── SegmentsLayer (student lines)  │
│  ├── PointsLayer (student points)   │
│  ├── DrawingLayer (freeform paths)  │
│  └── InteractionLayer (hit testing) │
└──────────────────────────────────────┘
```

**Benefits**:
- Single source of truth for coordinate conversion
- No Recharts internal state synchronization issues
- Full control over rendering pipeline
- Pan/zoom support built-in

---

### Phase 3: Interaction Handlers (Pan/Zoom)

**Zoom Behavior**:
- Mouse wheel / trackpad scroll → zoom in/out
- Pinch gesture on touch → zoom
- Zoom centered on cursor/pinch midpoint
- Grid re-scales automatically (major/minor ticks adapt)
- Minimum zoom: show at least 4 units; Maximum: show up to 50 units

**Pan Behavior**:
- Click + drag (with no point selected) → pan
- Two-finger drag on touch → pan
- Moves camera, not data
- Constrained to reasonable bounds (e.g., ±100 units)

**Drawing Behavior** (unchanged logic, new coordinate system):
- All coordinates stored in graph space immediately
- No pixel coordinates stored for paths/points
- Camera state is **not** part of the answer submission

---

### Phase 4: Drawing Storage (Graph Coordinates Only)

**Updated `DrawingPath` type**:
```typescript
interface DrawingPath {
  id: string;
  // REMOVE pixel coordinates entirely
  // points: Array<{ pixelX: number; pixelY: number }>; // DELETED
  
  // KEEP ONLY data coordinates (full precision)
  dataPoints: Array<{ x: number; y: number }>;
}
```

**Updated `GraphPoint` type**:
```typescript
interface GraphPoint {
  id?: string;
  x: number;  // Graph coordinate (full precision)
  y: number;  // Graph coordinate (full precision)
  label?: string;
}
```

**Rendering**:
- Convert `dataPoints` to screen coordinates using current camera
- Zooming/panning never modifies stored coordinates

---

### Phase 5: Marking Independence (Camera-Agnostic)

**Marking Logic** (`math-engine.ts`):
- Already uses graph coordinates (`markSketch`, `evaluate`)
- Verify no camera/viewport dependencies leak in
- Add explicit type guard: marking functions take only `GraphPoint[]`, not viewport info

**Response Serialization**:
```typescript
interface GraphPlottingResponse {
  _type: 'graph_plotting';
  version: 2; // Bump version
  points: GraphPoint[]; // Graph coordinates only
  segments?: LineSegment[]; // Graph coordinates only
  drawnPaths?: DrawingPath[]; // Graph coordinates only
  // NO camera state — camera is ephemeral UI state
}
```

---

### Phase 6: Expanded Mode (Full-Page Workspace)

**Updated `ExpandedGraphModal.tsx`**:
- Becomes a true full-page takeover (`fixed inset-0`)
- Square-ish aspect ratio (1:1 preferred)
- Vertically scrollable container for larger canvases
- Same camera state as inline view (or reset to default)
- Shared state via callbacks (already implemented)

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ [Collapse] [Question Text]                       │
├─────────────────────────────────────────────────┤
│ [Undo] [Redo] [Clear] [Tools...]    [Exit]       │
├─────────────────────────────────────────────────┤
│                                                  │
│               ┌───────────────────┐              │
│               │                   │              │
│               │   Graph Canvas    │              │
│               │   (aspect ~1:1)   │              │
│               │                   │              │
│               └───────────────────┘              │
│                                                  │
│         [Zoom controls] [Reset view]             │
└─────────────────────────────────────────────────┘
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/graph/types.ts` | Modify | Add `CameraState`, remove pixel coords from `DrawingPath` |
| `src/hooks/useGraphCamera.ts` | Create | Camera state management, pan/zoom, coordinate conversion |
| `src/components/graph/GraphCanvas.tsx` | Create | SVG-based canvas with camera support |
| `src/components/graph/GridLayer.tsx` | Create | Dynamic grid that adapts to zoom level |
| `src/components/graph/CurvesLayer.tsx` | Create | Renders reference/expected curves |
| `src/components/graph/GraphPlottingQuestion.tsx` | Major Rewrite | Replace Recharts with GraphCanvas, use camera hook |
| `src/components/graph/ExpandedGraphModal.tsx` | Modify | Full-page layout, share camera with GraphCanvas |
| `src/components/graph/GraphDrawingCanvas.tsx` | Modify | Remove pixel storage, use camera for conversions |
| `src/components/graph/GraphSegmentsLayer.tsx` | Modify | Use camera coordinate system |
| `supabase/functions/grade-practice-question/index.ts` | Verify | Ensure no camera dependencies |

---

## Migration Strategy

**Backward Compatibility**:
- Existing `DrawingPath` objects with `points` (pixel) will fall back to `dataPoints` if present
- Version 1 responses can still be rendered (legacy pixel paths re-converted on load)
- Bump response version to 2 for new camera-based paths

**Phased Rollout**:
1. Phase 1-2: Build camera system and canvas renderer in parallel
2. Phase 3: Add pan/zoom gestures
3. Phase 4: Migrate drawing storage
4. Phase 5: Verify marking independence
5. Phase 6: Finalize expanded mode

---

## Benefits Achieved

| Current Problem | Solution |
|-----------------|----------|
| Lines shift after submit | All storage in graph coordinates; camera is ephemeral |
| Cramped/rectangular graphs | Square aspect ratio + vertical scroll |
| Precision loss when zoomed | Zoom doesn't change data, only view |
| Inconsistent scales | Single camera state for all rendering |
| Poor touch usability | Pinch-to-zoom, drag-to-pan |
| Different rendering in draw vs. review | Same camera model for both modes |

---

## Dependencies & Risks

**Dependencies**:
- Replacing Recharts requires reimplementing grid/axis rendering
- Touch gesture handling needs careful cross-device testing

**Risks**:
- Significant refactor; requires thorough testing
- Existing saved answers with pixel coords need migration path

**Mitigation**:
- Keep legacy rendering path for version 1 responses
- Implement feature flag for gradual rollout

