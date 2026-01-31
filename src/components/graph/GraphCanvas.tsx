import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { CameraState } from './types';

// ============= Sub-components =============

interface GridLayerProps {
  width: number;
  height: number;
  graphToScreen: (x: number, y: number) => { x: number; y: number };
  visibleDomain: { domainX: [number, number]; domainY: [number, number] };
  scale: number;
}

/**
 * Renders a dynamic grid that adapts to zoom level.
 * Shows major and minor grid lines with automatic tick spacing.
 */
function GridLayer({ width, height, graphToScreen, visibleDomain, scale }: GridLayerProps) {
  // Calculate appropriate grid spacing based on scale
  // We want roughly 5-10 major grid lines visible
  const calculateGridSpacing = useCallback((range: number): { major: number; minor: number } => {
    const targetMajorLines = 8;
    const rawStep = range / targetMajorLines;
    
    // Round to "nice" numbers: 1, 2, 5, 10, 20, 50, etc.
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    
    let niceStep: number;
    if (normalized <= 1.5) niceStep = 1;
    else if (normalized <= 3) niceStep = 2;
    else if (normalized <= 7) niceStep = 5;
    else niceStep = 10;
    
    const major = niceStep * magnitude;
    const minor = major / 5;
    
    return { major, minor };
  }, []);
  
  const { domainX, domainY } = visibleDomain;
  const rangeX = domainX[1] - domainX[0];
  const rangeY = domainY[1] - domainY[0];
  
  const spacingX = calculateGridSpacing(rangeX);
  const spacingY = calculateGridSpacing(rangeY);
  
  // Generate grid lines
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    
    // Minor vertical lines
    const minorStartX = Math.floor(domainX[0] / spacingX.minor) * spacingX.minor;
    for (let x = minorStartX; x <= domainX[1]; x += spacingX.minor) {
      const screenX = graphToScreen(x, 0).x;
      if (screenX >= 0 && screenX <= width) {
        const isMajor = Math.abs(x % spacingX.major) < spacingX.minor / 2;
        if (!isMajor) {
          lines.push(
            <line
              key={`v-minor-${x.toFixed(6)}`}
              x1={screenX}
              y1={0}
              x2={screenX}
              y2={height}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeOpacity={0.3}
            />
          );
        }
      }
    }
    
    // Major vertical lines
    const majorStartX = Math.floor(domainX[0] / spacingX.major) * spacingX.major;
    for (let x = majorStartX; x <= domainX[1]; x += spacingX.major) {
      const screenX = graphToScreen(x, 0).x;
      if (screenX >= 0 && screenX <= width) {
        lines.push(
          <line
            key={`v-major-${x.toFixed(6)}`}
            x1={screenX}
            y1={0}
            x2={screenX}
            y2={height}
            stroke="hsl(var(--border))"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        );
      }
    }
    
    // Minor horizontal lines
    const minorStartY = Math.floor(domainY[0] / spacingY.minor) * spacingY.minor;
    for (let y = minorStartY; y <= domainY[1]; y += spacingY.minor) {
      const screenY = graphToScreen(0, y).y;
      if (screenY >= 0 && screenY <= height) {
        const isMajor = Math.abs(y % spacingY.major) < spacingY.minor / 2;
        if (!isMajor) {
          lines.push(
            <line
              key={`h-minor-${y.toFixed(6)}`}
              x1={0}
              y1={screenY}
              x2={width}
              y2={screenY}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeOpacity={0.3}
            />
          );
        }
      }
    }
    
    // Major horizontal lines
    const majorStartY = Math.floor(domainY[0] / spacingY.major) * spacingY.major;
    for (let y = majorStartY; y <= domainY[1]; y += spacingY.major) {
      const screenY = graphToScreen(0, y).y;
      if (screenY >= 0 && screenY <= height) {
        lines.push(
          <line
            key={`h-major-${y.toFixed(6)}`}
            x1={0}
            y1={screenY}
            x2={width}
            y2={screenY}
            stroke="hsl(var(--border))"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        );
      }
    }
    
    return lines;
  }, [domainX, domainY, spacingX, spacingY, graphToScreen, width, height]);
  
  return <g className="grid-layer">{gridLines}</g>;
}

