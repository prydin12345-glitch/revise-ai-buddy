import { TELEMETRY, clampPct, masteryColor } from "./tokens";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

export const TopicTelemetryRow = ({ topic }: { topic: UnifiedTopicScore }) => {
  const color = masteryColor(topic.mastery);
  const pct = clampPct(topic.unifiedScore);
  const attempts = topic.examQuestionCount + topic.practiceQuestionCount;

  return (
    <div
      className="flex items-center gap-3 py-2.5"
      style={{ borderBottom: `1px solid ${TELEMETRY.borderSoft}` }}
    >
      <span
        className="inline-block w-1.5 h-6 rounded-full flex-shrink-0"
        style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] font-medium truncate capitalize"
          style={{ color: TELEMETRY.text }}
        >
          {topic.topic}
        </div>
        {topic.subjectId && (
          <div
            className="text-[9px] uppercase tracking-wider mt-0.5 truncate"
            style={{ color: TELEMETRY.muted }}
          >
            {topic.subjectId}
          </div>
        )}
      </div>
      <div className="w-16 h-1 rounded-full overflow-hidden flex-shrink-0" style={{ background: TELEMETRY.border }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}88` }}
        />
      </div>
      <div className="text-right flex-shrink-0 w-12">
        <div className="text-[13px] font-semibold tabular-nums" style={{ color: TELEMETRY.text }}>
          {pct}%
        </div>
        <div className="text-[9px] tabular-nums" style={{ color: TELEMETRY.muted }}>
          {attempts}x
        </div>
      </div>
    </div>
  );
};
