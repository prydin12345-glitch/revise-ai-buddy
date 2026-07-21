import { Target, Flame, Timer, TrendingUp } from "lucide-react";
import { SparklineCard } from "./SparklineCard";
import { TELEMETRY } from "./tokens";

interface Props {
  accuracy: number;              // 0..100
  accuracySeries: number[];
  streak: number;
  longestStreak: number;
  avgTimePerQ: number | null;    // seconds; null if not enough data
  timeSeries: number[];
  velocitySeries: number[];      // recent scores
}

const formatTime = (sec: number) => {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
};

export const QuickStatsGrid = ({
  accuracy,
  accuracySeries,
  streak,
  longestStreak,
  avgTimePerQ,
  timeSeries,
  velocitySeries,
}: Props) => {
  // Mastery velocity — slope over recent scores
  let velocityDisplay = "Building…";
  let velocityDelta: string | undefined;
  let velocityTone: "up" | "down" | "neutral" = "neutral";
  if (velocitySeries.length >= 2) {
    const first = velocitySeries[0];
    const last = velocitySeries[velocitySeries.length - 1];
    const diff = last - first;
    const perWeek = diff / Math.max(1, velocitySeries.length - 1);
    velocityDisplay = `${perWeek >= 0 ? "+" : ""}${perWeek.toFixed(1)}%`;
    velocityDelta = `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(0)}%`;
    velocityTone = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
  }

  const streakDelta =
    longestStreak > 0 ? `best ${longestStreak}d` : undefined;

  return (
    <div className="grid grid-cols-2 gap-3">
      <SparklineCard
        icon={Target}
        label="Accuracy"
        value={`${Math.round(accuracy)}%`}
        accent={TELEMETRY.lime}
        sparkline={accuracySeries}
        delta={accuracySeries.length >= 2 ? undefined : "—"}
      />
      <SparklineCard
        icon={Flame}
        label="Streak"
        value={`${streak}d`}
        accent={TELEMETRY.magenta}
        sparkline={[]}
        delta={streakDelta}
      />
      <SparklineCard
        icon={Timer}
        label="Avg / Question"
        value={avgTimePerQ != null ? formatTime(avgTimePerQ) : "—"}
        accent={TELEMETRY.cyan}
        sparkline={timeSeries}
      />
      <SparklineCard
        icon={TrendingUp}
        label="Velocity"
        value={velocityDisplay}
        accent={TELEMETRY.amber}
        sparkline={velocitySeries}
        delta={velocityDelta}
        deltaTone={velocityTone}
      />
    </div>
  );
};
