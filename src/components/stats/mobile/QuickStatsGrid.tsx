import { ChevronRight } from "lucide-react";
import { useTelemetry, clampPct } from "./tokens";
import type { SubjectStack } from "./SubjectStackedBars";
import { StatsGauge } from "../StatsGauge";

interface Props {
  accuracy: number; // 0..100
  accuracySessions: number[]; // (unused now — kept for API compat)
  subjectStacks: SubjectStack[]; // for the Accuracy mini-viz
  gradeValue: string; // e.g. "1 / 1"
  gradeDelta?: string;
  gradeTone?: "up" | "down" | "neutral";
  gradeProgress: number | null; // 0..100 or null when no targets set
  gradeAccent: string; // subject-tinted fill colour
  gradeTrajectory: number[]; // kept for API compat
  masteredCount: number;
  developingCount: number;
  reviewCount: number;
  totalAttempted: number;
  masteredHistory: number[]; // mastery trend sparkline data
  streak: number;
  longestStreak: number;
  streakDays: boolean[];
  streakLoads?: number[];
  onOpenAccuracy?: () => void;
  onOpenGrade?: () => void;
  onOpenMastered?: () => void;
  onOpenStreak?: () => void;
  hideAccuracy?: boolean;
  hideMastery?: boolean;
  hideStreak?: boolean;
}

export const QuickStatsGrid = ({
  accuracy,
  gradeValue,
  gradeDelta,
  gradeProgress,
  masteredCount,
  developingCount,
  reviewCount,
  totalAttempted,
  streak,
  longestStreak,
  streakDays,
  onOpenAccuracy,
  onOpenGrade,
  onOpenMastered,
  onOpenStreak,
  hideAccuracy = false,
  hideMastery = false,
  hideStreak = false,
}: Props) => {
  const p = useTelemetry();
  const cards = [
    {
      label: "Topic accuracy",
      value: `${Math.round(accuracy)}%`,
      detail: "Average across marked topics",
      progress: clampPct(accuracy),
      onClick: onOpenAccuracy,
    },
    {
      label: "Grade targets met",
      value: gradeValue,
      detail: gradeDelta || "Set a target per subject",
      progress: gradeProgress,
      onClick: onOpenGrade,
    },
    {
      label: "Mastered topics",
      value: totalAttempted > 0 ? `${masteredCount} / ${totalAttempted}` : "0",
      detail: `${developingCount} developing · ${reviewCount} to review`,
      progress: totalAttempted > 0 ? (masteredCount / totalAttempted) * 100 : 0,
      onClick: onOpenMastered,
    },
    {
      label: "Revision streak",
      value: `${streak} days`,
      detail: `Best run: ${longestStreak} days`,
      progress: null,
      onClick: onOpenStreak,
    },
  ];
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return (
    <section
      className="stats-panel stats-mobile-snapshot"
      aria-label="At a glance"
    >
      <h2>{hideMastery && hideStreak ? "Grade targets" : "At a glance"}</h2>
      <div
        className={`stats-quick-layout ${hideAccuracy && !hideMastery ? "stats-quick-without-accuracy" : ""} ${hideAccuracy && hideMastery && hideStreak ? "stats-quick-grades" : ""}`}
      >
        {cards
          .filter(
            (card) =>
              (!hideAccuracy || card.label !== "Topic accuracy") &&
              (!hideMastery || card.label !== "Mastered topics") &&
              (!hideStreak || card.label !== "Revision streak"),
          )
          .map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              aria-label={`${card.label}: ${card.value}. ${card.detail}. View details`}
              className="stats-quick-metric"
              data-metric={
                card.label === "Mastered topics"
                  ? "mastery"
                  : card.label === "Revision streak"
                    ? "streak"
                    : card.label === "Grade targets met"
                      ? "grade"
                      : "accuracy"
              }
            >
              <span
                className="flex w-full items-start justify-between gap-1 text-xs font-medium"
                style={{ color: p.muted }}
              >
                {card.label}
                <ChevronRight
                  size={14}
                  className="shrink-0"
                  aria-hidden="true"
                />
              </span>
              {card.label === "Mastered topics" ? (
                <StatsGauge
                  shape="ring"
                  value={totalAttempted > 0 ? card.progress : null}
                  label="Mastered topics as a share of marked topics"
                  valueLabel={card.value}
                  colour="var(--stats-series-3)"
                />
              ) : (
                <span
                  className="mt-2 text-[26px] font-semibold leading-tight tabular-nums"
                  style={{ color: p.text }}
                >
                  {card.value}
                </span>
              )}
              <span
                className="mt-2 text-xs leading-relaxed"
                style={{ color: p.muted }}
              >
                {card.detail}
              </span>
              <span className="mt-auto block w-full pt-3" aria-hidden="true">
                {card.label === "Revision streak" ? (
                  <span className="flex gap-1">
                    {days.map((day, i) => (
                      <span
                        key={day}
                        title={`${day}: ${streakDays[i] ? "study logged" : "no study logged"}`}
                        className="flex h-5 min-w-0 flex-1 items-center justify-center rounded text-[10px]"
                        style={{
                          background: streakDays[i] ? p.info : p.cardAlt,
                          color: streakDays[i] ? p.onAccent : p.muted,
                        }}
                      >
                        {day[0]}
                      </span>
                    ))}
                  </span>
                ) : card.label !== "Mastered topics" &&
                  card.progress !== null ? (
                  <span
                    className="block h-1.5 overflow-hidden rounded-full"
                    style={{ background: p.cardAlt }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${clampPct(card.progress ?? 0)}%`,
                        background: p.info,
                      }}
                    />
                  </span>
                ) : null}
              </span>
            </button>
          ))}
      </div>
    </section>
  );
};
