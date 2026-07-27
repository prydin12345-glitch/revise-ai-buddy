import { useMemo } from "react";
import { useTelemetry, clampPct, truncate } from "./tokens";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

export interface SubjectStack {
  name: string;
  colour: string;
  mastered: number;
  developing: number;
  review: number;
  total: number;
  avg: number;
}

interface Props {
  topics: UnifiedTopicScore[];
  subjects: { name: string; color: string }[];
  onSelect?: (subject: string) => void;
  selected?: string | null;
}

export const buildSubjectStacks = (
  topics: UnifiedTopicScore[],
  subjects: { name: string; color: string }[],
  fallback: string
): SubjectStack[] => {
  const map = new Map<string, { scores: number[]; m: number; d: number; r: number }>();

  topics.forEach((t) => {
    if (t.examQuestionCount + t.practiceQuestionCount === 0) return;
    const key = t.subjectId ?? "Unassigned";
    if (!map.has(key)) map.set(key, { scores: [], m: 0, d: 0, r: 0 });
    const entry = map.get(key)!;
    const pct = clampPct(t.unifiedScore);
    entry.scores.push(pct);
    if (pct >= 70) entry.m += 1;
    else if (pct >= 40) entry.d += 1;
    else entry.r += 1;
  });

  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      colour: subjects.find((s) => s.name === name)?.color ?? fallback,
      mastered: v.m,
      developing: v.d,
      review: v.r,
      total: v.scores.length,
      avg: v.scores.reduce((a, b) => a + b, 0) / v.scores.length,
    }))
    .sort((a, b) => b.total - a.total);
};

/**
 * One column per subject, stacked by mastery band — the shape of a subject's
 * topic spread at a glance. Replaces a single global histogram, which mixed
 * every subject together and so couldn't tell you *where* the weakness was.
 */
export const SubjectStackedBars = ({ topics, subjects, onSelect, selected }: Props) => {
  const TELEMETRY = useTelemetry();

  const stacks = useMemo(
    () => buildSubjectStacks(topics, subjects, TELEMETRY.gray),
    [topics, subjects, TELEMETRY.gray]
  );

  const max = Math.max(...stacks.map((s) => s.total), 1);

  if (stacks.length === 0) {
    return (
      <p className="text-[12px] py-6 text-center" style={{ color: TELEMETRY.muted }}>
        No marked topics yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-around gap-4" style={{ height: 148 }}>
        {stacks.map((s) => {
          const heightPct = (s.total / max) * 100;
          const isDim = selected != null && selected !== s.name;

          const segments = [
            { count: s.review, colour: TELEMETRY.magenta },
            { count: s.developing, colour: TELEMETRY.cyan },
            { count: s.mastered, colour: TELEMETRY.lime },
          ].filter((seg) => seg.count > 0);

          return (
            <button
              key={s.name}
              type="button"
              onClick={() => onSelect?.(s.name)}
              disabled={!onSelect}
              className="flex-1 max-w-[48px] h-full flex flex-col items-center justify-end gap-2 transition-opacity active:scale-[0.97]"
              style={{ opacity: isDim ? 0.35 : 1 }}
            >
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: TELEMETRY.text }}>
                {s.total}
              </span>
              <div
                className="rounded-full overflow-hidden flex flex-col"
                style={{
                  width: 14,
                  height: `${Math.max(heightPct, 12)}%`,
                  background: TELEMETRY.cardAlt,
                  boxShadow: selected === s.name ? `0 0 0 1.5px ${s.colour}` : undefined,
                }}
              >
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    style={{ height: `${(seg.count / s.total) * 100}%`, background: seg.colour }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-start justify-around gap-3 mt-2">
        {stacks.map((s) => (
          <div key={s.name} className="flex-1 max-w-[64px] text-center">
            <span className="inline-flex items-center gap-1 justify-center">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.colour }} />
              <span className="text-[10px] capitalize truncate" style={{ color: TELEMETRY.muted }}>
                {truncate(s.name, 9)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
