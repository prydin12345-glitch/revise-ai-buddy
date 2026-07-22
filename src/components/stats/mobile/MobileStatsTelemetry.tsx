import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Info, Radar as RadarIcon, TrendingUp, Layers } from "lucide-react";
import { ReadinessRing } from "./ReadinessRing";
import { QuickStatsGrid } from "./QuickStatsGrid";
import { ScoreTrendCard } from "./ScoreTrendCard";
import { TopicTelemetryList } from "./TopicTelemetryList";
import { TopicTelemetryRow } from "./TopicTelemetryRow";
import { SkillRadarCard } from "./SkillRadarCard";
import { MobileStatSheet } from "./MobileStatSheet";
import { TELEMETRY, clampPct, buildSparklinePath } from "./tokens";
import { supabase } from "@/integrations/supabase/client";
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

type SheetKey = null | "readiness" | "trend" | "topics" | "radar";

const section = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

const formatTime = (sec: number) => {
  if (!Number.isFinite(sec) || sec <= 0) return "No data";
  if (sec < 60) return `${Math.round(sec)}s/q`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s/q` : `${m}m/q`;
};

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
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [totalStudySeconds, setTotalStudySeconds] = useState<number | null>(null);

  // Derived hub metrics
  const coverage = useMemo(() => {
    const tested = topics.filter((t) => t.mastery !== "untested").length;
    return clampPct((tested / 20) * 100);
  }, [topics]);

  const consistency = useMemo(() => {
    const base = Math.max(longestStreak, 7);
    return clampPct((currentStreak / base) * 100);
  }, [currentStreak, longestStreak]);

  const accuracy = useMemo(() => {
    const tested = topics.filter((t) => t.mastery !== "untested");
    if (tested.length === 0) return avgScore;
    const total = tested.reduce((s, t) => s + t.unifiedScore, 0);
    return total / tested.length;
  }, [topics, avgScore]);

  const totalAttempts = useMemo(
    () => topics.reduce((s, t) => s + t.examQuestionCount + t.practiceQuestionCount, 0),
    [topics]
  );

  // Fetch REAL total study time (seconds) — replaces the broken 7-day sum
  // that made "Avg / Question" always render "—".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: exams }, { data: prog }] = await Promise.all([
          supabase
            .from("exam_submissions")
            .select("time_taken_seconds")
            .eq("student_id", user.id)
            .in("status", ["submitted", "completed", "graded"]),
          supabase
            .from("practice_set_progress")
            .select("time_spent_seconds")
            .eq("user_id", user.id)
            .not("completed_at", "is", null),
        ]);
        if (cancelled) return;
        const eSec = (exams ?? []).reduce(
          (s, r: any) => s + (Number(r.time_taken_seconds) || 0),
          0
        );
        const pSec = (prog ?? []).reduce(
          (s, r: any) => s + (Number(r.time_spent_seconds) || 0),
          0
        );
        setTotalStudySeconds(eSec + pSec);
      } catch {
        if (!cancelled) setTotalStudySeconds(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const avgTimePerQ = useMemo(() => {
    if (totalStudySeconds == null || totalAttempts === 0) return null;
    if (totalStudySeconds === 0) return null;
    return totalStudySeconds / totalAttempts;
  }, [totalStudySeconds, totalAttempts]);

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

  const hoursSeries = useMemo(
    () =>
      studyActivityData.map((row) => {
        let sum = 0;
        Object.entries(row).forEach(([k, v]) => {
          if (k !== "day" && typeof v === "number") sum += v;
        });
        return sum;
      }),
    [studyActivityData]
  );

  // Sorted topics: attempted first, weakest surfaced (lowest score) at top for priority.
  const priorityTopics = useMemo(() => {
    const attempted = topics.filter(
      (t) => t.examQuestionCount + t.practiceQuestionCount > 0
    );
    return [...attempted].sort((a, b) => a.unifiedScore - b.unifiedScore);
  }, [topics]);

  const topicSummary = useMemo(() => {
    const attempted = priorityTopics.length;
    const needsReview = priorityTopics.filter((t) => t.unifiedScore < 40).length;
    return { attempted, needsReview, total: topics.length };
  }, [priorityTopics, topics]);

  const trendSpark = scoreSeries.slice(-8);
  const sparkPath = buildSparklinePath(trendSpark, 140, 36);

  return (
    <div
      className="stats-telemetry -mx-3 px-3 pt-3 pb-32 min-h-screen"
      style={{ background: TELEMETRY.bg, color: TELEMETRY.text }}
    >
      <div className="max-w-md mx-auto space-y-4">
        {/* Readiness hero — tap for breakdown */}
        <motion.button
          {...section(0)}
          onClick={() => setSheet("readiness")}
          className="w-full text-left relative"
          aria-label="Open readiness breakdown"
        >
          <ReadinessRing overall={avgScore} coverage={coverage} consistency={consistency} />
          <span
            className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{
              background: TELEMETRY.card,
              border: `1px solid ${TELEMETRY.border}`,
              color: TELEMETRY.muted,
            }}
          >
            <Info size={11} /> How this works
          </span>
        </motion.button>

        {/* Quick stats — kept inline (compact, high-signal) */}
        <motion.div {...section(0.05)}>
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

        {/* Score Trends tile — opens full chart */}
        <motion.button
          {...section(0.1)}
          onClick={() => setSheet("trend")}
          className="w-full text-left rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
          style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${TELEMETRY.lime}1a`, border: `1px solid ${TELEMETRY.lime}33` }}
          >
            <TrendingUp size={18} style={{ color: TELEMETRY.lime }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: TELEMETRY.muted }}>
              Score Trends
            </div>
            <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
              Performance Over Time
            </div>
          </div>
          {sparkPath && (
            <svg width={100} height={32} viewBox="0 0 140 36" preserveAspectRatio="none" className="flex-shrink-0">
              <path d={sparkPath} fill="none" stroke={TELEMETRY.lime} strokeWidth={2} />
            </svg>
          )}
          <ChevronRight size={16} style={{ color: TELEMETRY.muted }} className="flex-shrink-0" />
        </motion.button>

        {/* Top-priority topic mastery (top 4) */}
        <motion.div {...section(0.15)}>
          <TopicTelemetryList
            topics={priorityTopics}
            limit={4}
            onViewAll={() => setSheet("topics")}
            title="Topic Mastery"
          />
          {topicSummary.total > 0 && (
            <button
              onClick={() => setSheet("topics")}
              className="mt-2 w-full text-center text-[11px] font-semibold py-2.5 rounded-xl"
              style={{
                color: TELEMETRY.cyan,
                background: TELEMETRY.card,
                border: `1px solid ${TELEMETRY.border}`,
              }}
            >
              View all {topicSummary.total} topics
              {topicSummary.needsReview > 0 && (
                <span style={{ color: TELEMETRY.magenta }}>
                  {" "}· {topicSummary.needsReview} need review
                </span>
              )}
            </button>
          )}
        </motion.div>

        {/* Skill Balance summary tile */}
        <motion.button
          {...section(0.2)}
          onClick={() => setSheet("radar")}
          className="w-full text-left rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
          style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${TELEMETRY.magenta}1a`, border: `1px solid ${TELEMETRY.magenta}33` }}
          >
            <RadarIcon size={18} style={{ color: TELEMETRY.magenta }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: TELEMETRY.muted }}>
              Skill Balance
            </div>
            <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
              {subjectPerformanceData.length} subject{subjectPerformanceData.length === 1 ? "" : "s"} compared
            </div>
          </div>
          <ChevronRight size={16} style={{ color: TELEMETRY.muted }} className="flex-shrink-0" />
        </motion.button>
      </div>

      {/* ─────────── Drill-down sheets ─────────── */}
      <MobileStatSheet
        open={sheet === "readiness"}
        onClose={() => setSheet(null)}
        title="Exam Readiness"
        subtitle="A weighted blend of your accuracy, topic coverage, and revision streak."
      >
        <div className="space-y-3">
          {[
            {
              key: "mastery",
              label: "Mastery",
              value: Math.round(avgScore),
              color: TELEMETRY.lime,
              desc: "Your average score across attempted questions.",
            },
            {
              key: "coverage",
              label: "Coverage",
              value: Math.round(coverage),
              color: TELEMETRY.cyan,
              desc: "Share of your topic list you've actually practised.",
            },
            {
              key: "streak",
              label: "Revision Streak",
              value: Math.round(consistency),
              color: TELEMETRY.magenta,
              desc: `Current streak of ${currentStreak} day${currentStreak === 1 ? "" : "s"} · best ${longestStreak}d.`,
            },
          ].map((f) => (
            <div
              key={f.key}
              className="rounded-2xl p-4"
              style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
                  {f.label}
                </div>
                <div className="text-lg font-bold tabular-nums" style={{ color: f.color }}>
                  {f.value}%
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: TELEMETRY.border }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${f.value}%`, background: f.color, boxShadow: `0 0 8px ${f.color}88` }}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: TELEMETRY.muted }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </MobileStatSheet>

      <MobileStatSheet
        open={sheet === "trend"}
        onClose={() => setSheet(null)}
        title="Performance Trends"
      >
        <ScoreTrendCard
          data={examResultsData}
          subjects={subjectPerformanceData}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
      </MobileStatSheet>

      <MobileStatSheet
        open={sheet === "topics"}
        onClose={() => setSheet(null)}
        title="All Topics"
        subtitle={`${topicSummary.attempted} attempted · ${topicSummary.needsReview} need review`}
      >
        {topics.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-xs"
            style={{
              background: TELEMETRY.card,
              border: `1px solid ${TELEMETRY.border}`,
              color: TELEMETRY.muted,
            }}
          >
            No topics yet. Take a quiz or exam to build your mastery map.
          </div>
        ) : (
          <div
            className="rounded-2xl px-4"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            {topics.map((t) => (
              <TopicTelemetryRow key={t.topic} topic={t} />
            ))}
          </div>
        )}
      </MobileStatSheet>

      <MobileStatSheet
        open={sheet === "radar"}
        onClose={() => setSheet(null)}
        title="Skill Balance"
        subtitle="Average score per subject, at a glance."
      >
        <SkillRadarCard subjects={subjectPerformanceData} />
      </MobileStatSheet>
    </div>
  );
};
