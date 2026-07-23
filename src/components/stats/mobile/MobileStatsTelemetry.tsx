import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Info, Radar as RadarIcon, TrendingUp, Search, ArrowUpDown } from "lucide-react";
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

type SheetKey =
  | null
  | "readiness"
  | "trend"
  | "topics"
  | "radar"
  | "accuracy"
  | "streak"
  | "timing"
  | "velocity";

type FilterKey = "all" | "review" | "developing" | "mastered";
type SortKey = "lowest" | "highest" | "attempts" | "alpha";

const section = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

const formatSec = (sec: number) => {
  if (!Number.isFinite(sec) || sec <= 0) return "0s";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
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

  const priorityTopics = useMemo(() => {
    const attempted = topics.filter(
      (t) => t.examQuestionCount + t.practiceQuestionCount > 0
    );
    return [...attempted].sort((a, b) => a.unifiedScore - b.unifiedScore);
  }, [topics]);

  const trendSpark = scoreSeries.slice(-8);
  const sparkPath = buildSparklinePath(trendSpark, 140, 36);

  // ───── All Topics sheet — search / filter / sort ─────
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("lowest");

  const visibleTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = topics.filter((t) => {
      const attempts = t.examQuestionCount + t.practiceQuestionCount;
      const pct = clampPct(t.unifiedScore);
      if (q) {
        const hay = `${t.topic} ${t.subjectId ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "review") return attempts > 0 && pct < 40;
      if (filter === "developing") return attempts > 0 && pct >= 40 && pct < 70;
      if (filter === "mastered") return attempts > 0 && pct >= 70;
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const aAtt = a.examQuestionCount + a.practiceQuestionCount;
      const bAtt = b.examQuestionCount + b.practiceQuestionCount;
      switch (sort) {
        case "highest":
          return b.unifiedScore - a.unifiedScore;
        case "attempts":
          return bAtt - aAtt;
        case "alpha":
          return a.topic.localeCompare(b.topic);
        case "lowest":
        default:
          // Attempted first, then lowest score
          if ((aAtt > 0) !== (bAtt > 0)) return aAtt > 0 ? -1 : 1;
          return a.unifiedScore - b.unifiedScore;
      }
    });
    return sorted;
  }, [topics, search, filter, sort]);

  const filterChips: { key: FilterKey; label: string; color: string }[] = [
    { key: "all", label: "All", color: TELEMETRY.mutedStrong },
    { key: "review", label: "Needs Review", color: TELEMETRY.magenta },
    { key: "developing", label: "Developing", color: TELEMETRY.cyan },
    { key: "mastered", label: "Mastered", color: TELEMETRY.lime },
  ];

  // ───── Accuracy breakdown data ─────
  const subjectAccuracy = useMemo(
    () =>
      [...subjectPerformanceData]
        .filter((s) => s.count > 0)
        .sort((a, b) => b.avgScore - a.avgScore),
    [subjectPerformanceData]
  );

  // ───── Timing per subject (proportional to attempts share of total time) ─────
  const timingPerSubject = useMemo(() => {
    if (!totalStudySeconds || totalAttempts === 0) return [] as { name: string; color: string; sec: number }[];
    const totalCount = subjectPerformanceData.reduce((s, x) => s + x.count, 0);
    if (totalCount === 0) return [];
    return subjectPerformanceData
      .filter((s) => s.count > 0)
      .map((s) => ({
        name: s.name,
        color: s.color,
        sec: (totalStudySeconds * (s.count / totalCount)) / s.count,
      }))
      .sort((a, b) => a.sec - b.sec);
  }, [subjectPerformanceData, totalStudySeconds, totalAttempts]);

  const velocitySlopePerWeek = useMemo(() => {
    if (scoreSeries.length < 2) return 0;
    const recent = scoreSeries.slice(-7);
    if (recent.length < 2) return 0;
    const diff = recent[recent.length - 1] - recent[0];
    return diff / Math.max(1, recent.length - 1);
  }, [scoreSeries]);

  return (
    <div
      className="stats-telemetry -mx-3 px-3 pt-3 pb-32 min-h-screen"
      style={{ background: TELEMETRY.bg, color: TELEMETRY.text }}
    >
      <div className="max-w-md mx-auto space-y-4">
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

        <motion.div {...section(0.05)}>
          <QuickStatsGrid
            accuracy={accuracy}
            accuracySeries={scoreSeries.slice(-7)}
            streak={currentStreak}
            longestStreak={longestStreak}
            avgTimePerQ={avgTimePerQ}
            timeSeries={hoursSeries.slice(-7)}
            velocitySeries={scoreSeries.slice(-7)}
            onOpenAccuracy={() => setSheet("accuracy")}
            onOpenStreak={() => setSheet("streak")}
            onOpenTiming={() => setSheet("timing")}
            onOpenVelocity={() => setSheet("velocity")}
          />
        </motion.div>

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

        <motion.div {...section(0.15)}>
          <TopicTelemetryList
            topics={priorityTopics}
            limit={4}
            onViewAll={() => setSheet("topics")}
            title="Topic Mastery"
          />
        </motion.div>

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
            { key: "mastery", label: "Mastery", value: Math.round(avgScore), color: TELEMETRY.lime, desc: "Your average score across attempted questions." },
            { key: "coverage", label: "Coverage", value: Math.round(coverage), color: TELEMETRY.cyan, desc: "Share of your topic list you've actually practised." },
            { key: "streak", label: "Revision Streak", value: Math.round(consistency), color: TELEMETRY.magenta, desc: `Current streak of ${currentStreak} day${currentStreak === 1 ? "" : "s"} · best ${longestStreak}d.` },
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

      <MobileStatSheet open={sheet === "trend"} onClose={() => setSheet(null)} title="Performance Trends">
        <ScoreTrendCard
          data={examResultsData}
          subjects={subjectPerformanceData}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
      </MobileStatSheet>

      {/* ─── All Topics with search / filter / sort ─── */}
      <MobileStatSheet
        open={sheet === "topics"}
        onClose={() => setSheet(null)}
        title="All Topics"
        subtitle={`${topics.length} total · ${visibleTopics.length} shown`}
      >
        <div
          className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-1 space-y-2"
          style={{ background: TELEMETRY.bg }}
        >
          <div
            className="flex items-center gap-2 rounded-xl px-3 h-11"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <Search size={14} style={{ color: TELEMETRY.muted }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics or subjects"
              className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-60"
              style={{ color: TELEMETRY.text }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[11px] font-semibold"
                style={{ color: TELEMETRY.muted }}
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {filterChips.map((c) => {
              const active = filter === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  className="whitespace-nowrap px-3 h-8 rounded-full text-[11px] font-semibold transition-colors flex-shrink-0"
                  style={{
                    color: active ? "hsl(220 10% 6%)" : c.color,
                    background: active ? c.color : "transparent",
                    border: `1px solid ${active ? c.color : `${c.color}44`}`,
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: TELEMETRY.muted }}>
              Sort by
            </span>
            <div
              className="flex items-center gap-2 rounded-lg px-2 h-8"
              style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
            >
              <ArrowUpDown size={12} style={{ color: TELEMETRY.muted }} />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="bg-transparent outline-none text-[11px] font-semibold pr-1"
                style={{ color: TELEMETRY.text }}
              >
                <option value="lowest" style={{ background: TELEMETRY.card }}>Lowest score first</option>
                <option value="highest" style={{ background: TELEMETRY.card }}>Highest score first</option>
                <option value="attempts" style={{ background: TELEMETRY.card }}>Most attempted</option>
                <option value="alpha" style={{ background: TELEMETRY.card }}>Alphabetical (A–Z)</option>
              </select>
            </div>
          </div>
        </div>

        {visibleTopics.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-xs mt-2"
            style={{
              background: TELEMETRY.card,
              border: `1px solid ${TELEMETRY.border}`,
              color: TELEMETRY.muted,
            }}
          >
            No matching topics found
          </div>
        ) : (
          <div
            className="rounded-2xl px-4 mt-1"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            {visibleTopics.map((t) => (
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

      {/* ─── Accuracy Breakdown ─── */}
      <MobileStatSheet
        open={sheet === "accuracy"}
        onClose={() => setSheet(null)}
        title="Accuracy Breakdown"
        subtitle="Your average score per subject across attempted questions."
      >
        {subjectAccuracy.length === 0 ? (
          <div className="text-xs text-center py-6" style={{ color: TELEMETRY.muted }}>
            No attempted questions yet.
          </div>
        ) : (
          <div className="space-y-3">
            {subjectAccuracy.map((s) => (
              <div
                key={s.name}
                className="rounded-2xl p-4"
                style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-sm font-semibold truncate" style={{ color: TELEMETRY.text }}>
                      {s.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: s.color }}>
                    {Math.round(s.avgScore)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: TELEMETRY.border }}>
                  <div className="h-full rounded-full" style={{ width: `${clampPct(s.avgScore)}%`, background: s.color }} />
                </div>
                <div className="text-[10px] uppercase tracking-wider mt-2" style={{ color: TELEMETRY.muted }}>
                  {s.count} question{s.count === 1 ? "" : "s"} attempted
                </div>
              </div>
            ))}
          </div>
        )}
      </MobileStatSheet>

      {/* ─── Streak Sheet ─── */}
      <MobileStatSheet
        open={sheet === "streak"}
        onClose={() => setSheet(null)}
        title="Study Streak & Activity"
        subtitle={`Current streak: ${currentStreak}d · Longest: ${longestStreak}d`}
      >
        <div className="space-y-3">
          <div
            className="rounded-2xl p-4"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <div className="text-[10px] uppercase tracking-wider" style={{ color: TELEMETRY.muted }}>
              Daily Activity (last {studyActivityData.length}d)
            </div>
            <div className="flex items-end gap-1 mt-3 h-24">
              {hoursSeries.map((v, i) => {
                const max = Math.max(1, ...hoursSeries);
                const h = Math.max(4, (v / max) * 92);
                const active = v > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: h,
                        background: active ? TELEMETRY.magenta : TELEMETRY.border,
                        boxShadow: active ? `0 0 8px ${TELEMETRY.magenta}55` : undefined,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className="rounded-2xl p-4 text-xs leading-relaxed"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}`, color: TELEMETRY.muted }}
          >
            Your streak counts every day you complete at least one question. Miss a day and it resets to zero — your best-ever streak stays saved.
          </div>
        </div>
      </MobileStatSheet>

      {/* ─── Timing Sheet ─── */}
      <MobileStatSheet
        open={sheet === "timing"}
        onClose={() => setSheet(null)}
        title="Speed & Timing Analysis"
        subtitle={
          avgTimePerQ != null
            ? `Averaging ${formatSec(avgTimePerQ)} per question across ${totalAttempts} attempts.`
            : "Complete a few questions to unlock timing insights."
        }
      >
        {timingPerSubject.length === 0 ? (
          <div className="text-xs text-center py-6" style={{ color: TELEMETRY.muted }}>
            No timing data yet.
          </div>
        ) : (
          <div className="space-y-3">
            {timingPerSubject.map((s) => (
              <div
                key={s.name}
                className="rounded-2xl p-4 flex items-center justify-between"
                style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-sm font-semibold truncate" style={{ color: TELEMETRY.text }}>
                    {s.name}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color: TELEMETRY.cyan }}>
                  {formatSec(s.sec)}/q
                </span>
              </div>
            ))}
          </div>
        )}
      </MobileStatSheet>

      {/* ─── Velocity Sheet ─── */}
      <MobileStatSheet
        open={sheet === "velocity"}
        onClose={() => setSheet(null)}
        title="Mastery Velocity"
        subtitle="How fast your average score is climbing week over week."
      >
        <div className="space-y-3">
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <div className="text-[10px] uppercase tracking-wider" style={{ color: TELEMETRY.muted }}>
              Weekly slope
            </div>
            <div
              className="text-4xl font-bold tabular-nums mt-1"
              style={{ color: velocitySlopePerWeek >= 0 ? TELEMETRY.lime : TELEMETRY.magenta }}
            >
              {velocitySlopePerWeek >= 0 ? "+" : ""}
              {velocitySlopePerWeek.toFixed(1)}%
            </div>
            <div className="text-[11px] mt-1" style={{ color: TELEMETRY.muted }}>
              Change per week across your last {Math.min(7, scoreSeries.length)} scores
            </div>
          </div>
          <div
            className="rounded-2xl p-4 text-xs leading-relaxed"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}`, color: TELEMETRY.muted }}
          >
            Velocity is calculated as the slope of your recent score history. A positive slope means you're improving — aim to keep it above <strong style={{ color: TELEMETRY.text }}>+1.0%/week</strong> heading into exams.
          </div>
        </div>
      </MobileStatSheet>
    </div>
  );
};
