/**
 * GraphSegmentsLayer - Renders line segments on a coordinate graph
 * 
 * This renders as an SVG overlay OUTSIDE Recharts to guarantee visibility.
 * Uses Recharts axis scales when available, otherwise falls back to manual mapping.
 */

import type { LineSegment } from "./types";

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
}

function makeCurvedPath(x1: number, y1: number, x2: number, y2: number) {
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
  strokeWidth = 4,
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
}: GraphSegmentsLayerProps) {
  if (!segments?.length || containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }

  // Calculate the plot area dimensions (fallback mapper)
  const plotWidth = containerWidth - marginLeft - marginRight;
  const plotHeight = containerHeight - marginTop - marginBottom;

  if (plotWidth <= 0 || plotHeight <= 0) return null;

  // Convert data coordinates to pixel coordinates (fallback when scales not available)
  const dataToPixelX = (dataX: number): number => {
    // Use Recharts scale if available
    if (xScale) return xScale(dataX);
    
    const denom = domainX[1] - domainX[0] || 1;
    const fraction = (dataX - domainX[0]) / denom;
    return marginLeft + fraction * plotWidth;
  };

  const dataToPixelY = (dataY: number): number => {
    // Use Recharts scale if available
    if (yScale) return yScale(dataY);
    
    const denom = domainY[1] - domainY[0] || 1;
    // Y axis is inverted in SVG (0 is top)
    const fraction = (dataY - domainY[0]) / denom;
    return marginTop + (1 - fraction) * plotHeight;
  };

  // High-contrast outline for visibility on any background
  const outlineColor = "rgba(0, 0, 0, 0.7)";
  const outlineWidth = strokeWidth + 4;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 100, // Very high - above chart, grid, AND points
        overflow: "visible",
      }}
    >
      {segments.map((seg) => {
        const x1 = dataToPixelX(seg.from.x);
        const y1 = dataToPixelY(seg.from.y);
        const x2 = dataToPixelX(seg.to.x);
        const y2 = dataToPixelY(seg.to.y);

        // Skip invalid coordinates
        if ([x1, y1, x2, y2].some((v) => !Number.isFinite(v))) {
          return null;
        }

        const isCurved = seg.mode === "curved";
        const pathD = isCurved ? makeCurvedPath(x1, y1, x2, y2) : undefined;

        return (
          <g key={seg.id}>
            {/* Dark outline/halo for contrast */}
            {isCurved ? (
              <path
                d={pathD!}
                fill="none"
                stroke={outlineColor}
                strokeWidth={outlineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={outlineColor}
                strokeWidth={outlineWidth}
                strokeLinecap="round"
              />
            )}

            {/* Main colored segment */}
            {isCurved ? (
              <path
                d={pathD!}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
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
    </svg>
  );
}
