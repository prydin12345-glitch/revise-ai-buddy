import { useNavigate } from "react-router-dom";
import { useTopicPerformance } from "@/hooks/useTopicPerformance";

interface TopicMasteryGridProps {
  subjectName: string;
  topics: string[];
}

type Band = "review" | "developing" | "mastered" | "untested";

/* Same 70 / 50 thresholds the panel has always used — only the presentation
   changed. Each band gets its own token set so the colour comes from the
   theme (success / warning / danger) rather than being picked per row. */
const BANDS: Record<Band, { label: string; text: string; dot: string; fill: string }> = {
  review:     { label: "Needs review",   text: "text-danger",  dot: "bg-danger",  fill: "bg-danger/70" },
  developing: { label: "Developing",     text: "text-warning", dot: "bg-warning", fill: "bg-warning/70" },
  mastered:   { label: "Mastered",       text: "text-success", dot: "bg-success", fill: "bg-success/70" },
  untested:   { label: "Not yet tested", text: "text-muted-foreground", dot: "bg-border-strong", fill: "" },
};

const ORDER: Band[] = ["review", "developing", "mastered", "untested"];

const bandOf = (score: number, attempts: number): Band => {
  if (attempts === 0) return "untested";
  const s = Math.max(0, Math.round(score));
  if (s >= 70) return "mastered";
  if (s >= 50) return "developing";
  return "review";
};

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

  const grouped: Record<Band, typeof sorted> = { review: [], developing: [], mastered: [], untested: [] };
  sorted.forEach((row) => grouped[bandOf(row.score, row.attempts)].push(row));

  return (
    <div className="space-y-5">
      {ORDER.filter((band) => grouped[band].length > 0).map((band) => {
        const cfg = BANDS[band];
        return (
          <div key={band}>
            <div className={`text-11 font-semibold mb-1 ${cfg.text}`}>
              {cfg.label}
              <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
                {grouped[band].length}
              </span>
            </div>

            <ul className="divide-y divide-border/70 border-t border-border/70">
              {grouped[band].map(({ topic, score, attempts }) => {
                const untested = band === "untested";
                const displayScore = Math.max(0, Math.round(score));

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
                      className="group w-full flex items-center gap-3 py-2.5 px-1 text-left hover:bg-foreground/[0.02] rounded-md transition-colors"
                    >
                      <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span
                        className={`min-w-0 flex-1 text-13 font-medium leading-snug break-words ${
                          untested ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {topic}
                      </span>

                      {/* An untested topic gets a visible dashed track, not a
                          zero-width fill — that read as a broken bar. */}
                      <div
                        className={`hidden sm:block w-16 h-1 rounded-full overflow-hidden shrink-0 ${
                          untested ? "border border-dashed border-border-strong" : "bg-track"
                        }`}
                      >
                        {!untested && (
                          <div
                            className={`h-full ${cfg.fill} transition-all`}
                            style={{ width: `${displayScore}%` }}
                          />
                        )}
                      </div>

                      {/* "—" for untested: the band header above already says
                          "Not yet tested", so repeating "No attempts yet" on every
                          row was noise. Tested rows keep the question count, since
                          a score is only as meaningful as what backs it. */}
                      <span
                        className={`w-20 text-right shrink-0 text-xs tabular-nums ${
                          untested ? "text-muted-foreground/70 font-normal" : `${cfg.text} font-semibold`
                        }`}
                      >
                        {untested ? "—" : `${displayScore}% · ${attempts}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