interface AxisLayerProps {
  width: number;
  height: number;
  graphToScreen: (x: number, y: number) => { x: number; y: number };
  visibleDomain: { domainX: [number, number]; domainY: [number, number] };
  scale: number;
}

/**
 * Renders X and Y axes with tick labels.
 */
function AxisLayer({ width, height, graphToScreen, visibleDomain, scale }: AxisLayerProps) {
  const { domainX, domainY } = visibleDomain;
  
  // Calculate tick spacing
  const calculateTickSpacing = useCallback((range: number): number => {
    const targetTicks = 8;
    const rawStep = range / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    
    let niceStep: number;
    if (normalized <= 1.5) niceStep = 1;
    else if (normalized <= 3) niceStep = 2;
    else if (normalized <= 7) niceStep = 5;
    else niceStep = 10;
    
    return niceStep * magnitude;
  }, []);
  
  const tickSpacingX = calculateTickSpacing(domainX[1] - domainX[0]);
  const tickSpacingY = calculateTickSpacing(domainY[1] - domainY[0]);
  
  // Position of axes (at 0, or clamped to edges if 0 is not visible)
  const origin = graphToScreen(0, 0);
  const xAxisY = Math.max(20, Math.min(height - 30, origin.y));
  const yAxisX = Math.max(40, Math.min(width - 20, origin.x));
  
  // Format tick label (remove unnecessary decimals)
  const formatTick = (value: number): string => {
    if (Math.abs(value) < 1e-10) return '0';
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(1).replace(/\.0$/, '');
  };
  
  // Generate X axis ticks
  const xTicks = useMemo(() => {
    const ticks: React.ReactNode[] = [];
    const startX = Math.floor(domainX[0] / tickSpacingX) * tickSpacingX;
    
    for (let x = startX; x <= domainX[1]; x += tickSpacingX) {
      const screenX = graphToScreen(x, 0).x;
      if (screenX >= 30 && screenX <= width - 10) {
        ticks.push(
          <g key={`x-tick-${x.toFixed(6)}`}>
            <line
              x1={screenX}
              y1={xAxisY - 4}
              x2={screenX}
              y2={xAxisY + 4}
              stroke="hsl(var(--foreground))"
              strokeWidth={1}
            />
            <text
              x={screenX}
              y={xAxisY + 16}
              textAnchor="middle"
              fontSize={11}
              fill="hsl(var(--foreground))"
              fontFamily="system-ui, sans-serif"
            >
              {formatTick(x)}
            </text>
          </g>
        );
      }
    }
    
    return ticks;
  }, [domainX, tickSpacingX, graphToScreen, width, xAxisY]);
  
  // Generate Y axis ticks
  const yTicks = useMemo(() => {
    const ticks: React.ReactNode[] = [];
    const startY = Math.floor(domainY[0] / tickSpacingY) * tickSpacingY;
    
    for (let y = startY; y <= domainY[1]; y += tickSpacingY) {
      const screenY = graphToScreen(0, y).y;
      if (screenY >= 10 && screenY <= height - 20) {
        ticks.push(
          <g key={`y-tick-${y.toFixed(6)}`}>
            <line
              x1={yAxisX - 4}
              y1={screenY}
              x2={yAxisX + 4}
              y2={screenY}
              stroke="hsl(var(--foreground))"
              strokeWidth={1}
            />
            <text
              x={yAxisX - 8}
              y={screenY + 4}
              textAnchor="end"
              fontSize={11}
              fill="hsl(var(--foreground))"
              fontFamily="system-ui, sans-serif"
            >
              {formatTick(y)}
            </text>
          </g>
        );
      }
    }
    
    return ticks;
  }, [domainY, tickSpacingY, graphToScreen, height, yAxisX]);
  
  return (
    <g className="axis-layer">
      {/* X axis line */}
      <line
        x1={0}
        y1={xAxisY}
        x2={width}
        y2={xAxisY}
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
      />
      
      {/* Y axis line */}
      <line
        x1={yAxisX}
        y1={0}
        x2={yAxisX}
        y2={height}
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
      />
      
      {/* Axis labels */}
      <text
        x={width - 10}
        y={xAxisY - 8}
        textAnchor="end"
        fontSize={12}
        fontWeight={500}
        fill="hsl(var(--foreground))"
      >
        x
      </text>
      <text
        x={yAxisX + 8}
        y={15}
        textAnchor="start"
        fontSize={12}
        fontWeight={500}
        fill="hsl(var(--foreground))"
      >
        y
      </text>
      
      {xTicks}
      {yTicks}
    </g>
  );
}

