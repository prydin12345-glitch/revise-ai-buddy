import { useMemo } from "react";
import { useTelemetry, clampPct, scoreColor } from "./tokens";

interface Props {
  subjects: { name: string; color: string; avgScore: number; count: number }[];
  /** Topic counts per subject, for the inline band tally. */
  topicStats?: (subject: string) => { mastered: number; developing: number; review: number };
}

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
        <h2 className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>Subject accuracy</h2>
      </div>
      <div className="text-[11px] mt-0.5 mb-4" style={{ color: TELEMETRY.muted }}>
        Weakest first
      </div>

      <div className="space-y-4">
        {rows.map((s) => {
          const tone = scoreColor(s.pct, TELEMETRY);
          const stats = topicStats?.(s.name);

          return (
            <div key={s.name}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[13px] font-medium capitalize break-words" style={{ color: TELEMETRY.text }}>
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

              <div className="h-2 overflow-hidden rounded-full" style={{background:TELEMETRY.cardAlt}} role="meter" aria-label={`${s.name} average exam score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.pct}>
                <div className="h-full rounded-full" style={{width:`${s.pct}%`,background:TELEMETRY.info}} />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
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
