/**
 * GraphSegmentsLayer - Renders line segments and smooth splines on a coordinate graph
 * 
 * This renders as an SVG overlay OUTSIDE Recharts to guarantee visibility.
 * Uses Recharts axis scales when available, otherwise falls back to manual mapping.
 * 
 * Supports two modes:
 * - Individual segments (straight or curved per-segment)
 * - Spline mode: Catmull-Rom spline through all points (requires 3+ points)
 */

import type { LineSegment, GraphPoint } from "./types";

interface GraphSegmentsLayerProps {
  segments: LineSegment[];
  stroke: string;
  strokeWidth?: number;

  /**
   * Optional: pass Recharts' actual axis scale functions for pixel-perfect alignment.
   * If omitted, we fall back to a manual linear mapping using domain + margins.
   */
  xScale?: (x: number) => number;
  yScale?: (y: number) => number;

  // Chart dimensions and margins (must match what Recharts uses)
  containerWidth: number;
  containerHeight: number;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;

  // Data domain
  domainX: [number, number];
  domainY: [number, number];

  // Debug mode
  debug?: boolean;

  /**
   * Spline mode: When provided, renders a smooth Catmull-Rom spline through all points
   * in the order provided (NOT sorted). Requires 3+ points.
   */
  splinePoints?: GraphPoint[];
  
  /**
   * Tension parameter for Catmull-Rom spline (0 = sharp, 0.5 = default, 1 = loose)
   */
  splineTension?: number;
}

/**
 * Catmull-Rom spline interpolation
 * Returns a point on the spline between p1 and p2, with p0 and p3 as control points
 * @param t - Parameter from 0 to 1 (position between p1 and p2)
 * @param tension - Tension parameter (0.5 is standard Catmull-Rom)
 */
function catmullRomPoint(
  p0: GraphPoint,
  p1: GraphPoint,
  p2: GraphPoint,
  p3: GraphPoint,
  t: number,
  tension: number = 0.5
): GraphPoint {
  const t2 = t * t;
  const t3 = t2 * t;
  
  // Catmull-Rom basis matrix with tension
  const s = (1 - tension) / 2;
  
  return {
    x: s * ((-t3 + 2*t2 - t) * p0.x + (3*t3 - 5*t2 + 2) * p1.x + (-3*t3 + 4*t2 + t) * p2.x + (t3 - t2) * p3.x),
    y: s * ((-t3 + 2*t2 - t) * p0.y + (3*t3 - 5*t2 + 2) * p1.y + (-3*t3 + 4*t2 + t) * p2.y + (t3 - t2) * p3.y)
  };
}

/**
 * Generate SVG path for a Catmull-Rom spline through all points
 * Uses high-resolution sampling for smooth curves
 * Points are used IN THE ORDER PROVIDED (not sorted)
 */
function makeCatmullRomPath(
  points: GraphPoint[],
  dataToPixelX: (x: number) => number,
  dataToPixelY: (y: number) => number,
  tension: number = 0.5,
  samplesPerSegment: number = 32
): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    // Just a straight line for 2 points
    const x1 = dataToPixelX(points[0].x);
    const y1 = dataToPixelY(points[0].y);
    const x2 = dataToPixelX(points[1].x);
    const y2 = dataToPixelY(points[1].y);
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  const pathPoints: string[] = [];
  
  // Start at first point
  const startX = dataToPixelX(points[0].x);
  const startY = dataToPixelY(points[0].y);
  pathPoints.push(`M ${startX.toFixed(2)} ${startY.toFixed(2)}`);

  // For each segment between consecutive points
  for (let i = 0; i < points.length - 1; i++) {
    // Get the 4 control points for this segment
    // For endpoints, we extend/duplicate to maintain curvature
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Sample the spline at high resolution
    for (let j = 1; j <= samplesPerSegment; j++) {
      const t = j / samplesPerSegment;
      const pt = catmullRomPoint(p0, p1, p2, p3, t, tension);
      const px = dataToPixelX(pt.x);
      const py = dataToPixelY(pt.y);
      
      if (Number.isFinite(px) && Number.isFinite(py)) {
        pathPoints.push(`L ${px.toFixed(2)} ${py.toFixed(2)}`);
      }
    }
  }

  return pathPoints.join(' ');
}

/**
 * Generate a simple quadratic curve path between two points (legacy per-segment curved mode)
 */
