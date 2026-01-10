import { Customized } from "recharts";
import type { LineSegment } from "./types";

interface GraphSegmentsLayerProps {
  segments: LineSegment[];
  stroke: string;
  strokeWidth?: number;
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
}: GraphSegmentsLayerProps) {
  return (
    <Customized
      component={(props: any) => {
        if (!segments?.length) return null;

        const xAxis = Object.values(props?.xAxisMap ?? {})[0] as any;
        const yAxis = Object.values(props?.yAxisMap ?? {})[0] as any;
        const xScale = xAxis?.scale;
        const yScale = yAxis?.scale;
        if (!xScale || !yScale) return null;

        return (
          <g style={{ pointerEvents: "none" }}>
            {segments.map((seg) => {
              const x1 = xScale(seg.from.x);
              const y1 = yScale(seg.from.y);
              const x2 = xScale(seg.to.x);
              const y2 = yScale(seg.to.y);

              if (
                [x1, y1, x2, y2].some(
                  (v) => typeof v !== "number" || Number.isNaN(v)
                )
              ) {
                return null;
              }

              return seg.mode === "curved" ? (
                <path
                  key={seg.id}
                  d={makeCurvedPath(x1, y1, x2, y2)}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <line
                  key={seg.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        );
      }}
    />
  );
}
