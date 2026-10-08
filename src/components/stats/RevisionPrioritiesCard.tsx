import type { ReactNode } from "react";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";
import { Skeleton } from "@/components/ui/skeleton";

export function RevisionPrioritiesCard({
  topics,
  loading,
  action,
  limit = 4,
}: {
  topics: UnifiedTopicScore[];
  loading: boolean;
  action?: ReactNode;
  limit?: number;
}) {
  const priorities = [...topics]
    .filter((t) => t.examQuestionCount + t.practiceQuestionCount > 0)
    .sort((a, b) => a.unifiedScore - b.unifiedScore)
    .slice(0, limit);
  return (
    <section className="stats-priorities" aria-label="Revision priorities">
      <div className="stats-section-heading">
        <div>
          <h2>Revision priorities</h2>
          <p>Start with your lowest-scoring topics</p>
        </div>
        {action}
      </div>
      {loading ? (
        <div
          className="space-y-3"
          role="status"
          aria-label="Loading revision priorities"
        >
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : priorities.length === 0 ? (
        <p className="stats-panel p-5 text-sm text-muted-foreground">
          Complete a quiz or exam to find your next revision focus.
        </p>
      ) : (
        <ol>
          {priorities.map((topic, index) => (
            <li key={`${topic.subjectId}-${topic.topic}`}>
              <span className="stats-priority-rank" aria-hidden="true">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3>{topic.topic}</h3>
                <p>
                  {topic.subjectId || "Marked work"} ·{" "}
                  {topic.examQuestionCount + topic.practiceQuestionCount} marked
                  questions
                </p>
              </div>
              <span className="stats-priority-score">
                {Math.round(topic.unifiedScore)}%
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
