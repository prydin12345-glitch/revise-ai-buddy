import { useNavigate } from "react-router-dom";
import { useTopicPerformance } from "@/hooks/useTopicPerformance";

interface TopicMasteryGridProps {
  subjectName: string;
  topics: string[];
}

export const TopicMasteryGrid = ({ subjectName, topics }: TopicMasteryGridProps) => {
  const navigate = useNavigate();
  const { getPerformance, loading } = useTopicPerformance(subjectName);

  if (loading) {
    return (
      <div className="space-y-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center">
        <p className="text-13 text-muted-foreground">
          No topics added yet. Add topics to this subject to see performance data.
        </p>
      </div>
    );
  }

  const scored = topics.map((topic) => {
    const perf = getPerformance(topic);
    return { topic, score: perf.percentage, attempts: perf.questionsAttempted };
  });

  const sorted = scored.sort((a, b) => {
    if (a.attempts === 0 && b.attempts > 0) return 1;
    if (b.attempts === 0 && a.attempts > 0) return -1;
    return a.score - b.score;
  });

  return (
    <ul className="divide-y divide-border/70">
      {sorted.map(({ topic, score, attempts }) => {
        const untested = attempts === 0;
        const displayScore = Math.max(0, Math.round(score));

        const dot = untested
          ? "bg-border-strong"
          : displayScore >= 70
          ? "bg-success"
          : displayScore >= 50
          ? "bg-warning"
          : "bg-danger";

        const barFill = untested
          ? "bg-border-strong"
          : displayScore >= 70
          ? "bg-success/70"
          : displayScore >= 50
          ? "bg-warning/70"
          : "bg-danger/70";

        const pctColor = untested
          ? "text-muted-foreground/70"
          : displayScore >= 70
          ? "text-success"
          : displayScore >= 50
          ? "text-warning"
          : "text-danger";

        return (
          <li key={topic}>
            <button
              onClick={() =>
                navigate(
                  `/create-practice-questions?source=weak_topics&subject=${encodeURIComponent(
                    subjectName
                  )}&subtopic=${encodeURIComponent(topic)}`
                )
              }
              className="group w-full flex items-center gap-4 py-3 px-1 text-left hover:bg-foreground/[0.02] rounded-md transition-colors"
            >
              <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              <span className="min-w-0 flex-1 text-13 font-medium text-foreground leading-snug break-words">
                {topic}
              </span>

              <div className="hidden sm:block w-24 h-1 rounded-full bg-track overflow-hidden shrink-0">
                <div
                  className={`h-full ${barFill} transition-all`}
                  style={{ width: `${untested ? 0 : displayScore}%` }}
                />
              </div>

              <span
                className={`w-24 text-right shrink-0 text-xs tabular-nums ${pctColor} ${
                  untested ? "font-normal" : "font-semibold"
                }`}
              >
                {untested
                  ? "No attempts yet"
                  : `${displayScore}% · ${attempts}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
