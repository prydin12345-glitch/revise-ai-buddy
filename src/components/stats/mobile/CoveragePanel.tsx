import { useMemo } from "react";
import { useTelemetry, alpha } from "./tokens";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface Props {
  topics: UnifiedTopicScore[];
  subjects: { name: string; color: string }[];
}

const attemptsOf = (t: UnifiedTopicScore) => t.examQuestionCount + t.practiceQuestionCount;

export const CoveragePanel = ({ topics, subjects }: Props) => {
  const TELEMETRY = useTelemetry();

  const { overall, attempted, pending, untouched, bySubject } = useMemo(() => {
    const attempted = topics.filter((t) => attemptsOf(t) > 0);
    const pending = topics.filter((t) => attemptsOf(t) === 0 && (t.pendingQuestionCount ?? 0) > 0);
    const untouched = topics.filter((t) => attemptsOf(t) === 0 && (t.pendingQuestionCount ?? 0) === 0);

    const map = new Map<string, { done: number; total: number; missing: string[] }>();
    topics.forEach((t) => {
      const key = t.subjectId ?? "Unassigned";
      if (!map.has(key)) map.set(key, { done: 0, total: 0, missing: [] });
      const entry = map.get(key)!;
      entry.total += 1;
      if (attemptsOf(t) > 0) entry.done += 1;
      else entry.missing.push(t.topic);
    });

    return {
      overall: topics.length > 0 ? (attempted.length / topics.length) * 100 : 0,
      attempted,
      pending,
      untouched,
      bySubject: [...map.entries()]
        .map(([name, v]) => ({
          name,
          colour: subjects.find((s) => s.name === name)?.color ?? TELEMETRY.idle,
          ...v,
          pct: v.total > 0 ? (v.done / v.total) * 100 : 0,
        }))
        .sort((a, b) => a.pct - b.pct),
    };
  }, [topics, subjects, TELEMETRY.idle]);

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl p-4"
        style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
      >
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[32px] font-bold tabular-nums leading-none" style={{ color: TELEMETRY.text }}>
              {Math.round(overall)}%
            </div>
            <div className="text-[11px] mt-1" style={{ color: TELEMETRY.muted }}>
              of your syllabus touched
            </div>
          </div>
          <div className="text-right text-[11px] tabular-nums" style={{ color: TELEMETRY.muted }}>
            {attempted.length} / {topics.length} topics
          </div>
        </div>

        <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: TELEMETRY.cardAlt }}>
          {attempted.length > 0 && (
            <div style={{ width: `${(attempted.length / topics.length) * 100}%`, background: TELEMETRY.mastered }} />
          )}
          {pending.length > 0 && (
            <div style={{ width: `${(pending.length / topics.length) * 100}%`, background: TELEMETRY.info }} />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          {([
            ["Marked", attempted.length, TELEMETRY.mastered],
            ["Awaiting", pending.length, TELEMETRY.info],
            ["Untouched", untouched.length, TELEMETRY.idle],
          ] as const).map(([label, n, colour]) => (
            <div
              key={label}
              className="rounded-xl px-2 py-2.5 text-center"
              style={{ background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}` }}
            >
              <div className="text-lg font-semibold tabular-nums" style={{ color: colour }}>{n}</div>
              <div className="text-[10px] mt-0.5" style={{ color: TELEMETRY.muted }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl p-4 space-y-3.5"
        style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
      >
        <div>
          <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
            Coverage by subject
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: TELEMETRY.muted }}>
            Least covered first
          </div>
        </div>

        {bySubject.map((s) => (
          <div key={s.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.colour }} />
                <span className="text-[13px] font-medium capitalize truncate" style={{ color: TELEMETRY.text }}>
                  {s.name}
                </span>
              </span>
              <span className="text-[12px] tabular-nums shrink-0" style={{ color: TELEMETRY.muted }}>
                {s.done}/{s.total}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: TELEMETRY.cardAlt }}>
              <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.colour }} />
            </div>
            {s.missing.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {s.missing.slice(0, 4).map((m) => (
                  <span
                    key={m}
                    className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ color: TELEMETRY.mutedStrong, background: alpha(TELEMETRY.idle, 0.12) }}
                  >
                    {m}
                  </span>
                ))}
                {s.missing.length > 4 && (
                  <span className="text-[10px] px-1.5 py-0.5" style={{ color: TELEMETRY.muted }}>
                    +{s.missing.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
