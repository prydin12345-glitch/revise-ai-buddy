import React from 'react';
import { GraphPoint, LineSegment } from './types';

/**
 * Props for the GraphSegmentsLayer component.
 * This component renders line segments and curves on a coordinate graph as an SVG overlay.
 */
interface GraphSegmentsLayerProps {
  /** Array of line segments to render */
  segments: LineSegment[];
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
}

/**
 * Generates a simple quadratic bezier curve path between two points.
 * The curve bends perpendicular to the line connecting the two points.
 */
function makeQuadraticCurvePath(
  x1: number, y1: number,
  x2: number, y2: number
): string {
  // Calculate midpoint
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  
  // Calculate perpendicular offset for the control point
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Offset the control point perpendicular to the line
  // Use 20% of the distance as the curve amount
  const curveAmount = dist * 0.2;
  const perpX = -dy / dist * curveAmount;
  const perpY = dx / dist * curveAmount;
  
  const controlX = midX + perpX;
  const controlY = midY + perpY;
  
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * GraphSegmentsLayer renders line segments on a coordinate graph.
 * 
 * It renders ONLY the segments that are explicitly provided - no auto-joining.
 * Each segment specifies its own mode (straight or curved).
 */
export function GraphSegmentsLayer({
  segments,
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
}: GraphSegmentsLayerProps) {
  // Calculate plot area dimensions
  const plotWidth = containerWidth - marginLeft - marginRight;
  const plotHeight = containerHeight - marginTop - marginBottom;

  // Check if we need to offset scales (Recharts sometimes returns values relative to plot area)
  const xScaleNeedsOffset = xScale ? xScale(domainX[0]) < marginLeft : false;
  const yScaleNeedsOffset = yScale ? yScale(domainY[0]) < marginTop : false;

  /**
   * Convert data X coordinate to pixel X coordinate.
   * Uses Recharts scale if available, otherwise calculates manually.
   */
  const dataToPixelX = (dataX: number): number => {
    if (xScale) {
      const px = xScale(dataX);
      return xScaleNeedsOffset ? px + marginLeft : px;
    }
    const denom = domainX[1] - domainX[0] || 1;
    const fraction = (dataX - domainX[0]) / denom;
    return marginLeft + fraction * plotWidth;
  };

  /**
   * Convert data Y coordinate to pixel Y coordinate.
   * Uses Recharts scale if available, otherwise calculates manually.
   * Note: Y axis is inverted in SVG (0 is top).
   */
  const dataToPixelY = (dataY: number): number => {
    if (yScale) {
      const py = yScale(dataY);
      return yScaleNeedsOffset ? py + marginTop : py;
    }
    const denom = domainY[1] - domainY[0] || 1;
    const fraction = (dataY - domainY[0]) / denom;
    return marginTop + (1 - fraction) * plotHeight;
  };

  if (!segments || segments.length === 0) {
    return null;
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
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

        return (
          <g key={seg.id}>
            {isCurved ? (
              // Curved segment using quadratic bezier
              <path
                d={makeQuadraticCurvePath(x1, y1, x2, y2)}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              // Straight line segment
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
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
