
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Radar as RadarIcon, TrendingUp, ArrowUpDown, CheckCircle2, Circle } from "lucide-react";
import { ExamTargetHero } from "./ExamTargetHero";
import { QuickStatsGrid } from "./QuickStatsGrid";
import { GradeProjectionPanel } from "./GradeProjectionPanel";
import { StudyLoadCard } from "./StudyLoadCard";
import { SubjectGaugeCard } from "./SubjectGaugeCard";
import { GradeTrendCard } from "./GradeTrendCard";
import { AccuracyBreakdownPanel } from "./AccuracyBreakdownPanel";
import { buildSubjectStacks } from "./SubjectStackedBars";
import { MobileWeakTopics } from "./MobileWeakTopics";
import { MasteryRing } from "./MasteryRing";
import { CoveragePanel } from "./CoveragePanel";
import { RetentionPanel } from "./RetentionPanel";
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
  /** Weak-topics loading state — the Topics tab now owns that view directly,
   *  so the page no longer needs a second tab layer to reach it. */
  weakTopicsLoading?: boolean;
  initialTab?: "overview" | "topics" | "performance";
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
  weakTopicsLoading = false,
  initialTab = "overview",
}: Props) => {
  const TELEMETRY = useTelemetry();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [sheet, setSheet] = useState<SheetKey>(null);
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

  // The old hero displayed avgScore and called it "readiness", while the sheet
  // described it as a blend of accuracy, coverage and streak. It wasn't one.
  // This makes the label true — accuracy dominates because it's the strongest
  // signal, with coverage and consistency as modifiers.
  const readinessScore = useMemo(
    () => clampPct(avgScore) * 0.6 + clampPct(coverage) * 0.25 + clampPct(consistency) * 0.15,
    [avgScore, coverage, consistency]
  );

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

  // Topics search / filter / sort now live in MobileWeakTopics.

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

  // Same rule MobileWeakTopics uses for its "Needs review" bucket — marked
  // work scoring under 40% — so the badge and the list can't disagree.
  const reviewCount = useMemo(
    () =>
      topics.filter(
        (t) =>
          t.examQuestionCount + t.practiceQuestionCount > 0 &&
          clampPct(t.unifiedScore) < 40
      ).length,
    [topics]
  );

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "topics", label: "Topics", count: reviewCount },
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

  const topicStatsFor = useMemo(() => {
    const bySubject = new Map<string, { mastered: number; developing: number; review: number }>();
    topics.forEach((t) => {
      const key = t.subjectId ?? "";
      if (!bySubject.has(key)) bySubject.set(key, { mastered: 0, developing: 0, review: 0 });
      const entry = bySubject.get(key)!;
      const attempts = t.examQuestionCount + t.practiceQuestionCount;
      if (attempts === 0) return;
      const pct = clampPct(t.unifiedScore);
      if (pct >= 70) entry.mastered += 1;
      else if (pct >= 40) entry.developing += 1;
      else entry.review += 1;
    });
    return (subject: string) =>
      bySubject.get(subject) ?? { mastered: 0, developing: 0, review: 0 };
  }, [topics]);

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

  const gradeProgress = useMemo(() => {
    const m = gradeSummary.value.match(/^(\d+)\s*\/\s*(\d+)/);
    if (!m) return null;
    const met = Number(m[1]);
    const total = Number(m[2]);
    return total > 0 ? Math.round((met / total) * 100) : null;
  }, [gradeSummary.value]);

  const gradeAccent = subjectPerformanceData[0]?.color ?? TELEMETRY.info;

  const subjectStacks = useMemo(
    () =>
      buildSubjectStacks(
        topics,
        subjectPerformanceData.map((s) => ({ name: s.name, color: s.color })),
        TELEMETRY.idle
      ),
    [topics, subjectPerformanceData, TELEMETRY.idle]
  );

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
                  className="min-h-[36px] rounded-full text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  style={{
                    color: active ? TELEMETRY.onAccent : TELEMETRY.mutedStrong,
                    background: active ? TELEMETRY.text : "transparent",
                  }}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span
                      aria-label={`${t.count} topics need review`}
                      className="text-[10px] font-bold tabular-nums rounded-full px-1.5 leading-[16px] min-w-[16px] text-center"
                      style={{
                        color: active ? TELEMETRY.card : TELEMETRY.onAccent,
                        background: TELEMETRY.review,
                      }}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ───── OVERVIEW ───── */}
        {tab === "overview" && (
          <div className="space-y-4">
            <motion.div {...section(0)}>
              <ExamTargetHero
                subjects={subjectPerformanceData}
                defaultScaleId={defaultScaleId}
              />
            </motion.div>

            <motion.div {...section(0.03)}>
              <button
                type="button"
                onClick={() => setSheet("readiness")}
                className="w-full rounded-2xl p-3.5 flex items-center gap-3 active:opacity-80 transition-opacity"
                style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
              >
                <span className="flex-1 min-w-0 text-left">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: TELEMETRY.text }}>
                      Exam readiness
                    </span>
                    <span className="text-[17px] font-bold tabular-nums" style={{ color: TELEMETRY.mastered }}>
                      {Math.round(readinessScore)}%
                    </span>
                  </span>
                  <span
                    className="block h-1.5 rounded-full overflow-hidden mt-2"
                    style={{ background: TELEMETRY.cardAlt }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${clampPct(readinessScore)}%`, background: TELEMETRY.mastered }}
                    />
                  </span>
                  <span className="block text-[11px] mt-1.5" style={{ color: TELEMETRY.muted }}>
                    {Math.round(avgScore)}% accuracy · {Math.round(coverage)}% coverage · {currentStreak}d streak
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0" style={{ color: TELEMETRY.muted }} />
              </button>
            </motion.div>

            <motion.div {...section(0.05)}>
              <QuickStatsGrid
                accuracy={accuracy}
                accuracySessions={scoreSeries.slice(-7)}
                subjectStacks={subjectStacks}
                gradeValue={gradeSummary.value}
                gradeDelta={gradeSummary.delta}
                gradeTone={gradeSummary.tone}
                gradeProgress={gradeProgress}
                gradeAccent={gradeAccent}
                gradeTrajectory={scoreSeries.slice(-8)}
                masteredCount={masteryBands.strong.length}
                developingCount={masteryBands.developing.length}
                reviewCount={masteryBands.review.length}
                totalAttempted={attemptedTopics.length}
                masteredHistory={scoreSeries.slice(-12)}
                streak={currentStreak}
                longestStreak={longestStreak}
                streakDays={streakGrid}
                streakLoads={hoursSeries.slice(0, 7)}
                onOpenAccuracy={() => setSheet("accuracy")}
                onOpenGrade={() => setSheet("grade")}
                onOpenMastered={() => setSheet("mastered")}
                onOpenStreak={() => setSheet("streak")}
              />
            </motion.div>

            <motion.div {...section(0.08)}>
              <StudyLoadCard data={studyActivityData} subjects={subjectPerformanceData} />
            </motion.div>

            <motion.div {...section(0.1)}>
              <SubjectGaugeCard subjects={subjectPerformanceData} topicStats={topicStatsFor} />
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
                    style={{ color: TELEMETRY.info }}
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
          <MobileWeakTopics topics={topics} loading={weakTopicsLoading} subjects={subjectPerformanceData} />
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

            <motion.div {...section(0.03)}>
              <GradeTrendCard
                data={examResultsData}
                subjects={subjectPerformanceData}
                defaultScaleId={defaultScaleId}
              />
            </motion.div>

            <motion.div {...section(0.05)}>
              <div
                className="rounded-2xl p-4"
                style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} style={{ color: TELEMETRY.mastered }} />
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
                style={{ background: alpha(TELEMETRY.review, 0.1), border: `1px solid ${alpha(TELEMETRY.review, 0.2)}` }}
              >
                <RadarIcon size={18} style={{ color: TELEMETRY.review }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px]" style={{ color: TELEMETRY.muted }}>
                  Skill Balance
                </div>
                <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
                  {subjectPerformanceData.length} subject{subjectPerformanceData.length === 1 ? "" : "s"} compared
                </div>
              </div>
              {sparkPath && (
                <svg width={64} height={28} viewBox="0 0 140 36" preserveAspectRatio="none" className="flex-shrink-0">
                  <path d={sparkPath} fill="none" stroke={TELEMETRY.mastered} strokeWidth={2} />
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
        onClose={() => setSheet(null)}
        title="Exam Readiness"
        subtitle="A weighted blend of your accuracy, topic coverage, and revision streak."
      >
        <div className="space-y-3">
          <div
            className="rounded-2xl p-4"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
              Mastery
            </div>
            <div className="text-[11px] mt-0.5 mb-4" style={{ color: TELEMETRY.muted }}>
              Average score, and how your topics split across the bands
            </div>
            <MasteryRing
              score={accuracy}
              bands={[
                { label: "Mastered ≥70%", count: masteryBands.strong.length, colour: TELEMETRY.mastered },
                { label: "Developing 40–69%", count: masteryBands.developing.length, colour: TELEMETRY.developing },
                { label: "Review <40%", count: masteryBands.review.length, colour: TELEMETRY.review },
              ]}
            />
          </div>

          <CoveragePanel topics={topics} subjects={subjectPerformanceData} />

          <div
            className="rounded-2xl p-4"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
                Revision streak
              </span>
              <span className="text-lg font-bold tabular-nums" style={{ color: TELEMETRY.review }}>
                {currentStreak}d
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: TELEMETRY.cardAlt }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${longestStreak > 0 ? Math.min(100, (currentStreak / longestStreak) * 100) : 0}%`,
                  background: TELEMETRY.review,
                }}
              />
            </div>
            <div className="text-[11px] mt-2" style={{ color: TELEMETRY.muted }}>
              Best run so far: {longestStreak} day{longestStreak === 1 ? "" : "s"}.
            </div>
          </div>
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
        subtitle="How your marked topics are distributed, not just the average."
      >
        <AccuracyBreakdownPanel
          topics={topics}
          subjects={subjectPerformanceData}
          trendData={examResultsData}
        />
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
        subtitle="Topic decay & memory freshness"
      >
        <RetentionPanel topics={topics} subjects={subjectPerformanceData} />
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
            <div className="text-[11px] mb-2" style={{ color: TELEMETRY.muted }}>
              This week
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {streakGrid.map((active, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-md flex items-center justify-center"
                  style={{
                    background: active ? alpha(TELEMETRY.review, 0.13) : TELEMETRY.cardAlt,
                    border: `1px solid ${active ? TELEMETRY.review : TELEMETRY.border}`,
                  }}
                >
                  {active && <CheckCircle2 size={12} style={{ color: TELEMETRY.review }} />}
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
