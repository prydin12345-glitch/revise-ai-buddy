import { useMemo } from "react";
import { Gauge } from "lucide-react";
import { useTelemetry, alpha, clampPct, scoreColor } from "./tokens";

interface Props {
  subjects: { name: string; color: string; avgScore: number; count: number }[];
  /** Topic counts per subject, for the inline band tally. */
  topicStats?: (subject: string) => { mastered: number; developing: number; review: number };
}

/** Ticks per bar. Enough to read as a scale, few enough to stay crisp at 360px. */
const TICKS = 22;

const bandLabel = (pct: number) =>
  pct >= 75 ? "Strong" : pct >= 55 ? "On track" : pct >= 35 ? "Needs work" : "At risk";

/**
 * Horizontal, all subjects at once.
 *
 * This was a semicircle gauge with a subject selector, which put a second
 * radial chart directly under the readiness ring — two circles competing for
 * the same glance, and only one subject visible at a time. Linear bars show
 * every subject together, rank them weakest-first, and leave exactly one
 * radial on the Overview.
 */
export const SubjectGaugeCard = ({ subjects, topicStats }: Props) => {
  const TELEMETRY = useTelemetry();

  const rows = useMemo(
    () =>
      [...subjects]
        .map((s) => ({ ...s, pct: clampPct(s.avgScore) }))
        .sort((a, b) => a.pct - b.pct),
    [subjects]
  );

  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center text-[13px]"
        style={{ background: TELEMETRY.card, border: `1px dashed ${TELEMETRY.border}`, color: TELEMETRY.muted }}
      >
        Sit an exam to see your subject accuracy.
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-center gap-1.5">
        <Gauge size={13} style={{ color: TELEMETRY.mastered }} />
        <span className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
          Subject accuracy
        </span>
      </div>
      <div className="text-[11px] mt-0.5 mb-4" style={{ color: TELEMETRY.muted }}>
        Weakest first
      </div>

      <div className="space-y-4">
        {rows.map((s) => {
          const tone = scoreColor(s.pct, TELEMETRY);
          const lit = Math.round((s.pct / 100) * TICKS);
          const stats = topicStats?.(s.name);

          return (
            <div key={s.name}>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[13px] font-medium capitalize truncate" style={{ color: TELEMETRY.text }}>
                    {s.name}
                  </span>
                </span>
                <span className="flex items-baseline gap-2 shrink-0">
                  <span className="text-[11px]" style={{ color: tone }}>
                    {bandLabel(s.pct)}
                  </span>
                  <span className="text-[17px] font-semibold tabular-nums" style={{ color: TELEMETRY.text }}>
                    {Math.round(s.pct)}%
                  </span>
                </span>
              </div>

              {/* Segmented capsule — keeps the tick treatment from the old arc,
                  which read well; only the geometry changed. */}
              <div className="flex items-center gap-[2px] h-3.5">
                {Array.from({ length: TICKS }, (_, i) => (
                  <span
                    key={i}
                    className="flex-1 h-full rounded-full"
                    style={{
                      background: i < lit ? tone : TELEMETRY.cardAlt,
                      opacity: i < lit ? 0.45 + 0.55 * (i / (TICKS - 1)) : 1,
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px]" style={{ color: TELEMETRY.muted }}>
                  {s.count} exam{s.count === 1 ? "" : "s"}
                </span>
                {stats &&
                  ([
                    [stats.mastered, "mastered", TELEMETRY.mastered],
                    [stats.developing, "developing", TELEMETRY.developing],
                    [stats.review, "to review", TELEMETRY.review],
                  ] as const)
                    .filter(([n]) => n > 0)
                    .map(([n, label, colour]) => (
                      <span key={label} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: colour }} />
                        <span className="text-[10px]" style={{ color: TELEMETRY.muted }}>
                          {n} {label}
                        </span>
                      </span>
                    ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
