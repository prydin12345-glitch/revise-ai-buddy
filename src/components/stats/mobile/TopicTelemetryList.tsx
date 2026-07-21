import { Activity, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TopicTelemetryRow } from "./TopicTelemetryRow";
import { TELEMETRY } from "./tokens";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface Props {
  topics: UnifiedTopicScore[];
}

export const TopicTelemetryList = ({ topics }: Props) => {
  const navigate = useNavigate();
  const rows = topics.slice(0, 8);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity size={14} style={{ color: TELEMETRY.cyan }} />
          <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
            Topic Telemetry
          </div>
        </div>
        {topics.length > rows.length && (
          <button
            onClick={() => navigate("/stats?tab=weak-topics")}
            className="min-h-[44px] flex items-center gap-0.5 text-[11px] font-medium"
            style={{ color: TELEMETRY.cyan }}
          >
            View all <ChevronRight size={12} />
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-xs" style={{ color: TELEMETRY.muted }}>
          Complete a quiz or exam to populate telemetry
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
