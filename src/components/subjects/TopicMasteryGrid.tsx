import { useNavigate } from "react-router-dom";
import { useTopicPerformance } from "@/hooks/useTopicPerformance";

interface TopicMasteryGridProps {
  subjectName: string;
  topics: string[]; // full topic list for this subject
}

export const TopicMasteryGrid = ({ subjectName, topics }: TopicMasteryGridProps) => {
  const navigate = useNavigate();
  const { getPerformance, loading } = useTopicPerformance(subjectName);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
        <p className="text-[13px] text-muted-foreground">
          No topics added yet. Add topics to this subject to see performance data.
        </p>
      </div>
    );
  }

  const scored = topics.map((topic) => {
    const perf = getPerformance(topic);
    return { topic, score: perf.percentage, attempts: perf.questionsAttempted };
  });

  // Weakest (attempted) first, then untested at the end
  const sorted = scored.sort((a, b) => {
    if (a.attempts === 0 && b.attempts > 0) return 1;
    if (b.attempts === 0 && a.attempts > 0) return -1;
    return a.score - b.score;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {sorted.map(({ topic, score, attempts }) => {
        const untested = attempts === 0;
        const bg = untested
          ? "bg-muted/40 border-border/60"
          : score >= 70
          ? "bg-green-500/10 border-green-500/20"
          : score >= 50
          ? "bg-amber-500/10 border-amber-500/20"
          : "bg-red-500/10 border-red-500/20";
        const textColor = untested
          ? "text-muted-foreground"
          : score >= 70
          ? "text-green-600"
          : score >= 50
          ? "text-amber-600"
          : "text-red-500";

        return (
          <button
            key={topic}
            onClick={() =>
              navigate(
                `/create-practice-questions?source=weak_topics&subject=${encodeURIComponent(
                  subjectName
                )}&subtopic=${encodeURIComponent(topic)}`
              )
            }
            className={`group text-left rounded-xl border p-3.5 hover:shadow-sm transition-all duration-150 ${bg}`}
          >
            <div className={`text-2xl font-bold tabular-nums ${textColor}`}>
              {untested ? "—" : `${Math.round(score)}%`}
            </div>
            <div className="text-[12px] font-medium text-foreground mt-1 line-clamp-2 leading-snug">
              {topic}
            </div>
            <div className="text-[10.5px] text-muted-foreground mt-1">
              {untested
                ? "No attempts"
                : `${attempts} attempt${attempts !== 1 ? "s" : ""}`}
            </div>
          </button>
        );
      })}
    </div>
  );
};
