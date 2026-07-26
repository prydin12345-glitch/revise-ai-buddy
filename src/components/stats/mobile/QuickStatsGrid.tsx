import { Target, Flame, GraduationCap, CheckCircle2 } from "lucide-react";
import { SparklineCard } from "./SparklineCard";
import { useTelemetry } from "./tokens";

interface Props {
  accuracy: number;               // 0..100
  accuracySeries: number[];
  /** Pre-formatted, e.g. "2 / 4" subjects on target. Grades are per-subject,
   *  so this tile summarises rather than inventing one grade for everything. */
  gradeValue: string;
  gradeDelta?: string;
  gradeTone?: "up" | "down" | "neutral";
  masteredCount: number;
  totalAttempted: number;
  streak: number;
  longestStreak: number;
  onOpenAccuracy?: () => void;
  onOpenGrade?: () => void;
  onOpenMastered?: () => void;
  onOpenStreak?: () => void;
}

export const QuickStatsGrid = ({
  accuracy,
  accuracySeries,
  gradeValue,
  gradeDelta,
  gradeTone = "neutral",
  masteredCount,
  totalAttempted,
  streak,
  longestStreak,
  onOpenAccuracy,
  onOpenGrade,
  onOpenMastered,
  onOpenStreak,
}: Props) => {
  const TELEMETRY = useTelemetry();
  const masteredValue =
    totalAttempted > 0 ? `${masteredCount} / ${totalAttempted}` : "0";
  const masteredDelta =
    totalAttempted > 0
      ? `${Math.round((masteredCount / totalAttempted) * 100)}%`
      : "—";

  const streakDelta = longestStreak > 0 ? `best ${longestStreak}d` : undefined;

  return (
    <div className="grid grid-cols-2 gap-3">
      <SparklineCard
        icon={Target}
        label="Accuracy"
        value={`${Math.round(accuracy)}%`}
        accent={TELEMETRY.lime}
        sparkline={accuracySeries}
        onClick={onOpenAccuracy}
      />
      <SparklineCard
        icon={GraduationCap}
        label="Target grades"
        value={gradeValue}
        accent={TELEMETRY.cyan}
        sparkline={[]}
        delta={gradeDelta}
        deltaTone={gradeTone}
        onClick={onOpenGrade}
      />
      <SparklineCard
        icon={CheckCircle2}
        label="Mastered"
        value={masteredValue}
        accent={TELEMETRY.amber}
        sparkline={[]}
        delta={masteredDelta}
        onClick={onOpenMastered}
      />
      <SparklineCard
        icon={Flame}
        label="Revision Streak"
        value={`${streak}d`}
        accent={TELEMETRY.magenta}
        sparkline={[]}
        delta={streakDelta}
        onClick={onOpenStreak}
      />
    </div>
  );
};