function makeQuadraticCurvePath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular normal for a gentle, consistent curve
  const nx = -dy / len;
  const ny = dx / len;
  const curvature = Math.min(40, len * 0.25);

  const cx = mx + nx * curvature;
  const cy = my + ny * curvature;

  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export function GraphSegmentsLayer({
  segments,
  stroke,
  strokeWidth = 3,
  xScale,
  yScale,
  containerWidth,
  containerHeight,
  marginLeft = 65,
  marginRight = 30,
  marginTop = 30,
  marginBottom = 50,
  domainX,
  domainY,
  debug = false,
  splinePoints,
  splineTension = 0.5,
}: GraphSegmentsLayerProps) {
  // Early return for invalid dimensions
  if (containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }

  // Calculate the plot area dimensions (fallback mapper)
  const plotWidth = containerWidth - marginLeft - marginRight;
  const plotHeight = containerHeight - marginTop - marginBottom;

  if (plotWidth <= 0 || plotHeight <= 0) return null;

  // Convert data coordinates to pixel coordinates
  // Use Recharts scale functions if available for perfect alignment
  const dataToPixelX = (dataX: number): number => {
    if (xScale) return xScale(dataX);
    const denom = domainX[1] - domainX[0] || 1;
    const fraction = (dataX - domainX[0]) / denom;
    return marginLeft + fraction * plotWidth;
  };

  const dataToPixelY = (dataY: number): number => {
    if (yScale) return yScale(dataY);
    const denom = domainY[1] - domainY[0] || 1;
    // Y axis is inverted in SVG (0 is top)
    const fraction = (dataY - domainY[0]) / denom;
    return marginTop + (1 - fraction) * plotHeight;
  };

  // Check if we should render a spline (curved mode with 3+ points)
  const shouldRenderSpline = splinePoints && splinePoints.length >= 3;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        pointerEvents: "none",
        zIndex: 10,
        overflow: "hidden",
      }}
      viewBox={`0 0 ${containerWidth} ${containerHeight}`}
      preserveAspectRatio="none"
    >
      {/* Render smooth Catmull-Rom spline when in spline mode */}
      {shouldRenderSpline && (
        <path
          d={makeCatmullRomPath(splinePoints!, dataToPixelX, dataToPixelY, splineTension)}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={1}
        />
      )}

      {/* Render individual segments (straight mode, or legacy curved per-segment) */}
      {!shouldRenderSpline && segments?.length > 0 && segments.map((seg) => {
        const x1 = dataToPixelX(seg.from.x);
        const y1 = dataToPixelY(seg.from.y);
        const x2 = dataToPixelX(seg.to.x);
        const y2 = dataToPixelY(seg.to.y);

        // Skip invalid coordinates
        if ([x1, y1, x2, y2].some((v) => !Number.isFinite(v))) {
          return null;
        }

        const isCurved = seg.mode === "curved";
        const pathD = isCurved ? makeQuadraticCurvePath(x1, y1, x2, y2) : undefined;

        return (
          <g key={seg.id}>
            {/* Main segment - single solid stroke */}
            {isCurved ? (
              <path
                d={pathD!}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
              />
            ) : (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={1}
              />
            )}

            {/* Debug: show endpoint markers and coordinates */}
            {debug && (
              <>
                <circle cx={x1} cy={y1} r={6} fill="red" stroke="white" strokeWidth={2} />
                <circle cx={x2} cy={y2} r={6} fill="lime" stroke="white" strokeWidth={2} />
                <text x={x1 + 10} y={y1 - 10} fontSize={11} fill="red" fontWeight="bold">
                  ({seg.from.x},{seg.from.y}) → px({Math.round(x1)},{Math.round(y1)})
                </text>
                <text x={x2 + 10} y={y2 + 16} fontSize={11} fill="lime" fontWeight="bold">
                  ({seg.to.x},{seg.to.y}) → px({Math.round(x2)},{Math.round(y2)})
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* Debug markers for spline points */}
      {debug && shouldRenderSpline && splinePoints!.map((pt, idx) => {
        const px = dataToPixelX(pt.x);
        const py = dataToPixelY(pt.y);
        return (
          <g key={`debug-spline-${idx}`}>
            <circle cx={px} cy={py} r={6} fill="cyan" stroke="white" strokeWidth={2} />
            <text x={px + 10} y={py - 5} fontSize={10} fill="cyan" fontWeight="bold">
              P{idx}: ({pt.x},{pt.y})
            </text>
          </g>
        );
      })}
    </svg>
  );
}
