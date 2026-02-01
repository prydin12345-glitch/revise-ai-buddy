# Desmos-Style Camera-Based Graph System

## Implementation Progress

### ✅ Phase 1-2: Foundation (Complete)
- Created `CameraState` and `GraphViewport` types in `types.ts`
- Built `useGraphCamera` hook with pan/zoom/coordinate conversion
- Created `GraphCanvas.tsx` SVG-based renderer with grid, axes, curves, points
- Helper functions: `getVisibleDomain`, `createCameraFromDomain`

### ✅ Phase 3: Components Ready (Complete)
- Created `GraphCanvasPlot.tsx` - drop-in replacement with camera support
- Supports all features: points, segments, curves, freeform drawing
- Integrates with `useGraphCamera` for pan/zoom functionality

### ✅ Phase 4: Drawing Storage Migration (Complete)
- `DrawingPath.dataPoints` is now the **canonical** storage format
- `DrawingPath.points` (pixel coords) deprecated for backward compatibility
- `GraphDrawingCanvas` now stores only graph coordinates
- Updated `TakePracticeQuiz.tsx` types for compatibility

### ✅ Phase 5: Marking Independence (Complete - Already Camera-Agnostic)
- Marking logic in `math-engine.ts` uses only graph coordinates
- No camera/viewport dependencies in grading functions

### ✅ Phase 6: Expanded Mode (Complete - Already Full-Page)
- `ExpandedGraphModal` is a full-page takeover (`fixed inset-0 z-50`)
- Square aspect ratio with `aspectRatio: '1 / 1'`
- Vertical scrolling via `ScrollArea`
- Shares state with inline view via callbacks

### ✅ Phase 7: Integration (Complete)
- Added `useCameraRenderer` prop to `GraphPlottingQuestion` component
- When `useCameraRenderer={true}`, uses new `GraphCanvasPlot` with pan/zoom
- Backward compatible - default is false (uses existing Recharts)
- Created `/graph-test` route for testing the new camera system

---

## Files Created
- `src/hooks/useGraphCamera.ts` - Camera state management with pan/zoom
- `src/components/graph/GraphCanvas.tsx` - Core SVG renderer with layers
- `src/components/graph/GraphCanvasPlot.tsx` - Full plotting component
- `src/pages/GraphTest.tsx` - Test page for new camera-based graph

## Files Modified
- `src/components/graph/types.ts` - Added camera types, updated DrawingPath
- `src/components/graph/index.ts` - Updated exports
- `src/components/graph/GraphDrawingCanvas.tsx` - Graph-coord-only storage
- `src/components/graph/GraphPlottingQuestion.tsx` - Added `useCameraRenderer` prop
- `src/pages/TakePracticeQuiz.tsx` - Updated UserAnswer types
- `src/App.tsx` - Added `/graph-test` route

---

## Architecture Summary

### Core Principle
"Graph data lives in math space. Camera controls how we look at it. The camera never changes the data."

### Camera Model
```typescript
interface CameraState {
  centerX: number;    // Graph x-coord at viewport center
  centerY: number;    // Graph y-coord at viewport center
  scale: number;      // Graph units per 100 pixels
}
```

### Coordinate Flow
1. **Input**: Screen pixels → `screenToGraph()` → Graph coordinates (stored)
2. **Storage**: Only graph coordinates (dataPoints, not pixelX/pixelY)
3. **Render**: Graph coordinates → `graphToScreen()` → Screen pixels (ephemeral)

### Benefits
| Problem | Solution |
|---------|----------|
| Lines shift after submit | All storage in graph coordinates |
| Precision loss when zoomed | Zoom changes camera, not data |
| Inconsistent scales | Single camera state for all rendering |

---

## Migration Strategy

### Current State
- Existing `GraphPlottingQuestion` and `ExpandedGraphModal` use Recharts
- New `GraphCanvasPlot` component ready for use
- Both systems coexist - gradual migration possible

### Recommended Approach
1. **Use `GraphCanvasPlot` for new features** that need pan/zoom
2. **Existing components continue working** with Recharts
3. **Add feature flag** if needed for A/B testing
4. **Migrate when touching files** for other changes

### Backward Compatibility
- Old saved paths with `points` (pixel coords) still render
- Legacy fallback in `GraphDrawingCanvas.pathToPolylinePoints()`
- New paths only store `dataPoints` (graph coords)
