import { motion } from "framer-motion";
import { useMemo } from "react";
import { ReadinessRing } from "./ReadinessRing";
import { QuickStatsGrid } from "./QuickStatsGrid";
import { ScoreTrendCard } from "./ScoreTrendCard";
import { TopicTelemetryList } from "./TopicTelemetryList";
import { SkillRadarCard } from "./SkillRadarCard";
import { TELEMETRY, clampPct } from "./tokens";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface Props {
  avgScore: number;
  currentStreak: number;
  longestStreak: number;
  subjectPerformanceData: { name: string; color: string; avgScore: number; count: number }[];
  examResultsData: Array<Record<string, any>>;
  studyActivityData: Array<Record<string, any>>;
  timeRange: "weekly" | "monthly" | "yearly";
  setTimeRange: (v: "weekly" | "monthly" | "yearly") => void;
  topics: UnifiedTopicScore[];
}

const section = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
});

export const MobileStatsTelemetry = ({
  avgScore,
  currentStreak,
  longestStreak,
  subjectPerformanceData,
  examResultsData,
  studyActivityData,
  timeRange,
  setTimeRange,
  topics,
}: Props) => {
  // Derived telemetry values
  const coverage = useMemo(() => {
    const tested = topics.filter((t) => t.mastery !== "untested").length;
    // Aim ~20 topics as a healthy coverage baseline
    return clampPct((tested / 20) * 100);
  }, [topics]);

  const consistency = useMemo(() => {
    const base = Math.max(longestStreak, 7);
    return clampPct((currentStreak / base) * 100);
  }, [currentStreak, longestStreak]);

  const accuracy = useMemo(() => {
    if (topics.length === 0) return avgScore;
    const total = topics.reduce((s, t) => s + t.unifiedScore, 0);
    return total / topics.length;
  }, [topics, avgScore]);

  // Flatten score series from exam results
  const scoreSeries = useMemo(() => {
    return examResultsData
      .map((row) => {
        const vals = Object.entries(row)
          .filter(([k, v]) => k !== "period" && typeof v === "number")
          .map(([, v]) => v as number);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      })
      .filter((v): v is number => v != null);
  }, [examResultsData]);

  // Study hours series (per day) for time sparkline
  const hoursSeries = useMemo(() => {
    return studyActivityData.map((row) => {
      let sum = 0;
      Object.entries(row).forEach(([k, v]) => {
        if (k !== "day" && typeof v === "number") sum += v;
      });
      return sum;
    });
  }, [studyActivityData]);

  // Avg time per question — rough estimate: total hours / total attempts
  const avgTimePerQ = useMemo(() => {
    const totalSec = hoursSeries.reduce((a, b) => a + b, 0) * 3600;
    const totalQ = topics.reduce(
      (s, t) => s + t.examQuestionCount + t.practiceQuestionCount,
      0
    );
    if (totalQ === 0 || totalSec === 0) return null;
    return totalSec / totalQ;
  }, [hoursSeries, topics]);

  return (
    <div
      className="stats-telemetry -mx-3 px-3 pt-3 pb-8 min-h-screen"
      style={{ background: TELEMETRY.bg, color: TELEMETRY.text }}
    >
      <div className="max-w-md mx-auto space-y-4">
        <motion.div {...section(0)}>
          <ReadinessRing overall={avgScore} coverage={coverage} consistency={consistency} />
        </motion.div>

        <motion.div {...section(0.06)}>
          <QuickStatsGrid
            accuracy={accuracy}
            accuracySeries={scoreSeries.slice(-7)}
            streak={currentStreak}
            longestStreak={longestStreak}
            avgTimePerQ={avgTimePerQ}
            timeSeries={hoursSeries.slice(-7)}
            velocitySeries={scoreSeries.slice(-7)}
          />
        </motion.div>

        <motion.div {...section(0.12)}>
          <ScoreTrendCard
            data={examResultsData}
            subjects={subjectPerformanceData}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </motion.div>

        <motion.div {...section(0.18)}>
          <TopicTelemetryList topics={topics} />
        </motion.div>

        <motion.div {...section(0.24)}>
          <SkillRadarCard subjects={subjectPerformanceData} />
        </motion.div>
      </div>
    </div>
  );
};
