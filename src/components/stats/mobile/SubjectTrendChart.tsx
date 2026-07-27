import { useMemo, useId } from "react";
import { useTelemetry, clampPct } from "./tokens";

interface Props {
  /** examResultsData rows: { period, [subject]: percentage }. */
  data: Array<Record<string, any>>;
  subject: string;
  colour: string;
  height?: number;
}

const W = 300;
const PAD_X = 8;
const PAD_Y = 14;

/**
 * Area trend for one subject with per-point direction colouring: a point that
 * improved on the previous sitting is lime, one that dropped is magenta.
 * Gaps break the line rather than implying progress across periods with no data.
 */
export const SubjectTrendChart = ({ data, subject, colour, height = 110 }: Props) => {
  const TELEMETRY = useTelemetry();
  const gid = `trend-${useId().replace(/:/g, "")}`;

  const model = useMemo(() => {
    const raw = data.map((row) => {
      const v = row[subject];
      return {
        label: row.period as string,
        value: typeof v === "number" && Number.isFinite(v) ? clampPct(v) : null,
      };
    });

    const present = raw.filter((r) => r.value !== null);
    if (present.length === 0) return null;

    const xFor = (i: number) =>
      PAD_X + (raw.length <= 1 ? 0 : (i / (raw.length - 1)) * (W - PAD_X * 2));
    const yFor = (v: number) => PAD_Y + (1 - v / 100) * (height - PAD_Y * 2);

    let previous: number | null = null;
    const points = raw.map((r, i) => {
      const dir =
        r.value === null || previous === null
          ? "flat"
          : r.value > previous + 1
          ? "up"
          : r.value < previous - 1
          ? "down"
          : "flat";
      if (r.value !== null) previous = r.value;
      return { ...r, x: xFor(i), y: r.value === null ? null : yFor(r.value), dir };
    });

    const runs: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    points.forEach((p) => {
      if (p.y === null) {
        if (run.length) runs.push(run);
        run = [];
      } else run.push({ x: p.x, y: p.y });
    });
    if (run.length) runs.push(run);

    const longest = runs.reduce((a, b) => (b.length > a.length ? b : a), runs[0] ?? []);
    const area =
      longest.length > 1
        ? `M ${longest[0].x} ${height - PAD_Y} ` +
          longest.map((p) => `L ${p.x} ${p.y}`).join(" ") +
          ` L ${longest[longest.length - 1].x} ${height - PAD_Y} Z`
        : "";

    const first = present[0].value!;
    const last = present[present.length - 1].value!;

    return { points, runs, area, delta: last - first, latest: last };
  }, [data, subject, height]);

  if (!model) {
    return (
      <p className="text-[11px] py-6 text-center" style={{ color: TELEMETRY.muted }}>
        No results for this subject in the selected range.
      </p>
    );
  }

  const dirColour = (dir: string) =>
    dir === "up" ? TELEMETRY.mastered : dir === "down" ? TELEMETRY.review : colour;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity="0.22" />
            <stop offset="100%" stopColor={colour} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map((v) => {
          const y = PAD_Y + (1 - v / 100) * (height - PAD_Y * 2);
          return (
            <line key={v} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke={TELEMETRY.border} strokeWidth={1} opacity={0.5} />
          );
        })}

        {model.area && <path d={model.area} fill={`url(#${gid})`} />}

        {model.runs.map((run, i) => (
          <polyline
            key={i}
            points={run.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={colour}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {model.points.map((p, i) =>
          p.y === null ? null : (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill={TELEMETRY.card}
              stroke={dirColour(p.dir)}
              strokeWidth={2}
            />
          )
        )}
      </svg>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: TELEMETRY.muted }}>
          {model.points[0]?.label} → {model.points[model.points.length - 1]?.label}
        </span>
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={{
            color:
              model.delta > 1 ? TELEMETRY.mastered : model.delta < -1 ? TELEMETRY.review : TELEMETRY.muted,
          }}
        >
          {model.delta > 0 ? "+" : ""}
          {Math.round(model.delta)}% over range
        </span>
      </div>
    </div>
  );
};
