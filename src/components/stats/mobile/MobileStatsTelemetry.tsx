import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Radar as RadarIcon,
  TrendingUp,
  Search,
  ArrowUpDown,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { ReadinessRing } from "./ReadinessRing";
import { QuickStatsGrid } from "./QuickStatsGrid";
import { GradeProjectionPanel } from "./GradeProjectionPanel";
import { useGradeSettings } from "@/hooks/useGradeSettings";
import { useProfileDefaults } from "@/hooks/useProfileDefaults";
import { getScale, projectGrade, resolveScaleId, targetStatus } from "@/lib/grade-scales";
import { ScoreTrendCard } from "./ScoreTrendCard";
import { TopicTelemetryRow } from "./TopicTelemetryRow";
import { SkillRadarCard } from "./SkillRadarCard";
import { MobileStatSheet } from "./MobileStatSheet";
import { useTelemetry, alpha, clampPct, buildSparklinePath } from "./tokens";
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
  | "radar"
  | "accuracy"
  | "grade"
  | "mastered"
  | "streak";

type TabKey = "overview" | "topics" | "performance";
type FilterKey = "all" | "review" | "developing" | "mastered";
type SortKey = "lowest" | "highest" | "attempts" | "alpha";
type ReadinessRow = "mastery" | "coverage" | "streak" | null;