// ============= Main GraphCanvas Component =============

export interface GraphCanvasProps {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Camera state for the viewport */
  camera: CameraState;
  /** Coordinate conversion functions */
  graphToScreen: (x: number, y: number) => { x: number; y: number };
  screenToGraph: (x: number, y: number) => { x: number; y: number };
  /** Visible domain based on camera */
  visibleDomain: { domainX: [number, number]; domainY: [number, number] };
  /** Event handlers for pan/zoom (attach to container) */
  cameraHandlers?: {
    onWheel: (e: React.WheelEvent) => void;
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  /** Whether pan/zoom is enabled */
  interactionEnabled?: boolean;
  /** Whether currently panning */
  isPanning?: boolean;
  /** Additional class names */
  className?: string;
  /** Children to render inside the SVG (curves, points, etc.) */
  children?: React.ReactNode;
  /** Callback when user clicks on the canvas (provides graph coordinates) */
  onClick?: (graphX: number, graphY: number, e: React.PointerEvent) => void;
  /** Whether the canvas is read-only */
  readOnly?: boolean;
  /** Custom cursor */
  cursor?: string;
}

/**
 * GraphCanvas - SVG-based canvas with camera support.
 * 
 * Replaces Recharts ComposedChart with a custom renderer that:
 * - Uses a camera model for pan/zoom
 * - Renders dynamic grid based on zoom level
 * - Provides coordinate conversion functions
 * - Supports layered rendering (grid, axes, curves, points, etc.)
 */
export function GraphCanvas({
  width,
  height,
  camera,
  graphToScreen,
  screenToGraph,
  visibleDomain,
  cameraHandlers,
  interactionEnabled = true,
  isPanning = false,
  className = '',
  children,
  onClick,
  readOnly = false,
  cursor,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Handle click on canvas background
  const handleClick = useCallback((e: React.PointerEvent) => {
    if (readOnly || !onClick) return;
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x: graphX, y: graphY } = screenToGraph(screenX, screenY);
    
    onClick(graphX, graphY, e);
  }, [readOnly, onClick, screenToGraph]);
  
  // Combine handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (interactionEnabled && cameraHandlers) {
      cameraHandlers.onPointerDown(e);
    }
  }, [interactionEnabled, cameraHandlers]);
  
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (interactionEnabled && cameraHandlers) {
      cameraHandlers.onPointerMove(e);
    }
  }, [interactionEnabled, cameraHandlers]);
  
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (interactionEnabled && cameraHandlers) {
      cameraHandlers.onPointerUp(e);
    }
    // Only trigger click if not panning
    if (!isPanning) {
      handleClick(e);
    }
  }, [interactionEnabled, cameraHandlers, isPanning, handleClick]);
  
  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (interactionEnabled && cameraHandlers) {
      cameraHandlers.onPointerCancel(e);
    }
  }, [interactionEnabled, cameraHandlers]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (interactionEnabled && cameraHandlers) {
      cameraHandlers.onWheel(e);
    }
  }, [interactionEnabled, cameraHandlers]);
  
  // Determine cursor
  const effectiveCursor = cursor || (isPanning ? 'grabbing' : interactionEnabled ? 'crosshair' : 'default');
  
  if (width <= 0 || height <= 0) {
    return null;
  }
  
  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className={`graph-canvas ${className}`}
      style={{
        cursor: effectiveCursor,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Background */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="hsl(var(--card))"
      />
      
      {/* Grid layer */}
      <GridLayer
        width={width}
        height={height}
        graphToScreen={graphToScreen}
        visibleDomain={visibleDomain}
        scale={camera.scale}
      />
      
      {/* Axis layer */}
      <AxisLayer
        width={width}
        height={height}
        graphToScreen={graphToScreen}
        visibleDomain={visibleDomain}
        scale={camera.scale}
      />
      
      {/* Custom content (curves, points, segments, etc.) */}
      {children}
    </svg>
  );
}

