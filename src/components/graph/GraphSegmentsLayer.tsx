/**
 * GraphSegmentsLayer - Renders line segments on a coordinate graph
 * 
 * This renders as an SVG overlay OUTSIDE Recharts to guarantee visibility.
 * We compute pixel coords from the domain/range manually since Recharts 
 * Customized doesn't reliably expose axis scales.
 */

import type { LineSegment } from "./types";

interface GraphSegmentsLayerProps {
  segments: LineSegment[];
  stroke: string;
  strokeWidth?: number;
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
  strokeWidth = 3,
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

  // Calculate the plot area dimensions
  const plotWidth = containerWidth - marginLeft - marginRight;
  const plotHeight = containerHeight - marginTop - marginBottom;

  if (plotWidth <= 0 || plotHeight <= 0) return null;

  // Convert data coordinates to pixel coordinates
  const dataToPixelX = (dataX: number): number => {
    const fraction = (dataX - domainX[0]) / (domainX[1] - domainX[0]);
    return marginLeft + fraction * plotWidth;
  };

  const dataToPixelY = (dataY: number): number => {
    // Y axis is inverted in SVG (0 is top)
    const fraction = (dataY - domainY[0]) / (domainY[1] - domainY[0]);
    return marginTop + (1 - fraction) * plotHeight;
  };

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        pointerEvents: "none",
        zIndex: 10, // Above chart but below dots (dots have their own z via DOM order)
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

        return (
          <g key={seg.id}>
            {seg.mode === "curved" ? (
              <path
                d={makeCurvedPath(x1, y1, x2, y2)}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
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
                <circle cx={x1} cy={y1} r={4} fill="red" />
                <circle cx={x2} cy={y2} r={4} fill="blue" />
                <text x={x1 + 6} y={y1 - 6} fontSize={10} fill="red">
                  ({seg.from.x},{seg.from.y})→px({Math.round(x1)},{Math.round(y1)})
                </text>
                <text x={x2 + 6} y={y2 + 12} fontSize={10} fill="blue">
                  ({seg.to.x},{seg.to.y})→px({Math.round(x2)},{Math.round(y2)})
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