const section = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
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
  const TELEMETRY = useTelemetry();
  const [tab, setTab] = useState<TabKey>("overview");
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [expandedRow, setExpandedRow] = useState<ReadinessRow>(null);
  const [totalStudySeconds, setTotalStudySeconds] = useState<number | null>(null);

  // ───── Derived hub metrics ─────
  const attemptedTopics = useMemo(
    () => topics.filter((t) => t.examQuestionCount + t.practiceQuestionCount > 0),
    [topics]
  );

  const coverage = useMemo(() => {
    if (topics.length === 0) return 0;
    return clampPct((attemptedTopics.length / topics.length) * 100);
  }, [attemptedTopics, topics.length]);

  const consistency = useMemo(() => {
    const base = Math.max(longestStreak, 7);
    return clampPct((currentStreak / base) * 100);
  }, [currentStreak, longestStreak]);

  const accuracy = useMemo(() => {
    if (attemptedTopics.length === 0) return avgScore;
    const total = attemptedTopics.reduce((s, t) => s + t.unifiedScore, 0);
    return total / attemptedTopics.length;
  }, [attemptedTopics, avgScore]);

  const masteredCount = useMemo(
    () => attemptedTopics.filter((t) => clampPct(t.unifiedScore) >= 70).length,
    [attemptedTopics]
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
    return [...attemptedTopics].sort((a, b) => a.unifiedScore - b.unifiedScore).slice(0, 4);
  }, [attemptedTopics]);

  const trendSpark = scoreSeries.slice(-8);
  const sparkPath = buildSparklinePath(trendSpark, 140, 36);

  // ───── Topics tab: search / filter / sort ─────
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

  const subjectAccuracy = useMemo(
    () =>
      [...subjectPerformanceData]
        .filter((s) => s.count > 0)
        .sort((a, b) => b.avgScore - a.avgScore),
    [subjectPerformanceData]
  );

  // ───── Readiness drill-down data ─────
  const unattemptedList = useMemo(
    () => topics.filter((t) => t.examQuestionCount + t.practiceQuestionCount === 0),
    [topics]
  );

  const masteryBands = useMemo(() => {
    const strong = attemptedTopics.filter((t) => clampPct(t.unifiedScore) >= 70);
    const developing = attemptedTopics.filter(
      (t) => clampPct(t.unifiedScore) >= 40 && clampPct(t.unifiedScore) < 70
    );
    const review = attemptedTopics.filter((t) => clampPct(t.unifiedScore) < 40);
    return { strong, developing, review };
  }, [attemptedTopics]);

  // studyActivityData only ever covers the current Mon-Sun week, so this is a
  // 7-day grid. It previously claimed 14 days and padded the missing half with
  // *leading* zeros, so the first row of cells was permanently blank.
  const streakGrid = useMemo(
    () => Array.from({ length: 7 }, (_, i) => (hoursSeries[i] ?? 0) > 0),
    [hoursSeries]
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "topics", label: "Topics" },
    { key: "performance", label: "Performance" },
  ];

  // Grades belong to a subject, not to an account — a single number across
  // Maths and History means nothing. This counts how many subjects are meeting
  // the target the student set for each.
  const { defaults: profileDefaults } = useProfileDefaults();
  const defaultScaleId = useMemo(
    () => resolveScaleId(profileDefaults.educationalLevel, profileDefaults.curriculumRegion),
    [profileDefaults.educationalLevel, profileDefaults.curriculumRegion]
  );
  const { get: getGradeSettings } = useGradeSettings();

  const gradeSummary = useMemo(() => {
    const withTargets = subjectPerformanceData
      .map((s) => {
        const settings = getGradeSettings(s.name);
        if (!settings.targetGrade) return null;
        const scale = getScale(settings.scaleId ?? defaultScaleId);
        const predicted = projectGrade(s.avgScore, scale, {
          overrides: settings.boundaries,
          tierId: settings.tierId,
        });
        return targetStatus(scale, predicted.grade, settings.targetGrade);
      })
      .filter((v): v is ReturnType<typeof targetStatus> => v !== null);

    if (withTargets.length === 0) {
      return { value: "Not set", delta: "tap to set targets", tone: "neutral" as const };
    }
    const met = withTargets.filter((s) => s === "met").length;
    return {
      value: `${met} / ${withTargets.length}`,
      delta: met === withTargets.length ? "all on target" : `${withTargets.length - met} to go`,
      tone: met === withTargets.length ? ("up" as const) : ("down" as const),
    };
  }, [subjectPerformanceData, getGradeSettings, defaultScaleId]);

  return (
    <div
      className="stats-telemetry -mx-3 px-3 pt-3 pb-32 min-h-screen"
      style={{ background: TELEMETRY.bg, color: TELEMETRY.text }}
    >
      <div className="max-w-md mx-auto">
        {/* ───── Segmented tab bar ───── */}
        <div
          className="sticky top-0 z-30 -mx-3 px-3 pt-1 pb-3 mb-4"
          style={{
            background: alpha(TELEMETRY.bg, 0.95),
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div
            className="grid grid-cols-3 gap-1 p-1 rounded-full"
            style={{
              background: TELEMETRY.cardAlt,
              border: `1px solid ${TELEMETRY.border}`,
            }}
          >
            {tabs.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="min-h-[36px] rounded-full text-xs font-semibold transition-colors"
                  style={{
                    color: active ? TELEMETRY.onAccent : TELEMETRY.mutedStrong,
                    background: active ? TELEMETRY.text : "transparent",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ───── OVERVIEW ───── */}
        {tab === "overview" && (
          <div className="space-y-4">
            <motion.div {...section(0)}>
              <ReadinessRing
                overall={avgScore}
                coverage={coverage}
                consistency={consistency}
                onInfo={() => {
                  setExpandedRow(null);
                  setSheet("readiness");
                }}
              />
            </motion.div>

            <motion.div {...section(0.05)}>
              <QuickStatsGrid
                accuracy={accuracy}
                accuracySeries={scoreSeries.slice(-7)}
                gradeValue={gradeSummary.value}
                gradeDelta={gradeSummary.delta}
                gradeTone={gradeSummary.tone}
                masteredCount={masteredCount}
                totalAttempted={attemptedTopics.length}
                streak={currentStreak}
                longestStreak={longestStreak}
                onOpenAccuracy={() => setSheet("accuracy")}
                onOpenGrade={() => setSheet("grade")}
                onOpenMastered={() => setSheet("mastered")}
                onOpenStreak={() => setSheet("streak")}
              />
            </motion.div>

            {/* Top Revision Priorities */}
            <motion.div {...section(0.1)}>
              <div
                className="rounded-2xl p-4"
                style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
                    Top Revision Priorities
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("topics")}
                    className="text-[11px] font-semibold flex items-center gap-0.5"
                    style={{ color: TELEMETRY.cyan }}
                  >
                    View all <ChevronRight size={12} />
                  </button>
                </div>
                {priorityTopics.length === 0 ? (
                  <div className="py-6 text-center text-xs" style={{ color: TELEMETRY.muted }}>
                    Complete a quiz or exam to surface priorities
                  </div>
                ) : (
                  <div>
                    {priorityTopics.map((t) => (
                      <TopicTelemetryRow key={t.topic} topic={t} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* ───── TOPICS & MASTERY ───── */}
        {tab === "topics" && (
          <div>
            <div
              className="sticky top-[68px] z-20 -mx-3 px-4 pt-2 pb-3 space-y-2"
              style={{
                background: alpha(TELEMETRY.bg, 0.95),
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                borderBottom: `1px solid ${TELEMETRY.borderSoft}`,
              }}
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
                        color: active ? TELEMETRY.onAccent : c.color,
                        background: active ? c.color : "transparent",
                        border: `1px solid ${active ? c.color : alpha(c.color, 0.27)}`,
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: TELEMETRY.muted }}>
                  {visibleTopics.length} of {topics.length} shown
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

            <div className="mt-3">
              {visibleTopics.length === 0 ? (
                <div
                  className="rounded-2xl p-6 text-center text-xs"
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
                  className="rounded-2xl px-4"
                  style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
                >
                  {visibleTopics.map((t) => (
                    <TopicTelemetryRow key={t.topic} topic={t} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ───── PERFORMANCE ───── */}
        {tab === "performance" && (
          <div className="space-y-4">
            <motion.div {...section(0)}>
              <ScoreTrendCard
                data={examResultsData}
                subjects={subjectPerformanceData}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
              />
            </motion.div>

            <motion.div {...section(0.05)}>
              <div
                className="rounded-2xl p-4"
                style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} style={{ color: TELEMETRY.lime }} />
                  <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
                    Subject Accuracy
                  </div>
                </div>
                {subjectAccuracy.length === 0 ? (
                  <div className="py-6 text-center text-xs" style={{ color: TELEMETRY.muted }}>
                    No attempted questions yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subjectAccuracy.map((s) => (
                      <div key={s.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: s.color }}
                            />
                            <span
                              className="text-[13px] font-medium truncate"
                              style={{ color: TELEMETRY.text }}
                            >
                              {s.name}
                            </span>
                          </div>
                          <span
                            className="text-[13px] font-semibold tabular-nums"
                            style={{ color: s.color }}
                          >
                            {Math.round(s.avgScore)}%
                          </span>
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: TELEMETRY.border }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${clampPct(s.avgScore)}%`, background: s.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.button
              {...section(0.1)}
              type="button"
              onClick={() => setSheet("radar")}
              className="w-full text-left rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
              style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: alpha(TELEMETRY.magenta, 0.1), border: `1px solid ${alpha(TELEMETRY.magenta, 0.2)}` }}
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
              {sparkPath && (
                <svg width={64} height={28} viewBox="0 0 140 36" preserveAspectRatio="none" className="flex-shrink-0">
                  <path d={sparkPath} fill="none" stroke={TELEMETRY.lime} strokeWidth={2} />
                </svg>
              )}
              <ChevronRight size={16} style={{ color: TELEMETRY.muted }} className="flex-shrink-0" />
            </motion.button>
          </div>
        )}
      </div>

      {/* ═══════════ SHEETS ═══════════ */}

      {/* Readiness — interactive expandable factor breakdown */}
      <MobileStatSheet
        open={sheet === "readiness"}
        onClose={() => {
          setSheet(null);
          setExpandedRow(null);
        }}
        title="Exam Readiness"
        subtitle="A weighted blend of your accuracy, topic coverage, and revision streak."
      >
        <div className="space-y-3">
          {(
            [
              {
                key: "mastery",
                label: "Mastery",
                value: Math.round(accuracy),
                color: TELEMETRY.lime,
                desc: "Your average score across attempted questions.",
              },
              {
                key: "coverage",
                label: "Coverage",
                value: Math.round(coverage),
                color: TELEMETRY.cyan,
                desc: `${attemptedTopics.length} of ${topics.length} topics attempted.`,
              },
              {
                key: "streak",
                label: "Revision Streak",
                value: Math.round(consistency),
                color: TELEMETRY.magenta,
                desc: `Current streak of ${currentStreak} day${currentStreak === 1 ? "" : "s"} · best ${longestStreak}d.`,
              },
            ] as const
          ).map((f) => {
            const isOpen = expandedRow === f.key;
            return (
              <div
                key={f.key}
                className="rounded-2xl overflow-hidden"
                style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedRow(isOpen ? null : (f.key as ReadinessRow))}
                  className="w-full text-left p-4 active:opacity-90"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: f.color }}
                      />
                      <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
                        {f.label}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold tabular-nums" style={{ color: f.color }}>
                        {f.value}%
                      </div>
                      {isOpen ? (
                        <ChevronDown size={16} style={{ color: TELEMETRY.muted }} />
                      ) : (
                        <ChevronRight size={16} style={{ color: TELEMETRY.muted }} />
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: TELEMETRY.border }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${f.value}%`, background: f.color }}
                    />
                  </div>
                  <p className="text-xs mt-2" style={{ color: TELEMETRY.muted }}>
                    {f.desc}
                  </p>
                </button>

                {isOpen && f.key === "mastery" && (
                  <div
                    className="px-4 pb-4 pt-1 space-y-2"
                    style={{ borderTop: `1px solid ${TELEMETRY.borderSoft}` }}
                  >
                    {[
                      { label: "Mastered (≥70%)", count: masteryBands.strong.length, color: TELEMETRY.lime },
                      { label: "Developing (40–69%)", count: masteryBands.developing.length, color: TELEMETRY.cyan },
                      { label: "Needs Review (<40%)", count: masteryBands.review.length, color: TELEMETRY.magenta },
                    ].map((b) => (
                      <div key={b.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
                          <span className="text-xs" style={{ color: TELEMETRY.text }}>
                            {b.label}
                          </span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: b.color }}>
                          {b.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {isOpen && f.key === "coverage" && (
                  <div
                    className="px-4 pb-4 pt-3 space-y-2"
                    style={{ borderTop: `1px solid ${TELEMETRY.borderSoft}` }}
                  >
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: TELEMETRY.muted }}>
                      Remaining unattempted ({unattemptedList.length})
                    </div>
                    {unattemptedList.length === 0 ? (
                      <div className="text-xs" style={{ color: TELEMETRY.mutedStrong }}>
                        Every topic has been attempted at least once.
                      </div>
                    ) : (
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                        {unattemptedList.slice(0, 20).map((t) => (
                          <li key={t.topic} className="flex items-center gap-2 text-xs">
                            <Circle size={10} style={{ color: TELEMETRY.gray }} />
                            <span className="capitalize" style={{ color: TELEMETRY.text }}>
                              {t.topic}
                            </span>
                          </li>
                        ))}
                        {unattemptedList.length > 20 && (
                          <li className="text-[11px]" style={{ color: TELEMETRY.muted }}>
                            + {unattemptedList.length - 20} more
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}

                {isOpen && f.key === "streak" && (
                  <div
                    className="px-4 pb-4 pt-3"
                    style={{ borderTop: `1px solid ${TELEMETRY.borderSoft}` }}
                  >
                    <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: TELEMETRY.muted }}>
                      This week
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {streakGrid.map((active, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-md flex items-center justify-center"
                          style={{
                            background: active ? alpha(TELEMETRY.magenta, 0.13) : TELEMETRY.cardAlt,
                            border: `1px solid ${active ? TELEMETRY.magenta : TELEMETRY.border}`,
                          }}
                        >
                          {active && <CheckCircle2 size={12} style={{ color: TELEMETRY.magenta }} />}
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] mt-3" style={{ color: TELEMETRY.muted }}>
                      Filled days are days you completed at least one question.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </MobileStatSheet>

      {/* Radar */}
      <MobileStatSheet
        open={sheet === "radar"}
        onClose={() => setSheet(null)}
        title="Skill Balance"
        subtitle="Average score per subject, at a glance."
      >
        <SkillRadarCard subjects={subjectPerformanceData} />
      </MobileStatSheet>

      {/* Accuracy Breakdown */}
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

      {/* Grade Projection */}
      <MobileStatSheet
        open={sheet === "grade"}
        onClose={() => setSheet(null)}
        title="Grade Projection"
        subtitle="Predicted grade per subject, on the scale that subject actually uses."
      >
        <GradeProjectionPanel
          subjects={subjectPerformanceData}
          defaultScaleId={defaultScaleId}
        />
      </MobileStatSheet>

      {/* Mastered / Retention */}
      <MobileStatSheet
        open={sheet === "mastered"}
        onClose={() => setSheet(null)}
        title="Question Retention"
        subtitle={`${masteredCount} of ${attemptedTopics.length} topics are consistently at ≥70%.`}
      >
        <div className="space-y-3">
          <div
            className="rounded-2xl p-4 grid grid-cols-3 gap-3 text-center"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            {[
              { label: "Mastered", count: masteryBands.strong.length, color: TELEMETRY.lime },
              { label: "Developing", count: masteryBands.developing.length, color: TELEMETRY.cyan },
              { label: "Review", count: masteryBands.review.length, color: TELEMETRY.magenta },
            ].map((b) => (
              <div key={b.label}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: b.color }}>
                  {b.count}
                </div>
                <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: TELEMETRY.muted }}>
                  {b.label}
                </div>
              </div>
            ))}
          </div>
          {masteryBands.strong.length > 0 && (
            <div
              className="rounded-2xl px-4"
              style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
            >
              {masteryBands.strong.slice(0, 8).map((t) => (
                <TopicTelemetryRow key={t.topic} topic={t} />
              ))}
            </div>
          )}
        </div>
      </MobileStatSheet>

      {/* Streak Calendar */}
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
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: TELEMETRY.muted }}>
              This week
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {streakGrid.map((active, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-md flex items-center justify-center"
                  style={{
                    background: active ? alpha(TELEMETRY.magenta, 0.13) : TELEMETRY.cardAlt,
                    border: `1px solid ${active ? TELEMETRY.magenta : TELEMETRY.border}`,
                  }}
                >
                  {active && <CheckCircle2 size={12} style={{ color: TELEMETRY.magenta }} />}
                </div>
              ))}
            </div>
          </div>
          <div
            className="rounded-2xl p-4 text-xs leading-relaxed"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}`, color: TELEMETRY.muted }}
          >
            Your streak counts every day you complete at least one question. Miss a day and it resets — your best-ever streak stays saved.
          </div>
        </div>
      </MobileStatSheet>
    </div>
  );
};
