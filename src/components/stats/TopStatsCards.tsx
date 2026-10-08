import { ChevronRight } from "lucide-react";

interface TopStatsCardsProps {
  totalExams: number;
  completedExams: number;
  inProgressExams: number;
  currentStreak: number;
  longestStreak: number;
  avgScore?: number;
  totalStudyHours?: number;
  bestSubject?: { name: string; avgScore: number; color: string } | null;
  onCardClick?: (type: "exams" | "scores" | "study-hours" | "streak") => void;
  variant?: "wrap" | "grid" | "grid-no-score" | "snapshot";
}

export const TopStatsCards = ({
  totalExams,
  completedExams,
  inProgressExams,
  avgScore = 0,
  totalStudyHours = 0,
  currentStreak,
  longestStreak,
  bestSubject,
  onCardClick,
  variant = "wrap",
}: TopStatsCardsProps) => {
  const cards = [
    {
      label: "Average exam score",
      value: completedExams > 0 ? `${avgScore}%` : "—",
      detail: bestSubject
        ? `Strongest: ${bestSubject.name} · ${Math.round(bestSubject.avgScore)}%`
        : "From your graded exams",
      type: "scores" as const,
    },
    {
      label: "Exams completed",
      value: String(completedExams),
      detail: `${totalExams} published papers · ${inProgressExams} remaining`,
      type: "exams" as const,
    },
    {
      label: "Study time this week",
      value: `${totalStudyHours.toFixed(1)}h`,
      detail: "Revision, exams and practice",
      type: "study-hours" as const,
    },
    {
      label: "Revision streak",
      value: `${currentStreak}`,
      detail: `days · best run ${longestStreak} days`,
      type: "streak" as const,
    },
  ];
  const content = (
    <div
      className={`grid grid-cols-2 gap-3 ${variant === "wrap" ? "lg:grid-cols-4" : ""} ${variant === "snapshot" ? "stats-snapshot-grid" : ""}`}
    >
      {cards
        .filter((c) => variant !== "grid-no-score" || c.type !== "scores")
        .map((card) => (
          <button
            key={card.type}
            type="button"
            onClick={() => onCardClick?.(card.type)}
            className={
              variant === "snapshot"
                ? "stats-snapshot-metric"
                : "stats-panel group flex min-h-[145px] flex-col items-start p-4 text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
            }
            data-metric={card.type}
            aria-label={`${card.label}: ${card.value}. ${card.detail}. View details`}
          >
            <span className="flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
              {card.label}
              <ChevronRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
            </span>
            <span
              className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${card.type === "scores" ? "text-primary" : "text-foreground"}`}
            >
              {card.value}
            </span>
            <span className="mt-auto pt-3 text-xs leading-relaxed text-muted-foreground">
              {card.detail}
            </span>
          </button>
        ))}
    </div>
  );
  return variant === "snapshot" ? (
    <section className="stats-panel stats-snapshot" aria-label="At a glance">
      <h2>At a glance</h2>
      {content}
    </section>
  ) : (
    content
  );
};
