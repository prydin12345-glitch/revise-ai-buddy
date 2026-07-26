import { Target, Flame, GraduationCap, CheckCircle2 } from "lucide-react";
import { SparklineCard } from "./SparklineCard";
import { useTelemetry } from "./tokens";

export const scoreToGradeTier = (pct: number): { grade: string; band: string } => {
  if (pct >= 90) return { grade: "9", band: "A**" };
  if (pct >= 80) return { grade: "8", band: "A*" };
  if (pct >= 70) return { grade: "7", band: "A" };
  if (pct >= 60) return { grade: "6", band: "B" };
  if (pct >= 50) return { grade: "5", band: "C" };
  if (pct >= 40) return { grade: "4", band: "C-" };
  if (pct >= 30) return { grade: "3", band: "D" };
  if (pct >= 20) return { grade: "2", band: "E" };
  return { grade: "1", band: "U" };
};

interface Props {
  accuracy: number;               // 0..100
  accuracySeries: number[];
  currentPct: number;             // predicted grade %
  goalPct: number;                // e.g. 80
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
  currentPct,
  goalPct,
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
  const current = scoreToGradeTier(currentPct);
  const goal = scoreToGradeTier(goalPct);
  const gradeDelta =
    currentPct >= goalPct
      ? "on target"
      : `▲ ${Math.round(goalPct - currentPct)}% to go`;
  const gradeTone: "up" | "down" | "neutral" =
    currentPct >= goalPct ? "up" : "down";

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
        label="Predicted → Goal"
        value={`G${current.grade} → G${goal.grade}`}
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
