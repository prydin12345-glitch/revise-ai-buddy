import { Layers, ChevronRight } from "lucide-react";
import { TopicTelemetryRow } from "./TopicTelemetryRow";
import { TELEMETRY } from "./tokens";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface Props {
  topics: UnifiedTopicScore[];
  limit?: number;
  onViewAll?: () => void;
  title?: string;
}

export const TopicTelemetryList = ({
  topics,
  limit,
  onViewAll,
  title = "Topic Mastery",
}: Props) => {
  const rows = typeof limit === "number" ? topics.slice(0, limit) : topics;
  const hasMore = typeof limit === "number" && topics.length > rows.length;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Layers size={14} style={{ color: TELEMETRY.cyan }} />
          <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
            {title}
          </div>
        </div>
        {(hasMore || onViewAll) && onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="min-h-[36px] flex items-center gap-0.5 text-[11px] font-semibold"
            style={{ color: TELEMETRY.cyan }}
          >
            View all topics <ChevronRight size={12} />
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-xs" style={{ color: TELEMETRY.muted }}>
          Complete a quiz or exam to populate mastery
        </div>
      ) : (
        <div>
          {rows.map((t) => (
            <TopicTelemetryRow key={t.topic} topic={t} />
          ))}
        </div>
      )}
    </div>
  );
};
