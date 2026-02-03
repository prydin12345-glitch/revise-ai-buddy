import React, { useMemo, useCallback, useState, useRef } from 'react';
import { GraphCanvas, CurveLayer } from './GraphCanvas';
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
  const TAP_THRESHOLD_PX = 10; // Max movement to be considered a tap
  const TAP_THRESHOLD_MS = 300; // Max duration to be considered a tap
  
  // Initialize camera hook
  // NOTE: Camera pan/zoom is ALWAYS enabled when panZoomEnabled is true,
  // even in readOnly mode. readOnly only prevents editing (adding points, etc.)
  const {
    camera,
    visibleDomain,
    graphToScreen,
    screenToGraph,
    handlers: cameraHandlers,
    isPanning,
    resetCamera,
  } = useGraphCamera({
    initialDomainX: domainX,
    initialDomainY: domainY,
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
    
    const result = markingData.perPointResults.find(r => 
      r.studentPoint?.x === point.x && r.studentPoint?.y === point.y
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
  
  // Generate curved line data when in curved mode
  const curvedLineData = useMemo(() => {
    if (joinMode !== 'curved' || studentPoints.length < 3) return null;
    return catmullRomSpline(studentPoints);
  }, [joinMode, studentPoints]);
  
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
  
  if (width <= 0 || height <= 0) return null;
  
  return (
    <div 
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
      >
        {/* Reference curves */}
        {referenceSeries.map((series, idx) => {
          if (!series.data || series.data.length < 2) return null;
          const validData = series.data.filter(p => Number.isFinite(p.y));
          if (validData.length < 2) return null;
          
          return (
            <CurveLayer
              key={`reference-${series.id || idx}`}
              data={validData}
              graphToScreen={graphToScreen}
              stroke={series.color || 'hsl(var(--primary))'}
              strokeWidth={2}
              strokeDasharray={series.lineStyle === 'dashed' ? '5 5' : series.lineStyle === 'dotted' ? '2 2' : undefined}
            />
          );
        })}
        
        {/* Expected answer curve in review mode */}
        {showCorrectAnswers && expectedCurveSeries.map((series, idx) => {
          if (!series.data || series.data.length < 2) return null;
          const validData = series.data.filter(p => Number.isFinite(p.y));
          if (validData.length < 2) return null;
          
          return (
            <CurveLayer
              key={`expected-${series.id || idx}`}
              data={validData}
              graphToScreen={graphToScreen}
              stroke="hsl(var(--success, 142 76% 36%))"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          );
        })}
        
        {/* Curved mode spline through all points */}
        {curvedLineData && (
          <CurveLayer
            data={curvedLineData}
            graphToScreen={graphToScreen}
            stroke="#3b82f6"
            strokeWidth={2}
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
            const segmentColor = isHighlighted ? '#f97316' : '#3b82f6'; // Orange when selected/in measurement
            
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
        
        {/* Missed expected points (correct answer indicators) */}
        {showCorrectAnswers && missedPoints.map((point, idx) => {
          const screen = graphToScreen(point.x, point.y);
          return (
            <circle
              key={`missed-${idx}`}
              cx={screen.x}
              cy={screen.y}
              r={8}
              fill="transparent"
              stroke="hsl(var(--success, 142 76% 36%))"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
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
              if (status === 'correct') fillColor = 'hsl(var(--success, 142 76% 36%))';
              else if (status === 'incorrect') fillColor = 'hsl(var(--destructive))';
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
      
      {/* Freeform drawing overlay */}
      {joinMode === 'freeform' && onDrawnPathsChange && (
        <div className="absolute inset-0 pointer-events-auto" style={{ zIndex: 10 }}>
          <GraphDrawingCanvas
            containerWidth={width}
            containerHeight={height}
            marginLeft={0}
            marginTop={0}
            marginRight={0}
            marginBottom={0}
            paths={drawnPaths}
            onPathsChange={onDrawnPathsChange}
            readOnly={readOnly}
            active={true}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            domainX={visibleDomain.domainX}
            domainY={visibleDomain.domainY}
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
