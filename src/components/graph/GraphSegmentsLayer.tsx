import React, { useState, useCallback, useRef } from 'react';
import { GraphPoint, LineSegment } from './types';
import { toast } from 'sonner';

/**
 * Props for the GraphSegmentsLayer component.
 * This component renders line segments and curves on a coordinate graph as an SVG overlay.
 */
interface GraphSegmentsLayerProps {
  /** Array of line segments to render */
  segments: LineSegment[];
  /** Callback when segments are updated (for control point dragging) */
  onSegmentsChange?: (segments: LineSegment[]) => void;
  /** Stroke color for the segments */
  stroke?: string;
  /** Stroke width for the segments */
  strokeWidth?: number;
  /** Recharts x-axis scale function (if available) */
  xScale?: (value: number) => number;
  /** Recharts y-axis scale function (if available) */
  yScale?: (value: number) => number;
  /** Container width in pixels */
  containerWidth?: number;
  /** Container height in pixels */
  containerHeight?: number;
  /** Left margin of the chart area */
  marginLeft?: number;
  /** Right margin of the chart area */
  marginRight?: number;
  /** Top margin of the chart area */
  marginTop?: number;
  /** Bottom margin of the chart area */
  marginBottom?: number;
  /** X-axis domain [min, max] */
  domainX?: [number, number];
  /** Y-axis domain [min, max] */
  domainY?: [number, number];
  /** Enable debug mode to show coordinate labels */
  debug?: boolean;
  /** Read-only mode (no dragging) */
  readOnly?: boolean;
  /** Selected segment IDs for angle measurement */
  selectedSegmentIds?: string[];
  /** Callback when segment selection changes */
  onSegmentSelect?: (segmentId: string) => void;
  /** Callback to notify parent that pointer started on a segment (prevents container from clearing selection) */
  onPointerStartedOnSegment?: () => void;
}

/**
 * Generates a quadratic bezier curve path with a custom control point.
 */
function makeQuadraticCurvePathWithControl(
  x1: number, y1: number,
  x2: number, y2: number,
  controlX: number, controlY: number
): string {
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Calculate default control point for a curve (perpendicular offset from midpoint).
 */
function getDefaultControlPoint(
  x1: number, y1: number,
  x2: number, y2: number
): { x: number; y: number } {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist === 0) return { x: midX, y: midY };
  
  // 20% perpendicular offset
  const curveAmount = dist * 0.2;
  const perpX = -dy / dist * curveAmount;
  const perpY = dx / dist * curveAmount;
  
  return { x: midX + perpX, y: midY + perpY };
}

/**
 * GraphSegmentsLayer renders line segments on a coordinate graph.
 * 
 * It renders ONLY the segments that are explicitly provided - no auto-joining.
 * Each segment specifies its own mode (straight or curved).
 * Curved segments can have their control point dragged to adjust the curve.
 */
