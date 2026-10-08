import { ChevronRight } from "lucide-react";
import { useTelemetry, clampPct } from "./tokens";
import type { SubjectStack } from "./SubjectStackedBars";

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
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card, index) => (
        <button
          key={card.label}
          type="button"
          onClick={card.onClick}
          aria-label={`${card.label}: ${card.value}. ${card.detail}. View details`}
          className="flex min-h-[156px] min-w-0 flex-col rounded-xl p-4 text-left hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          style={{ background: p.card, border: `1px solid ${p.border}` }}
        >
          <span
            className="flex w-full items-start justify-between gap-1 text-xs font-medium"
            style={{ color: p.muted }}
          >
            {card.label}
            <ChevronRight size={14} className="shrink-0" aria-hidden="true" />
          </span>
          <span
            className="mt-2 text-[26px] font-semibold leading-tight tabular-nums"
            style={{ color: index === 0 ? p.info : p.text }}
          >
            {card.value}
          </span>
          <span
            className="mt-2 text-xs leading-relaxed"
            style={{ color: p.muted }}
          >
            {card.detail}
          </span>
          <span className="mt-auto block w-full pt-3" aria-hidden="true">
            {index === 3 ? (
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
            ) : (
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
            )}
          </span>
        </button>
      ))}
    </div>
  );
};
