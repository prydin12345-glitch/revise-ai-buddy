import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { GraphCanvas, CurveLayer } from './GraphCanvas';
import { AnnotationLayer } from './AnnotationLayer';
import { useGraphCamera } from '@/hooks/useGraphCamera';
import { 
  GraphPoint, 
  GraphSeries, 
  LineSegment, 
  DrawingPath,
  GraphPlottingConfig,
  GraphPlottingMarkingResult 
} from './types';
import { GraphDrawingCanvas } from './GraphDrawingCanvas';
import { AngleMeasurement } from './GraphPlottingQuestion';
import { cn } from '@/lib/utils';
import { generateCurveFromFormula } from '@/lib/formula-evaluator';

/**
 * Catmull-Rom spline interpolation for smooth curves through points.
 */
function catmullRomSpline(points: GraphPoint[], tension: number = 0.5, numSegments: number = 20): GraphPoint[] {
  if (points.length < 2) return points;
  if (points.length === 2) {
    // Just return a line between two points
    return points;
  }
  
  const result: GraphPoint[] = [];
  
  // Sort points by x for consistent curve direction
  const sorted = [...points].sort((a, b) => a.x - b.x);
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[Math.max(0, i - 1)];
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    const p3 = sorted[Math.min(sorted.length - 1, i + 2)];
    
    for (let t = 0; t <= 1; t += 1 / numSegments) {
      const t2 = t * t;
      const t3 = t2 * t;
      
      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );
      
      result.push({ x, y });
    }
  }
  
  // Add the last point
  result.push(sorted[sorted.length - 1]);
  
  return result;
}

interface GraphCanvasPlotProps {
  /** Container dimensions */
  width: number;
  height: number;
  /** Graph configuration */
  config: GraphPlottingConfig;
  /** Domain bounds */
  domainX: [number, number];
  domainY: [number, number];
  /** Student plotted points */
  studentPoints: GraphPoint[];
  /** Line segments */
  segments: LineSegment[];
  /** Drawn paths (freeform) */
  drawnPaths: DrawingPath[];
  /** Current join mode */
  joinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | null;
  /** Reference series to display */
  referenceSeries?: GraphSeries[];
  /** Expected curve in review mode */
  expectedCurveSeries?: GraphSeries[];
  /** Marking data for review */
  markingData?: GraphPlottingMarkingResult;
  /** Subject color */
  subjectColor?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Show correct answers */
  showCorrectAnswers?: boolean;
  /** Whether pan/zoom is enabled (disabled when drawing) */
  panZoomEnabled?: boolean;
  /** Erase mode active */
  eraseMode?: boolean;
  /** Angle measurements */
  angleMeasurements?: AngleMeasurement[];
  /** Selected segment IDs for angle mode */
  selectedSegmentIds?: string[];
  /** Active drag point ID */
  activeDragPointId?: string | null;
  /** Currently dragging point ID */
  draggingPointId?: string | null;
  /** Current dragging position */
  draggingPosition?: { x: number; y: number } | null;
  /** Selected join points */
  selectedJoinPoints?: GraphPoint[];
  /** Curve mode: 'auto' = Catmull-Rom spline, 'manual' = Bézier control handles */
  curveMode?: 'auto' | 'manual';
  /** Callback when curve mode changes (e.g. auto-switch to manual on handle drag) */
  onCurveModeChange?: (mode: 'auto' | 'manual') => void;
  /** Callback to update segments (for control handle dragging) */
  onSegmentsChange?: (segments: LineSegment[]) => void;
  /** Point interaction callbacks */
  onPointPointerDown?: (point: GraphPoint, e: React.PointerEvent) => void;
  onPointPointerMove?: (e: React.PointerEvent) => void;
  onPointPointerUp?: (point: GraphPoint, e: React.PointerEvent) => void;
  /** Callback to add a new point at graph coordinates (called on tap) */
  onAddPoint?: (graphX: number, graphY: number) => void;
  /** Container pointer callbacks - these receive screenToGraph for coordinate conversion */
  onContainerPointerDown?: (e: React.PointerEvent, screenToGraph: (x: number, y: number) => { x: number; y: number }) => void;
  onContainerPointerMove?: (e: React.PointerEvent) => void;
  onContainerPointerUp?: (e: React.PointerEvent, screenToGraph: (x: number, y: number) => { x: number; y: number }) => void;
  onContainerPointerCancel?: (e: React.PointerEvent) => void;
  /** Drawn paths change callback */
  onDrawnPathsChange?: (paths: DrawingPath[]) => void;
  /** Segment click for erase/angle mode */
  onSegmentClick?: (segmentId: string) => void;
  /** Custom cursor */
  cursor?: string;
}

/**
 * GraphCanvasPlot - Camera-based graph plotting component.
 * 
 * This component replaces the Recharts-based chart with a custom SVG renderer
 * that uses a camera model for pan/zoom and stores all coordinates in graph space.
 */