// ============= Helper Components for Rendering =============

export interface CurveLayerProps {
  /** Array of data points in graph coordinates */
  data: Array<{ x: number; y: number }>;
  /** Coordinate conversion function */
  graphToScreen: (x: number, y: number) => { x: number; y: number };
  /** Stroke color */
  stroke?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Stroke dash array (for dashed lines) */
  strokeDasharray?: string;
  /** Unique key for the curve */
  id?: string;
}

/**
 * Renders a curve from an array of data points.
 */
export function CurveLayer({
  data,
  graphToScreen,
  stroke = 'hsl(var(--primary))',
  strokeWidth = 2,
  strokeDasharray,
  id,
}: CurveLayerProps) {
  // Convert points to screen coordinates and build path
  // Must be called before any early returns to satisfy React hook rules
  const pathD = useMemo(() => {
    if (!data || data.length < 2) return '';
    
    const screenPoints = data
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
      .map(p => graphToScreen(p.x, p.y));
    
    if (screenPoints.length < 2) return '';
    
    // Build SVG path with line segments
    let d = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
    for (let i = 1; i < screenPoints.length; i++) {
      d += ` L ${screenPoints[i].x} ${screenPoints[i].y}`;
    }
    
    return d;
  }, [data, graphToScreen]);
  
  if (!pathD) return null;
  
  return (
    <path
      d={pathD}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export interface PointLayerProps {
  /** Array of points in graph coordinates */
  points: Array<{ x: number; y: number; id?: string }>;
  /** Coordinate conversion function */
  graphToScreen: (x: number, y: number) => { x: number; y: number };
  /** Point radius */
  radius?: number;
  /** Fill color */
  fill?: string;
  /** Stroke color */
  stroke?: string;
  /** Callback when a point is clicked */
  onPointClick?: (point: { x: number; y: number; id?: string }, e: React.PointerEvent) => void;
  /** Callback when pointer down on a point */
  onPointPointerDown?: (point: { x: number; y: number; id?: string }, e: React.PointerEvent) => void;
  /** ID of the currently selected point */
  selectedPointId?: string | null;
  /** ID of the point in drag mode */
  dragModePointId?: string | null;
  /** ID of the point being dragged */
  draggingPointId?: string | null;
  /** Current dragging position (screen coords) */
  draggingPosition?: { x: number; y: number } | null;
  /** Whether points are read-only */
  readOnly?: boolean;
}

/**
 * Renders points on the graph.
 */
export function PointLayer({
  points,
  graphToScreen,
  radius = 6,
  fill = 'hsl(var(--primary))',
  stroke = 'hsl(var(--primary-foreground))',
  onPointClick,
  onPointPointerDown,
  selectedPointId,
  dragModePointId,
  draggingPointId,
  draggingPosition,
  readOnly = false,
}: PointLayerProps) {
  return (
    <g className="points-layer">
      {points.map((point, idx) => {
        const isDragging = draggingPointId === point.id;
        const isInDragMode = dragModePointId === point.id;
        const isSelected = selectedPointId === point.id;
        
        // Use dragging position if this point is being dragged
        let screenPos: { x: number; y: number };
        if (isDragging && draggingPosition) {
          screenPos = draggingPosition;
        } else {
          screenPos = graphToScreen(point.x, point.y);
        }
        
        const displayRadius = isSelected || isDragging || isInDragMode ? radius + 2 : radius;
        const hitRadius = Math.max(displayRadius + 12, 24);
        
        return (
          <g
            key={point.id || `point-${idx}`}
            style={{
              cursor: readOnly ? 'default' : isInDragMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
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
            />
            
            {/* Drag mode halo */}
            {isInDragMode && !isDragging && (
              <circle
                cx={screenPos.x}
                cy={screenPos.y}
                r={displayRadius + 8}
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
                r={displayRadius + 6}
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
                r={displayRadius + 4}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
            )}
            
            {/* Point */}
            <circle
              cx={screenPos.x}
              cy={screenPos.y}
              r={displayRadius}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </g>
  );
}

export default GraphCanvas;
