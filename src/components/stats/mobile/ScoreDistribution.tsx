import { useMemo } from "react";
import { useTelemetry, alpha, clampPct } from "./tokens";

interface Props {
  /** One score per topic, 0-100. */
  values: number[];
  height?: number;
  showLegend?: boolean;
}

const BUCKETS = 10;

/**
 * Distribution of topic scores rather than a single average.
 *
 * A mean of 62% hides whether that's every topic sitting at 62 or half at 90
 * and half at 30 — which are completely different revision problems. Bands
 * match scoreStatusLabel's 40/70 thresholds so the colours mean the same thing
 * they do everywhere else.
 */
export const ScoreDistribution = ({ values, height = 72, showLegend = true }: Props) => {
  const TELEMETRY = useTelemetry();

  const { bars, avg, bands, total } = useMemo(() => {
    const clean = values.filter((v) => Number.isFinite(v)).map(clampPct);
    const counts = new Array(BUCKETS).fill(0);
    clean.forEach((v) => {
      const i = Math.min(BUCKETS - 1, Math.floor(v / (100 / BUCKETS)));
      counts[i] += 1;
    });
    const max = Math.max(...counts, 1);

    const colourAt = (upper: number) =>
      upper <= 40 ? TELEMETRY.review : upper <= 70 ? TELEMETRY.developing : TELEMETRY.mastered;

    return {
      bars: counts.map((count, i) => ({
        count,
        pct: (count / max) * 100,
        colour: colourAt((i + 1) * (100 / BUCKETS)),
      })),
      avg: clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null,
      bands: {
        review: clean.filter((v) => v < 40).length,
        developing: clean.filter((v) => v >= 40 && v < 70).length,
        mastered: clean.filter((v) => v >= 70).length,
      },
      total: clean.length,
    };
  }, [values, TELEMETRY.review, TELEMETRY.developing, TELEMETRY.mastered]);

  if (total === 0) {
    return (
      <p className="text-[12px] py-4 text-center" style={{ color: TELEMETRY.muted }}>
        No marked topics yet.
      </p>
    );
  }

  return (
    <div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full">
              <div
                className="w-full rounded-t-[3px] transition-all"
                style={{
                  height: `${Math.max(b.pct, b.count > 0 ? 8 : 0)}%`,
                  background: b.count > 0 ? b.colour : "transparent",
                  opacity: b.count > 0 ? 0.9 : 1,
                  minHeight: b.count > 0 ? 4 : 0,
                }}
              />
              {b.count === 0 && (
                <div className="w-full rounded-full" style={{ height: 2, background: TELEMETRY.cardAlt }} />
              )}
            </div>
          ))}
        </div>

        {avg !== null && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: `${avg}%`, borderLeft: `1.5px dashed ${TELEMETRY.mutedStrong}` }}
          >
            <span
              className="absolute -top-1 -translate-x-1/2 text-[9px] font-semibold tabular-nums px-1 rounded whitespace-nowrap"
              style={{
                left: 0,
                color: TELEMETRY.text,
                background: alpha(TELEMETRY.bg, 0.9),
              }}
            >
              avg {Math.round(avg)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-between text-[9px] tabular-nums mt-1.5" style={{ color: TELEMETRY.muted }}>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>

      {showLegend && (
        <div className="flex items-center gap-3 mt-2.5">
          {([
            ["Needs review", bands.review, TELEMETRY.review],
            ["Developing", bands.developing, TELEMETRY.developing],
            ["Mastered", bands.mastered, TELEMETRY.mastered],
          ] as const).map(([label, count, colour]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: colour }} />
              <span className="text-[10px]" style={{ color: TELEMETRY.muted }}>
                {label} <span className="tabular-nums font-semibold" style={{ color: TELEMETRY.text }}>{count}</span>
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
