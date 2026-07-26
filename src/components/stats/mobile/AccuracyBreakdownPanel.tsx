import { useMemo } from "react";
import { useTelemetry, alpha, clampPct } from "./tokens";
import { ScoreDistribution } from "./ScoreDistribution";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface Props {
  topics: UnifiedTopicScore[];
  subjects: { name: string; color: string }[];
}

const marked = (t: UnifiedTopicScore) => t.examQuestionCount + t.practiceQuestionCount > 0;

export const AccuracyBreakdownPanel = ({ topics, subjects }: Props) => {
  const TELEMETRY = useTelemetry();

  const { scored, rows, pendingTotal } = useMemo(() => {
    const scored = topics.filter(marked);
    const pendingTotal = topics.reduce((n, t) => n + (t.pendingQuestionCount ?? 0), 0);

    const bySubject = new Map<string, number[]>();
    scored.forEach((t) => {
      const key = t.subjectId ?? "Unassigned";
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key)!.push(clampPct(t.unifiedScore));
    });

    const rows = [...bySubject.entries()]
      .map(([name, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return {
          name,
          colour: subjects.find((s) => s.name === name)?.color ?? TELEMETRY.gray,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          median: sorted[Math.floor(sorted.length / 2)],
          avg,
          count: values.length,
        };
      })
      .sort((a, b) => a.avg - b.avg); // weakest subject first — that's the actionable end

    return { scored, rows, pendingTotal };
  }, [topics, subjects, TELEMETRY.gray]);

  if (scored.length === 0) {
    return (
      <div className="text-[13px] text-center py-8" style={{ color: TELEMETRY.muted }}>
        {pendingTotal > 0
          ? `${pendingTotal} answered question${pendingTotal === 1 ? "" : "s"} still awaiting marking.`
          : "No marked questions yet."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl p-4"
        style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
      >
        <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
          Where your topics sit
        </div>
        <div className="text-[11px] mt-0.5 mb-4" style={{ color: TELEMETRY.muted }}>
          {scored.length} marked topic{scored.length === 1 ? "" : "s"}
        </div>
        <ScoreDistribution values={scored.map((t) => clampPct(t.unifiedScore))} />
      </div>

      <div
        className="rounded-2xl p-4"
        style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
      >
        <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
          Spread by subject
        </div>
        <div className="text-[11px] mt-0.5 mb-4" style={{ color: TELEMETRY.muted }}>
          Bar spans your weakest to strongest topic; the dot is the average.
        </div>

        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.colour }} />
                  <span className="text-[13px] font-medium capitalize truncate" style={{ color: TELEMETRY.text }}>
                    {r.name}
                  </span>
                </span>
                <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: r.colour }}>
                  {Math.round(r.avg)}%
                </span>
              </div>

              <div className="relative h-6">
                {/* track */}
                <div
                  className="absolute inset-x-0 rounded-full"
                  style={{ top: 10, height: 4, background: TELEMETRY.cardAlt }}
                />
                {/* min-max range */}
                <div
                  className="absolute rounded-full"
                  style={{
                    top: 10,
                    height: 4,
                    left: `${r.min}%`,
                    width: `${Math.max(r.max - r.min, 1)}%`,
                    background: alpha(r.colour, 0.45),
                  }}
                />
                {/* average marker */}
                <div
                  className="absolute rounded-full"
                  style={{
                    top: 6,
                    left: `${r.avg}%`,
                    width: 12,
                    height: 12,
                    marginLeft: -6,
                    background: r.colour,
                    border: `2px solid ${TELEMETRY.card}`,
                  }}
                />
              </div>

              <div className="flex justify-between text-[10px] tabular-nums" style={{ color: TELEMETRY.muted }}>
                <span>low {Math.round(r.min)}%</span>
                <span>
                  {r.count} topic{r.count === 1 ? "" : "s"}
                </span>
                <span>high {Math.round(r.max)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {pendingTotal > 0 && (
        <p
          className="text-[12px] rounded-xl p-3"
          style={{
            color: TELEMETRY.mutedStrong,
            background: alpha(TELEMETRY.amber, 0.08),
            border: `1px solid ${alpha(TELEMETRY.amber, 0.2)}`,
          }}
        >
          {pendingTotal} answered question{pendingTotal === 1 ? " is" : "s are"} still awaiting
          marking and {pendingTotal === 1 ? "isn't" : "aren't"} counted above.
        </p>
      )}
    </div>
  );
};