export function GraphCanvasPlot({
  width,
  height,
  config,
  domainX,
  domainY,
  studentPoints,
  segments,
  drawnPaths,
  joinMode,
  referenceSeries = [],
  expectedCurveSeries = [],
  markingData,
  subjectColor = 'hsl(var(--primary))',
  readOnly = false,
  showCorrectAnswers = false,
  panZoomEnabled = true,
  eraseMode = false,
  angleMeasurements = [],
  selectedSegmentIds = [],
  activeDragPointId,
  draggingPointId,
  draggingPosition,
  selectedJoinPoints = [],
  curveMode = 'auto',
  onCurveModeChange,
  onSegmentsChange,
  onPointPointerDown,
  onPointPointerMove,
  onPointPointerUp,
  onAddPoint,
  onContainerPointerDown,
  onContainerPointerMove,
  onContainerPointerUp,
  onContainerPointerCancel,
  onDrawnPathsChange,
  onSegmentClick,
  cursor,
}: GraphCanvasPlotProps) {
  
  // Track tap detection (to distinguish taps from pans)
  const tapStartRef = useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
  const TAP_THRESHOLD_PX = 10;
  const TAP_THRESHOLD_MS = 300;
  
  // Control handle dragging state
  const [draggingControlHandle, setDraggingControlHandle] = useState<{
    segmentId: string;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);
  const [controlHandlePosition, setControlHandlePosition] = useState<{ x: number; y: number } | null>(null);
  
  // Initialize camera hook
  // NOTE: Camera pan/zoom is ALWAYS enabled when panZoomEnabled is true,
  // even in readOnly mode. readOnly only prevents editing (adding points, etc.)
  // Apply quadrant mode clamping
  let effectiveDomainX = domainX;
  let effectiveDomainY = domainY;
  const quadrantMode = config.subjectProfile?.quadrantMode;
  if (quadrantMode === 'q1') {
    effectiveDomainX = [Math.max(-0.5, domainX[0]), domainX[1]];
    effectiveDomainY = [Math.max(-0.5, domainY[0]), domainY[1]];
  } else if (quadrantMode === 'q1q2') {
    effectiveDomainY = [Math.max(-0.5, domainY[0]), domainY[1]];
  }

  const {
    camera,
    visibleDomain,
    graphToScreen,
    screenToGraph,
    zoom,
    handlers: cameraHandlers,
    isPanning,
    resetCamera,
  } = useGraphCamera({
    initialDomainX: effectiveDomainX,
    initialDomainY: effectiveDomainY,
    viewportWidth: width,
    viewportHeight: height,
    interactionEnabled: panZoomEnabled, // Allow pan/zoom even in readOnly mode
    minScale: 0.3,
    maxScale: 15,
  });
  
  // Check if a point is selected for joining
  const isPointSelected = useCallback((point: GraphPoint): boolean => {
    return selectedJoinPoints.some(p => p.id === point.id);
  }, [selectedJoinPoints]);
  
  // Get point status for marking
  const getPointStatus = useCallback((point: GraphPoint): 'correct' | 'incorrect' | 'neutral' => {
    if (!showCorrectAnswers || !markingData?.perPointResults) return 'neutral';
    
    // Use tolerance-based matching to avoid floating point mismatch on reload (Bug 4 fix)
    const result = markingData.perPointResults.find(r => 
      r.studentPoint && 
      Math.abs(r.studentPoint.x - point.x) < 0.01 && 
      Math.abs(r.studentPoint.y - point.y) < 0.01
    );
    
    if (!result) return 'neutral';
    return result.status === 'correct' ? 'correct' : 'incorrect';
  }, [showCorrectAnswers, markingData]);
  
  // Missed expected points for showing correct answers
  const missedPoints = useMemo(() => {
    if (!showCorrectAnswers || !markingData?.perPointResults) return [];
    
    return markingData.perPointResults
      .filter(r => r.status === 'missed' && r.expectedPoint)
      .map(r => r.expectedPoint!);
  }, [showCorrectAnswers, markingData]);
  
  // Generate curved line data when in curved mode (auto only)
  const curvedLineData = useMemo(() => {
    if (joinMode !== 'curved' || curveMode !== 'auto' || studentPoints.length < 3) return null;
    return catmullRomSpline(studentPoints);
  }, [joinMode, curveMode, studentPoints]);
  
  // Control handle drag handlers
  const handleControlHandlePointerDown = useCallback((segmentId: string, e: React.PointerEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    // Auto-switch to manual mode when user drags a handle in auto mode
    if (curveMode === 'auto' && onCurveModeChange) {
      onCurveModeChange('manual');
      // Also ensure this segment gets a control point stored
      if (onSegmentsChange) {
        const seg = segments.find(s => s.id === segmentId);
        if (seg && !seg.controlPoint) {
          const midX = (seg.from.x + seg.to.x) / 2;
          const midY = (seg.from.y + seg.to.y) / 2;
          const dx = seg.to.x - seg.from.x;
          const dy = seg.to.y - seg.from.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const bulge = length * 0.2;
          const perpX = length > 0 ? -dy / length * bulge : 0;
          const perpY = length > 0 ? dx / length * bulge : 0;
          const updatedSegments = segments.map(s => 
            s.id === segmentId ? { ...s, controlPoint: { x: midX + perpX, y: midY + perpY } } : s
          );
          onSegmentsChange(updatedSegments);
        }
      }
    }
    setDraggingControlHandle({ segmentId, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId });
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [readOnly, curveMode, onCurveModeChange, segments, onSegmentsChange]);
  
  const handleControlHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingControlHandle || draggingControlHandle.pointerId !== e.pointerId) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const graphCoords = screenToGraph(screenX, screenY);
    setControlHandlePosition(graphCoords);
  }, [draggingControlHandle, screenToGraph]);
  
  const handleControlHandlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingControlHandle || draggingControlHandle.pointerId !== e.pointerId) return;
    e.stopPropagation();
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
    
    if (controlHandlePosition && onSegmentsChange) {
      const updatedSegments = segments.map(seg => 
        seg.id === draggingControlHandle.segmentId
          ? { ...seg, controlPoint: { x: controlHandlePosition.x, y: controlHandlePosition.y } }
          : seg
      );
      onSegmentsChange(updatedSegments);
    }
    setDraggingControlHandle(null);
    setControlHandlePosition(null);
  }, [draggingControlHandle, controlHandlePosition, segments, onSegmentsChange]);
  
  // Combine camera handlers with our custom handlers - with tap detection
  // NOTE: Camera pan/zoom should work even in readOnly mode for exploration
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Start tap detection
    tapStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now(), pointerId: e.pointerId };
    
    // Let camera handle pan/zoom if enabled (works in readOnly too)
    if (panZoomEnabled) {
      cameraHandlers.onPointerDown(e);
    }
    // Also call custom handler with screenToGraph for coordinate conversion
    onContainerPointerDown?.(e, screenToGraph);
  }, [panZoomEnabled, cameraHandlers, onContainerPointerDown, screenToGraph]);
  
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Check if we've moved too far to be a tap
    if (tapStartRef.current && tapStartRef.current.pointerId === e.pointerId) {
      const dx = Math.abs(e.clientX - tapStartRef.current.x);
      const dy = Math.abs(e.clientY - tapStartRef.current.y);
      if (dx > TAP_THRESHOLD_PX || dy > TAP_THRESHOLD_PX) {
        tapStartRef.current = null; // Cancel tap detection
      }
    }
    
    // Camera pan works even in readOnly mode
    if (panZoomEnabled) {
      cameraHandlers.onPointerMove(e);
    }
    onContainerPointerMove?.(e);
    onPointPointerMove?.(e);
  }, [panZoomEnabled, cameraHandlers, onContainerPointerMove, onPointPointerMove]);
  
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Check if this was a tap (quick, minimal movement)
    const wasTap = tapStartRef.current && 
      tapStartRef.current.pointerId === e.pointerId &&
      Date.now() - tapStartRef.current.time < TAP_THRESHOLD_MS;
    
    tapStartRef.current = null;
    
    // Camera handlers work even in readOnly mode
    if (panZoomEnabled) {
      cameraHandlers.onPointerUp(e);
    }
    
    // If it was a tap and we have an onAddPoint handler, add a point (only if not readOnly)
    if (wasTap && onAddPoint && !readOnly && !isPanning) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const graphCoords = screenToGraph(screenX, screenY);
      // Let the parent handle the tap through the callback with coordinates
    }
    
    onContainerPointerUp?.(e, screenToGraph);
  }, [panZoomEnabled, readOnly, cameraHandlers, onContainerPointerUp, screenToGraph, onAddPoint, isPanning]);
  
  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    tapStartRef.current = null;
    if (panZoomEnabled) {
      cameraHandlers.onPointerCancel(e);
    }
    onContainerPointerCancel?.(e);
  }, [panZoomEnabled, cameraHandlers, onContainerPointerCancel]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Wheel zoom works even in readOnly mode
    if (panZoomEnabled) {
      cameraHandlers.onWheel(e);
    }
  }, [panZoomEnabled, readOnly, cameraHandlers]);
  
  // Determine effective cursor
  const effectiveCursor = cursor || (
    readOnly ? 'default' : 
    eraseMode ? 'pointer' : 
    isPanning ? 'grabbing' : 
    'crosshair'
  );
  
  // Store graphToScreen in a ref so native wheel handler can use it for hit testing
  const graphToScreenRef = useRef(graphToScreen);
  useEffect(() => {
    graphToScreenRef.current = graphToScreen;
  }, [graphToScreen]);
  
  // Add a native wheel listener to the container div with { passive: false }
  // This is necessary because React's synthetic onWheel uses passive listeners
  // which cannot call preventDefault() to stop page zoom
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Store zoom function in ref for use in native wheel handler
  // IMPORTANT: Initialize with the current zoom function immediately, not null
  // This prevents race conditions where wheel events fire before useEffect runs
  const zoomRef = useRef(zoom);
  
  // Keep the ref updated when zoom function changes (shouldn't change much, but be safe)
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  
  // Add a native wheel listener to the container div with { passive: false }
  // This is necessary because React's synthetic onWheel uses passive listeners
  // which cannot call preventDefault() to stop page zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleNativeWheel = (e: WheelEvent) => {
      // Always prevent default when over the graph area to stop page zoom/scroll
      e.preventDefault();
      e.stopPropagation();
      
      // Only apply zoom if pan/zoom is enabled
      if (!panZoomEnabled) return;
      
      // Calculate zoom factor based on wheel delta - SMOOTH zooming
      // deltaY > 0 = scroll down = zoom out, deltaY < 0 = scroll up = zoom in
      // Use normalized deltaY for consistent behavior across browsers/trackpads
      const normalizedDelta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100);
      const zoomFactor = 1 + (normalizedDelta / 100) * 0.08; // 8% zoom per scroll unit
      
      // Get cursor position relative to the container
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      // Guard against invalid coordinates
      if (!Number.isFinite(cursorX) || !Number.isFinite(cursorY)) return;
      
      // Call zoom function from ref (guaranteed to be valid since initialized with zoom)
      zoomRef.current(zoomFactor, cursorX, cursorY);
    };
    
    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [panZoomEnabled]); // Don't depend on zoom - use ref instead to avoid effect re-runs
  
  if (width <= 0 || height <= 0) return null;
  
  return (
    <div 
      ref={containerRef}
      className="relative select-none"
      style={{ 
        width, 
        height, 
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <GraphCanvas
        width={width}
        height={height}
        camera={camera}
        graphToScreen={graphToScreen}
        screenToGraph={screenToGraph}
        visibleDomain={visibleDomain}
        cameraHandlers={{
          onWheel: handleWheel,
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
          onPointerCancel: handlePointerCancel,
        }}
        interactionEnabled={panZoomEnabled}
        isPanning={isPanning}
        readOnly={readOnly}
        cursor={effectiveCursor}
        axisLabels={config.subjectProfile?.axisLabels || (config.xLabel !== 'x' || config.yLabel !== 'y' ? { x: config.xLabel, y: config.yLabel } : undefined)}
      >
        {/* ============================================================
           VISUAL STYLE HIERARCHY (Audit v5 Fix #3)
           ============================================================
           ASYMPTOTES: Thin Dashed Grey lines (from config.asymptotes)
           REFERENCE/GHOST CURVES: Faint Dashed Grey (parent function for transformations)
           EXPECTED ANSWER CURVE: SOLID line (Green if correct, Red if incorrect)
           ============================================================ */}
        
        {/* Reference curves (Ghost/Shadow lines OR colored multi-series) */}
        {referenceSeries.map((series, idx) => {
          if (!series.data || series.data.length < 2) return null;
          const validData = series.data.filter(p => Number.isFinite(p.y));
          if (validData.length < 2) return null;
          
          const isMarkedReview = showCorrectAnswers && markingData !== undefined;
          const hasExplicitColor = !!series.color && !series.color.includes('var(--');
          
          // Multi-series with explicit colors: render in full color (not ghost)
          // Single/uncolored reference: use ghost style
          const ghostOpacity = isMarkedReview ? 0.05 : hasExplicitColor ? 1 : 0.6;
          const strokeColor = hasExplicitColor 
            ? series.color! 
            : `hsl(var(--muted-foreground) / ${isMarkedReview ? 0.05 : 0.6})`;
          const dashArray = hasExplicitColor ? undefined : "6 4";
          const lineWidth = hasExplicitColor ? 2.5 : 1.5;
          
          return (
            <CurveLayer
              key={`reference-${series.id || idx}`}
              data={validData}
              graphToScreen={graphToScreen}
              stroke={strokeColor}
              strokeWidth={lineWidth}
              strokeDasharray={dashArray}
              opacity={ghostOpacity}
            />
          );
        })}
        
        {/* Legend for multi-series graphs (top-right corner) */}
        {(() => {
          const coloredSeries = referenceSeries.filter(s => 
            s.color && !s.color.includes('var(--') && s.label && s.data && s.data.length >= 2
          );
          if (coloredSeries.length < 2) return null;
          
           const legendX = width - 24;
           const legendY = 20;
          const itemHeight = 20;
          const legendH = coloredSeries.length * itemHeight + 12;
          // Measure approximate max label width
          const maxLabelLen = Math.max(...coloredSeries.map(s => (s.label || '').length));
          const legendW = Math.min(maxLabelLen * 7 + 40, 160);
          
          return (
            <g>
              <rect
                x={legendX - legendW}
                y={legendY}
                width={legendW}
                height={legendH}
                rx={4}
                fill="hsl(var(--background) / 0.85)"
                stroke="hsl(var(--border))"
                strokeWidth={0.5}
              />
              {coloredSeries.map((s, i) => (
                <g key={`legend-${s.id || i}`}>
                  <line
                    x1={legendX - legendW + 8}
                    y1={legendY + 14 + i * itemHeight}
                    x2={legendX - legendW + 28}
                    y2={legendY + 14 + i * itemHeight}
                    stroke={s.color!}
                    strokeWidth={2.5}
                  />
                  <text
                    x={legendX - legendW + 34}
                    y={legendY + 18 + i * itemHeight}
                    fill="hsl(var(--foreground))"
                    fontSize={11}
                    fontFamily="inherit"
                  >
                    {s.label}
                  </text>
                </g>
              ))}
            </g>
          );
        })()}
        
        {/* Expected answer curve in review mode - RED/GREEN based on marking status */}
        {showCorrectAnswers && expectedCurveSeries.map((series, idx) => {
          if (!series.data || series.data.length < 2) return null;
          const validData = series.data.filter(p => Number.isFinite(p.y));
          if (validData.length < 2) return null;
          
          // ============================================================
          // MARKING STATE SWITCH (Audit v5 Fix #1)
          // ============================================================
          const isMarked = markingData !== undefined;
          const isCorrect = markingData?.totalScore !== undefined && markingData?.totalMarks !== undefined
            ? markingData.totalScore >= markingData.totalMarks * 0.8 // 80% threshold
            : null;
          
          // Color selection: Green if correct or ungraded, Red if incorrect
          const strokeColor = isMarked && isCorrect === false
            ? 'hsl(0, 84%, 60%)' // RED for incorrect
            : 'hsl(142, 76%, 36%)'; // GREEN for correct or ungraded review
          
          // ============================================================
          // ALIGNMENT FIX: Perfect overlap detection
          // ============================================================
          // Check if student's curved spline or segments closely match the expected curve.
          // If ≥80% correct, merge into a single "glow" line to confirm perfect alignment.
          const isPerfectMatch = isMarked && isCorrect === true;
          
          return (
            <React.Fragment key={`expected-${series.id || idx}`}>
              {/* Glow effect for perfect matches - wider, semi-transparent halo */}
              {isPerfectMatch && (
                <CurveLayer
                  data={validData}
                  graphToScreen={graphToScreen}
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={8}
                  opacity={0.25}
                />
              )}
              {/* Main answer curve */}
              <CurveLayer
                data={validData}
                graphToScreen={graphToScreen}
                stroke={strokeColor}
                strokeWidth={isPerfectMatch ? 4 : 3}
                strokeDasharray={undefined} // CRITICAL: NO dash - SOLID line for answers
              />
            </React.Fragment>
          );
        })}
        
        {/* Formula-based correct answer curve — always draw after submit if markingFormula is available */}
        {showCorrectAnswers && markingData && (markingData as any).markingFormula && expectedCurveSeries.length === 0 && (() => {
          const formula = (markingData as any).markingFormula;
          const branches = generateCurveFromFormula(formula, domainX, 500);
          return branches.map((branch, idx) => {
            const validData = branch.data.filter(p => Number.isFinite(p.y));
            if (validData.length < 2) return null;
            return (
              <CurveLayer
                key={`formula-curve-${idx}`}
                data={validData}
                graphToScreen={graphToScreen}
                stroke="#22c55e"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                opacity={0.85}
              />
            );
          });
        })()}
        
        {/* In review mode: color by score. Before submit: blue. */}
        {curvedLineData && (() => {
          if (showCorrectAnswers && markingData) {
            // Determine line color by score
            const scoreRatio = markingData.totalMarks > 0 
              ? markingData.totalScore / markingData.totalMarks 
              : 0;
            const lineColor = scoreRatio >= 1 ? '#22c55e' : scoreRatio >= 0.5 ? '#f97316' : '#ef4444';
            const isPerfectMatch = scoreRatio >= 0.8;
            // Hide student line ONLY for perfect match (glow line replaces it)
            if (isPerfectMatch) return null;
            return (
              <CurveLayer
                data={curvedLineData}
                graphToScreen={graphToScreen}
                stroke={lineColor}
                strokeWidth={2.5}
              />
            );
          }
          return (
            <CurveLayer
              data={curvedLineData}
              graphToScreen={graphToScreen}
              stroke="#3b82f6"
              strokeWidth={2}
            />
          );
        })()}
        
        {/* Annotation layer (subject-aware labels, intercepts, region shading) */}
        {config.annotations && config.annotations.length > 0 && (
          <AnnotationLayer
            annotations={config.annotations}
            graphToScreen={graphToScreen}
            referenceSeries={referenceSeries}
            subjectColor={subjectColor}
            visibleDomain={visibleDomain}
            showAnswers={showCorrectAnswers}
          />
        )}
        
        {/* Line segments */}
        <g className="segments-layer">
          {segments.map((seg) => {
            const from = graphToScreen(seg.from.x, seg.from.y);
            const to = graphToScreen(seg.to.x, seg.to.y);
            
            // Skip if coordinates are invalid (prevents NaN errors)
            if (!Number.isFinite(from.x) || !Number.isFinite(from.y) || 
                !Number.isFinite(to.x) || !Number.isFinite(to.y)) {
              return null;
            }
            
            // Check if this segment is part of an angle measurement
            const isInAngleMeasurement = angleMeasurements.some(
              m => m.segmentId1 === seg.id || m.segmentId2 === seg.id
            );
            const isHighlighted = selectedSegmentIds.includes(seg.id) || isInAngleMeasurement;
            
            // In review mode, color segments by score
            let segmentColor: string;
            if (showCorrectAnswers && markingData) {
              const scoreRatio = markingData.totalMarks > 0 
                ? markingData.totalScore / markingData.totalMarks 
                : 0;
              segmentColor = scoreRatio >= 1 ? '#22c55e' : scoreRatio >= 0.5 ? '#f97316' : '#ef4444';
            } else {
              segmentColor = isHighlighted ? '#f97316' : '#3b82f6';
            }
            
            const isClickable = eraseMode || joinMode === 'angle';
            
            // Handler for segment tap/click
            const handleSegmentTap = (e: React.PointerEvent | React.MouseEvent) => {
              if (!isClickable || !onSegmentClick) return;
              e.stopPropagation();
              e.preventDefault();
              onSegmentClick(seg.id);
            };
            
            // Common props for hit area
            const hitAreaProps = {
              stroke: 'transparent',
              strokeWidth: 20, // Wider hit area for touch
              fill: 'none',
              style: { cursor: isClickable ? 'pointer' : 'default' },
              onPointerUp: handleSegmentTap,
              pointerEvents: 'stroke' as const,
            };
            
            if (seg.mode === 'curved' && seg.controlPoint) {
              const cp = graphToScreen(seg.controlPoint.x, seg.controlPoint.y);
              const pathD = `M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`;
              return (
                <g key={seg.id}>
                  {/* Hit area */}
                  <path d={pathD} {...hitAreaProps} />
                  {/* Visible line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={segmentColor}
                    strokeWidth={4}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                </g>
              );
            }
            
            if (seg.mode === 'curved') {
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const bulge = length * 0.2;
              const perpX = length > 0 ? -dy / length * bulge : 0;
              const perpY = length > 0 ? dx / length * bulge : 0;
              const pathD = `M ${from.x} ${from.y} Q ${midX + perpX} ${midY + perpY} ${to.x} ${to.y}`;
              
              return (
                <g key={seg.id}>
                  {/* Hit area */}
                  <path d={pathD} {...hitAreaProps} />
                  {/* Visible line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={segmentColor}
                    strokeWidth={4}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                </g>
              );
            }
            
            // Straight line
            return (
              <g key={seg.id}>
                {/* Hit area */}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  {...hitAreaProps}
                />
                {/* Visible line */}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={segmentColor}
                  strokeWidth={4}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </g>
        
        {/* Bézier control handles - faint in auto mode, solid in manual mode */}
        {(curveMode === 'manual' || curveMode === 'auto') && !readOnly && segments.filter(s => s.mode === 'curved').map((seg) => {
          const cp = draggingControlHandle?.segmentId === seg.id && controlHandlePosition
            ? controlHandlePosition
            : seg.controlPoint;
          if (!cp) {
            // In auto mode, generate a default control point for display
            if (curveMode === 'auto') {
              const midX = (seg.from.x + seg.to.x) / 2;
              const midY = (seg.from.y + seg.to.y) / 2;
              const dx = seg.to.x - seg.from.x;
              const dy = seg.to.y - seg.from.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const bulge = length * 0.2;
              const perpX = length > 0 ? -dy / length * bulge : 0;
              const perpY = length > 0 ? dx / length * bulge : 0;
              const autoCP = { x: midX + perpX, y: midY + perpY };
              const from = graphToScreen(seg.from.x, seg.from.y);
              const to = graphToScreen(seg.to.x, seg.to.y);
              const cpScreen = graphToScreen(autoCP.x, autoCP.y);
              if (!Number.isFinite(cpScreen.x) || !Number.isFinite(cpScreen.y)) return null;
              
              const handleOpacity = 0.3; // Faint in auto mode
              return (
                <g key={`handle-${seg.id}`}>
                  <line x1={from.x} y1={from.y} x2={cpScreen.x} y2={cpScreen.y}
                    stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" opacity={handleOpacity * 0.6} pointerEvents="none" />
                  <line x1={to.x} y1={to.y} x2={cpScreen.x} y2={cpScreen.y}
                    stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" opacity={handleOpacity * 0.6} pointerEvents="none" />
                  <circle cx={cpScreen.x} cy={cpScreen.y} r={20} fill="transparent"
                    style={{ cursor: 'grab', touchAction: 'none' }} pointerEvents="all"
                    onPointerDown={(e) => {
                      // Auto-switch to manual when dragging a handle in auto mode
                      handleControlHandlePointerDown(seg.id, e);
                    }}
                    onPointerMove={handleControlHandlePointerMove}
                    onPointerUp={handleControlHandlePointerUp}
                  />
                  <circle cx={cpScreen.x} cy={cpScreen.y} r={5}
                    fill="hsl(var(--muted))" stroke="hsl(var(--muted-foreground))" strokeWidth={1} opacity={handleOpacity} pointerEvents="none" />
                </g>
              );
            }
            return null;
          }
          
          const from = graphToScreen(seg.from.x, seg.from.y);
          const to = graphToScreen(seg.to.x, seg.to.y);
          const cpScreen = graphToScreen(cp.x, cp.y);
          
          if (!Number.isFinite(cpScreen.x) || !Number.isFinite(cpScreen.y)) return null;
          
          const isManual = curveMode === 'manual';
          const handleOpacity = isManual ? 1 : 0.3;
          const handleRadius = isManual ? 6 : 5;
          
          return (
            <g key={`handle-${seg.id}`}>
              <line x1={from.x} y1={from.y} x2={cpScreen.x} y2={cpScreen.y}
                stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" opacity={handleOpacity * 0.5} pointerEvents="none" />
              <line x1={to.x} y1={to.y} x2={cpScreen.x} y2={cpScreen.y}
                stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" opacity={handleOpacity * 0.5} pointerEvents="none" />
              <circle cx={cpScreen.x} cy={cpScreen.y} r={20} fill="transparent"
                style={{ cursor: 'grab', touchAction: 'none' }} pointerEvents="all"
                onPointerDown={(e) => handleControlHandlePointerDown(seg.id, e)}
                onPointerMove={handleControlHandlePointerMove}
                onPointerUp={handleControlHandlePointerUp}
              />
              <circle cx={cpScreen.x} cy={cpScreen.y} r={handleRadius}
                fill={isManual ? "hsl(var(--background))" : "hsl(var(--muted))"}
                stroke={isManual ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                strokeWidth={isManual ? 2 : 1} opacity={handleOpacity} pointerEvents="none" />
            </g>
          );
        })}
        
        {/* Missed expected points (RED - answer points the student missed) */}
        {showCorrectAnswers && missedPoints.map((point, idx) => {
          const screen = graphToScreen(point.x, point.y);
          if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;
          const coordLabel = `(${point.x}, ${point.y})`;
          return (
            <g key={`missed-${idx}`}>
              {/* RED filled dot — missed expected point */}
              <circle
                cx={screen.x}
                cy={screen.y}
                r={7}
                fill="#ef4444"
                stroke="white"
                strokeWidth={2}
                opacity={0.9}
              />
              {/* Coordinate label */}
              <rect
                x={screen.x + 10}
                y={screen.y - 20}
                width={coordLabel.length * 7 + 8}
                height={18}
                rx={3}
                fill="#ef4444"
                fillOpacity={0.15}
                stroke="#ef4444"
                strokeWidth={0.5}
              />
              <text
                x={screen.x + 14}
                y={screen.y - 8}
                fontSize={11}
                fontWeight={600}
                fill="#ef4444"
                fontFamily="system-ui, sans-serif"
              >
                {coordLabel}
              </text>
            </g>
          );
        })}
        
        {/* Student points */}
        <g className="points-layer">
          {studentPoints.map((point, idx) => {
            const status = getPointStatus(point);
            const isSelected = isPointSelected(point);
            const isDragging = draggingPointId === point.id;
            const isInDragMode = activeDragPointId === point.id;
            
            // Use dragging position if this point is being dragged
            let screenPos: { x: number; y: number };
            if (isDragging && draggingPosition) {
              screenPos = graphToScreen(draggingPosition.x, draggingPosition.y);
            } else {
              screenPos = graphToScreen(point.x, point.y);
            }
            
            // Skip rendering if coordinates are invalid (prevents NaN errors)
            if (!Number.isFinite(screenPos.x) || !Number.isFinite(screenPos.y)) {
              return null;
            }
            
            // Determine fill color
            let fillColor = subjectColor;
            if (showCorrectAnswers) {
              if (status === 'correct') fillColor = '#22c55e'; // Green = student correct
              else if (status === 'incorrect') fillColor = '#f97316'; // Orange = student wrong
            }
            
            const visualRadius = isSelected || isDragging || isInDragMode ? 10 : 8;
            const hitRadius = isInDragMode ? 48 : Math.max(visualRadius + 12, 24);
            
            return (
              <g
                key={point.id || `point-${idx}`}
                style={{
                  cursor: readOnly ? 'default' : eraseMode ? 'pointer' : isDragging ? 'grabbing' : isInDragMode ? 'grab' : 'pointer',
                  touchAction: 'none',
                }}
              >
                {/* Hit target */}
                <circle
                  cx={screenPos.x}
                  cy={screenPos.y}
                  r={hitRadius}
                  fill="transparent"
                  pointerEvents="all"
                  onPointerDown={(e) => {
                    if (!readOnly && onPointPointerDown) {
                      e.stopPropagation();
                      onPointPointerDown(point, e);
                    }
                  }}
                  onPointerUp={(e) => {
                    if (!readOnly && onPointPointerUp) {
                      e.stopPropagation();
                      onPointPointerUp(point, e);
                    }
                  }}
                />
                
                {/* Drag mode halo */}
                {isInDragMode && !isDragging && (
                  <circle
                    cx={screenPos.x}
                    cy={screenPos.y}
                    r={visualRadius + 8}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    opacity={0.6}
                    className="animate-pulse"
                  />
                )}
                
                {/* Drag indicator */}
                {isDragging && (
                  <circle
                    cx={screenPos.x}
                    cy={screenPos.y}
                    r={visualRadius + 6}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    opacity={0.8}
                  />
                )}
                
                {/* Selection ring */}
                {isSelected && !isInDragMode && (
                  <circle
                    cx={screenPos.x}
                    cy={screenPos.y}
                    r={visualRadius + 4}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                )}
                
                {/* Point */}
                <circle
                  cx={screenPos.x}
                  cy={screenPos.y}
                  r={visualRadius}
                  fill={fillColor}
                  stroke="white"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
        </g>
        
        {/* Angle measurement labels */}
        {angleMeasurements.map((measurement) => {
          const seg1 = segments.find(s => s.id === measurement.segmentId1);
          const seg2 = segments.find(s => s.id === measurement.segmentId2);
          if (!seg1 || !seg2) return null;
          
          // Find shared vertex
          const points = [seg1.from, seg1.to, seg2.from, seg2.to];
          let vertex: GraphPoint | null = null;
          
          for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
              if (Math.abs(points[i].x - points[j].x) < 0.01 && Math.abs(points[i].y - points[j].y) < 0.01) {
                vertex = points[i];
                break;
              }
            }
            if (vertex) break;
          }
          
          if (!vertex) return null;
          
          const screenVertex = graphToScreen(vertex.x, vertex.y);
          const labelOffset = measurement.labelOffset || { x: 30, y: -30 };
          
          return (
            <g key={measurement.id}>
              {/* Arc at vertex */}
              <circle
                cx={screenVertex.x}
                cy={screenVertex.y}
                r={20}
                fill="none"
                stroke="#f97316"
                strokeWidth={2}
                opacity={0.6}
              />
              
              {/* Angle label */}
              <text
                x={screenVertex.x + labelOffset.x}
                y={screenVertex.y + labelOffset.y}
                fontSize={14}
                fontWeight={600}
                fill="#f97316"
                textAnchor="middle"
                style={{ cursor: eraseMode ? 'pointer' : 'default' }}
                onClick={() => eraseMode && onSegmentClick?.(measurement.id)}
              >
                {measurement.angleDegrees}°
              </text>
            </g>
          );
        })}
      </GraphCanvas>
      
      {/* Freeform drawing overlay - ALWAYS render saved paths, only active for drawing in freeform mode */}
      {(joinMode === 'freeform' || drawnPaths.length > 0) && (
        <div className="absolute inset-0 pointer-events-auto" style={{ zIndex: 10 }}>
          <GraphDrawingCanvas
            containerWidth={width}
            containerHeight={height}
            marginLeft={0}
            marginTop={0}
            marginRight={0}
            marginBottom={0}
            paths={drawnPaths}
            onPathsChange={onDrawnPathsChange || (() => {})}
            readOnly={readOnly}
            active={joinMode === 'freeform'}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            domainX={visibleDomain.domainX}
            domainY={visibleDomain.domainY}
            eraseMode={eraseMode}
          />
        </div>
      )}
      
      {/* Drag tooltip */}
      {draggingPointId && draggingPosition && (
        <div 
          className="absolute pointer-events-none z-50"
          style={{
            left: graphToScreen(draggingPosition.x, draggingPosition.y).x,
            top: graphToScreen(draggingPosition.x, draggingPosition.y).y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-popover text-popover-foreground border rounded px-2 py-1 text-sm shadow-lg font-mono whitespace-nowrap">
            ({draggingPosition.x.toFixed(1)}, {draggingPosition.y.toFixed(1)})
          </div>
        </div>
      )}
    </div>
  );
}

export default GraphCanvasPlot;
