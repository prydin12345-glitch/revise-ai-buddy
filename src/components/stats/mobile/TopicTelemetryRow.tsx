import { useTelemetry, alpha, clampPct, scoreStatusColor, scoreStatusLabel } from "./tokens";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface Props {
  topic: UnifiedTopicScore;
  compact?: boolean;
}

export const TopicTelemetryRow = ({ topic, compact = false }: Props) => {
  const TELEMETRY = useTelemetry();
  const attempts = topic.examQuestionCount + topic.practiceQuestionCount;
  const pending = topic.pendingQuestionCount ?? 0;
  const pct = clampPct(topic.unifiedScore);

  // Answered but unmarked work has no score yet — showing it as 0% read as a
  // failed topic when the paper simply hadn't been submitted.
  const awaiting = attempts === 0 && pending > 0;
  const color = awaiting ? TELEMETRY.info : scoreStatusColor(pct, attempts, TELEMETRY);
  const status = awaiting ? "Awaiting marking" : scoreStatusLabel(pct, attempts);

  return (
    <div
      className="flex items-start gap-3 py-3"
      style={{ borderBottom: `1px solid ${TELEMETRY.borderSoft}` }}
    >
      <span
        className="inline-block w-1 rounded-full flex-shrink-0 mt-1"
        style={{
          height: 32,
          background: color,
          boxShadow: attempts > 0 || awaiting ? `0 0 8px ${alpha(color, 0.4)}` : undefined,
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          className={`text-[13px] font-medium capitalize break-words ${
            compact ? "line-clamp-1" : "line-clamp-2"
          }`}
          style={{ color: TELEMETRY.text, lineHeight: 1.3 }}
        >
          {topic.topic}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              color,
              background: alpha(color, 0.08),
              border: `1px solid ${alpha(color, 0.2)}`,
            }}
          >
            {status}
          </span>
          {topic.subjectId && (
            <span
              className="text-[10px] truncate"
              style={{ color: TELEMETRY.muted }}
            >
              {topic.subjectId}
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0 w-14">
        <div
          className="text-[14px] font-semibold tabular-nums"
          style={{ color: awaiting ? TELEMETRY.info : TELEMETRY.text }}
        >
          {attempts > 0 ? `${pct}%` : awaiting ? "··" : "—"}
        </div>
        <div className="text-[9px] tabular-nums" style={{ color: TELEMETRY.muted }}>
          {attempts > 0
            ? `${attempts} marked`
            : awaiting
            ? `${pending} pending`
            : "no data"}
        </div>
      </div>
    </div>
  );
};
