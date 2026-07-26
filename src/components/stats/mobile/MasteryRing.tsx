import { useMemo } from "react";
import { useTelemetry, clampPct } from "./tokens";

interface Band {
  label: string;
  count: number;
  colour: string;
}

interface Props {
  /** Overall accuracy shown in the centre. */
  score: number;
  bands: Band[];
  size?: number;
}

const GAP_DEG = 3;

/**
 * Segmented ring: arc length is the share of topics in each mastery band,
 * centre is the average score. A single linear bar could only ever show the
 * average, which hides whether one weak topic or ten are dragging it down.
 */
export const MasteryRing = ({ score, bands, size = 168 }: Props) => {
  const TELEMETRY = useTelemetry();

  const R = size / 2 - 14;
  const CIRC = 2 * Math.PI * R;
  const total = bands.reduce((sum, b) => sum + b.count, 0);

  const arcs = useMemo(() => {
    if (total === 0) return [];
    let cursor = 0;
    return bands
      .filter((b) => b.count > 0)
      .map((b) => {
        const share = b.count / total;
        const gap = bands.filter((x) => x.count > 0).length > 1 ? GAP_DEG : 0;
        const deg = share * 360 - gap;
        const arc = { ...b, offset: cursor, length: Math.max(deg, 1) };
        cursor += share * 360;
        return arc;
      });
  }, [bands, total]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke={TELEMETRY.cardAlt}
            strokeWidth={14}
          />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx={size / 2}
              cy={size / 2}
              r={R}
              fill="none"
              stroke={a.colour}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${(a.length / 360) * CIRC} ${CIRC}`}
              strokeDashoffset={-(a.offset / 360) * CIRC}
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[32px] font-bold tabular-nums leading-none"
            style={{ color: TELEMETRY.text }}
          >
            {Math.round(clampPct(score))}%
          </span>
          <span className="text-[11px] mt-1" style={{ color: TELEMETRY.muted }}>
            average score
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 w-full mt-4">
        {bands.map((b) => (
          <div
            key={b.label}
            className="rounded-xl px-2 py-2.5 text-center"
            style={{ background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}` }}
          >
            <div className="text-lg font-semibold tabular-nums" style={{ color: b.colour }}>
              {b.count}
            </div>
            <div className="text-[10px] mt-0.5 leading-tight" style={{ color: TELEMETRY.muted }}>
              {b.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