export function GraphSegmentsLayer({
  segments,
  onSegmentsChange,
  stroke = 'hsl(var(--primary))',
  strokeWidth = 2,
  xScale,
  yScale,
  containerWidth = 400,
  containerHeight = 300,
  marginLeft = 60,
  marginRight = 20,
  marginTop = 20,
  marginBottom = 40,
  domainX = [0, 10],
  domainY = [0, 10],
  debug = false,
  readOnly = false,
  selectedSegmentIds = [],
  onSegmentSelect,
  onPointerStartedOnSegment,
}: GraphSegmentsLayerProps) {
  // Track which segment is being dragged
  const [draggingSegmentId, setDraggingSegmentId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate plot area dimensions
  const plotWidth = containerWidth - marginLeft - marginRight;
  const plotHeight = containerHeight - marginTop - marginBottom;

  // Check if we need to offset scales (Recharts sometimes returns values relative to plot area)
  const xScaleNeedsOffset = xScale ? xScale(domainX[0]) < marginLeft : false;
  const yScaleNeedsOffset = yScale ? yScale(domainY[0]) < marginTop : false;

  /**
   * Convert data X coordinate to pixel X coordinate.
   */
  const dataToPixelX = useCallback((dataX: number): number => {
    if (xScale) {
      const px = xScale(dataX);
      return xScaleNeedsOffset ? px + marginLeft : px;
    }
    const denom = domainX[1] - domainX[0] || 1;
    const fraction = (dataX - domainX[0]) / denom;
    return marginLeft + fraction * plotWidth;
  }, [xScale, xScaleNeedsOffset, marginLeft, domainX, plotWidth]);

  /**
   * Convert data Y coordinate to pixel Y coordinate.
   */
  const dataToPixelY = useCallback((dataY: number): number => {
    if (yScale) {
      const py = yScale(dataY);
      return yScaleNeedsOffset ? py + marginTop : py;
    }
    const denom = domainY[1] - domainY[0] || 1;
    const fraction = (dataY - domainY[0]) / denom;
    return marginTop + (1 - fraction) * plotHeight;
  }, [yScale, yScaleNeedsOffset, marginTop, domainY, plotHeight]);

  /**
   * Convert pixel X to data X.
   */
  const pixelToDataX = useCallback((pixelX: number): number => {
    const denom = domainX[1] - domainX[0] || 1;
    const fraction = (pixelX - marginLeft) / plotWidth;
    return domainX[0] + fraction * denom;
  }, [marginLeft, plotWidth, domainX]);

  /**
   * Convert pixel Y to data Y.
   */
  const pixelToDataY = useCallback((pixelY: number): number => {
    const denom = domainY[1] - domainY[0] || 1;
    const fraction = 1 - (pixelY - marginTop) / plotHeight;
    return domainY[0] + fraction * denom;
  }, [marginTop, plotHeight, domainY]);

  /**
   * Handle pointer down on control handle.
   */
  const handleControlPointerDown = useCallback((segId: string, e: React.PointerEvent) => {
    if (readOnly || !onSegmentsChange) return;
    e.stopPropagation();
    e.preventDefault();
    setDraggingSegmentId(segId);
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }, [readOnly, onSegmentsChange]);

  /**
   * Handle pointer move for dragging control point.
   */
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingSegmentId || !onSegmentsChange || !svgRef.current) return;
    e.preventDefault();
    
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    
    // Convert to data coordinates
    const dataX = pixelToDataX(pixelX);
    const dataY = pixelToDataY(pixelY);
    
    // Update the segment's control point
    const updatedSegments = segments.map(seg => {
      if (seg.id === draggingSegmentId && seg.mode === 'curved') {
        return { ...seg, controlPoint: { x: dataX, y: dataY } };
      }
      return seg;
    });
    
    onSegmentsChange(updatedSegments);
  }, [draggingSegmentId, onSegmentsChange, segments, pixelToDataX, pixelToDataY]);

  /**
   * Handle pointer up to stop dragging.
   */
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingSegmentId) {
      e.preventDefault();
      setDraggingSegmentId(null);
    }
  }, [draggingSegmentId]);

  if (!segments || segments.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        pointerEvents: draggingSegmentId ? 'auto' : 'none',
        overflow: 'visible',
        touchAction: 'none',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Render each segment */}
      {segments.map((seg) => {
        const x1 = dataToPixelX(seg.from.x);
        const y1 = dataToPixelY(seg.from.y);
        const x2 = dataToPixelX(seg.to.x);
        const y2 = dataToPixelY(seg.to.y);

        // Skip invalid coordinates
        if (!Number.isFinite(x1) || !Number.isFinite(y1) || 
            !Number.isFinite(x2) || !Number.isFinite(y2)) {
          return null;
        }

        const isCurved = seg.mode === 'curved';

        // Calculate control point in pixels
        let controlPixelX: number;
        let controlPixelY: number;
        
        if (isCurved) {
          if (seg.controlPoint) {
            // Use stored control point
            controlPixelX = dataToPixelX(seg.controlPoint.x);
            controlPixelY = dataToPixelY(seg.controlPoint.y);
          } else {
            // Calculate default
            const defaultCtrl = getDefaultControlPoint(x1, y1, x2, y2);
            controlPixelX = defaultCtrl.x;
            controlPixelY = defaultCtrl.y;
          }
        }

        const isSelected = selectedSegmentIds.includes(seg.id);
        const segmentStroke = isSelected ? 'hsl(var(--warning))' : stroke;
        const segmentStrokeWidth = isSelected ? strokeWidth + 2 : strokeWidth;

        // Hit target stroke width for touch devices (generous ~16px)
        const hitTargetWidth = 16;

        // Mark pointer started on segment (on PointerDown) - prevents container from clearing selection
        const handleSegmentPointerDown = (e: React.PointerEvent) => {
          if (!onSegmentSelect) return;
          e.stopPropagation();
          e.preventDefault();
          // Set the guard ref immediately on down - this prevents container's pointerUp from clearing
          onPointerStartedOnSegment?.();
        };

        // Perform selection on PointerUp (not click) to avoid iOS double-trigger issues
        const handleSegmentPointerUp = (e: React.PointerEvent) => {
          if (!onSegmentSelect) return;
          e.stopPropagation();
          e.preventDefault();
          onSegmentSelect(seg.id);
        };

        return (
          <g key={seg.id}>
            {isCurved ? (
              <>
                {/* Invisible hit target for curved segment */}
                {onSegmentSelect && (
                  <path
                    d={makeQuadraticCurvePathWithControl(x1, y1, x2, y2, controlPixelX!, controlPixelY!)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={hitTargetWidth}
                    strokeLinecap="round"
                    style={{ cursor: 'pointer', pointerEvents: 'auto', touchAction: 'none' }}
                    onPointerDown={handleSegmentPointerDown}
                    onPointerUp={handleSegmentPointerUp}
                  />
                )}
                {/* Curved segment using quadratic bezier - force visible */}
                <path
                  d={makeQuadraticCurvePathWithControl(x1, y1, x2, y2, controlPixelX!, controlPixelY!)}
                  fill="none"
                  stroke={segmentStroke}
                  strokeWidth={segmentStrokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={1}
                  pointerEvents="none"
                />
                
                {/* Control point handle (draggable) - only show when not readonly */}
                {!readOnly && onSegmentsChange && (
                  <>
                    {/* Dashed line from curve midpoint to control handle */}
                    <line
                      x1={(x1 + x2) / 2}
                      y1={(y1 + y2) / 2}
                      x2={controlPixelX!}
                      y2={controlPixelY!}
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      opacity={0.5}
                      pointerEvents="none"
                    />
                    {/* Invisible larger touch target */}
                    <circle
                      cx={controlPixelX!}
                      cy={controlPixelY!}
                      r={20}
                      fill="transparent"
                      style={{ cursor: 'grab', pointerEvents: 'auto', touchAction: 'none' }}
                      onPointerDown={(e) => handleControlPointerDown(seg.id, e)}
                    />
                    {/* Visible control handle */}
                    <circle
                      cx={controlPixelX!}
                      cy={controlPixelY!}
                      r={6}
                      fill="hsl(var(--background))"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      style={{ cursor: 'grab', pointerEvents: 'auto' }}
                      onPointerDown={(e) => handleControlPointerDown(seg.id, e)}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                {/* Invisible hit target for straight segment */}
                {onSegmentSelect && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={hitTargetWidth}
                    strokeLinecap="round"
                    style={{ cursor: 'pointer', pointerEvents: 'auto', touchAction: 'none' }}
                    onPointerDown={handleSegmentPointerDown}
                    onPointerUp={handleSegmentPointerUp}
                  />
                )}
                {/* Straight line segment - force visible with solid stroke */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={segmentStroke}
                  strokeWidth={segmentStrokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={1}
                  pointerEvents="none"
                />
              </>
            )}

            {/* Selection highlight */}
            {isSelected && (
              <circle
                cx={(x1 + x2) / 2}
                cy={(y1 + y2) / 2}
                r={6}
                fill="hsl(var(--warning))"
                pointerEvents="none"
              />
            )}

            {/* Debug overlay: show pixel coordinates at endpoints */}
            {debug && (
              <>
                <circle cx={x1} cy={y1} r={4} fill="red" />
                <circle cx={x2} cy={y2} r={4} fill="blue" />
                <text x={x1 + 5} y={y1 - 5} fontSize="10" fill="red">
                  ({x1.toFixed(0)},{y1.toFixed(0)})
                </text>
                <text x={x2 + 5} y={y2 - 5} fontSize="10" fill="blue">
                  ({x2.toFixed(0)},{y2.toFixed(0)})
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default GraphSegmentsLayer;
