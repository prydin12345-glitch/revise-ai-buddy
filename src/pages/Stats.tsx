import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, AlertTriangle } from "lucide-react";
import { TopStatsCards } from "@/components/stats/TopStatsCards";
import { ExamResultsChart } from "@/components/stats/ExamResultsChart";
import { SubjectPerformanceChart } from "@/components/stats/SubjectPerformanceChart";
import { WeeklyStudyChart } from "@/components/stats/WeeklyStudyChart";
import { RecentExamsTable } from "@/components/stats/RecentExamsTable";
import { AccuracyTrendChart } from "@/components/stats/AccuracyTrendChart";
import { MobileStatsHero } from "@/components/stats/MobileStatsHero";
import { MobileChartSwitcher } from "@/components/stats/MobileChartSwitcher";
import { useExamStats } from "@/hooks/useExamStats";
import { useStatsDrilldown } from "@/hooks/useStatsDrilldown";
import { StatsDrilldownDrawer } from "@/components/dashboard/StatsDrilldownDrawer";
import { WeakTopicsTab } from "@/components/stats/WeakTopicsTab";
import { useUnifiedTopicPerformance } from "@/hooks/useUnifiedTopicPerformance";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const Stats = () => {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const defaultTab =
    searchParams.get("tab") === "weak-topics" ? "weak-topics" : "stats";
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { topics, loading: weakTopicsLoading } =
    useUnifiedTopicPerformance(userId);
  const drilldown = useStatsDrilldown();
  const {
    loading,
    totalExams,
    completedExams,
    inProgressExams,
    subjectPerformanceData,
    examResultsData,
    studyActivityData,
    recentExams,
    bestSubject,
    revisionGoals,
    currentStreak,
    longestStreak,
    timeRange,
    setTimeRange,
    pieChartMode,
    setPieChartMode,
  } = useExamStats();

  const subjects = subjectPerformanceData.map((s) => ({
    name: s.name,
    color: s.color,
  }));

  const avgScore = useMemo(() => {
    if (subjectPerformanceData.length === 0) return 0;
    const total = subjectPerformanceData.reduce(
      (sum, s) => sum + s.avgScore,
      0
    );
    return Math.round(total / subjectPerformanceData.length);
  }, [subjectPerformanceData]);

  const totalStudyHours = useMemo(() => {
    let total = 0;
    studyActivityData.forEach((day) => {
      Object.entries(day).forEach(([key, val]) => {
        if (key !== "day" && typeof val === "number") total += val;
      });
    });
    return total;
  }, [studyActivityData]);

  const weakCount = topics.filter((t) => t.mastery === "weak").length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">
              Loading your statistics…
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1200px] mx-auto px-3 sm:px-6 pb-10 pt-4 sm:pt-6">
        <Tabs defaultValue={defaultTab} className="w-full">
          {/* Tab navigation — sticky equal-width segmented on mobile, inline pills on desktop */}
          <div
            className={
              isMobile
                ? "sticky top-0 z-20 -mx-3 px-3 py-2 mb-3 bg-background/85 backdrop-blur border-b border-border"
                : "mb-5"
            }
          >
            <TabsList
              className={
                isMobile
                  ? "bg-card border border-border rounded-[10px] p-1 gap-1 grid grid-cols-2 w-full h-auto"
                  : "bg-card border border-border rounded-[10px] p-1 gap-1 h-auto w-auto inline-flex overflow-x-auto"
              }
            >
              <TabsTrigger
                value="stats"
                className="rounded-lg px-4 py-2 text-sm gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Stats
              </TabsTrigger>
              <TabsTrigger
                value="weak-topics"
                className="rounded-lg px-4 py-2 text-sm gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Weak Topics
                {weakCount > 0 && (
                  <span className="text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-px ml-0.5">
                    {weakCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Stats tab */}
          <TabsContent value="stats" className="mt-0">
            {isMobile ? (
              // ────────── MOBILE LAYOUT ──────────
              <div className="space-y-3">
                <MobileStatsHero avgScore={avgScore} />

                <TopStatsCards
                  totalExams={totalExams}
                  completedExams={completedExams}
                  inProgressExams={inProgressExams}
                  currentStreak={currentStreak}
                  longestStreak={longestStreak}
                  avgScore={avgScore}
                  totalStudyHours={totalStudyHours}
                  bestSubject={bestSubject}
                  onCardClick={drilldown.openDrawer}
                  variant="grid-no-score"
                />

                <MobileChartSwitcher
                  studyActivityData={studyActivityData}
                  subjects={subjects}
                  examResultsData={examResultsData}
                  subjectPerformanceData={subjectPerformanceData}
                  timeRange={timeRange}
                  setTimeRange={setTimeRange}
                  pieChartMode={pieChartMode}
                  setPieChartMode={setPieChartMode}
                  revisionGoals={revisionGoals}
                />

                <RecentExamsTable exams={recentExams} />
              </div>
            ) : (
              // ────────── DESKTOP LAYOUT (unchanged) ──────────
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4" style={{ alignItems: "stretch" }}>
                <div className="md:col-span-2 lg:col-span-12">
                  <TopStatsCards
                    totalExams={totalExams}
                    completedExams={completedExams}
                    inProgressExams={inProgressExams}
                    currentStreak={currentStreak}
                    longestStreak={longestStreak}
                    avgScore={avgScore}
                    totalStudyHours={totalStudyHours}
                    bestSubject={bestSubject}
                    onCardClick={drilldown.openDrawer}
                  />
                </div>

                <div className="md:col-span-1 lg:col-span-5 flex flex-col">
                  <WeeklyStudyChart data={studyActivityData} subjects={subjects} />
                </div>
                <div className="md:col-span-1 lg:col-span-7 flex flex-col">
                  <ExamResultsChart
                    data={examResultsData}
                    subjects={subjects}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    revisionGoals={revisionGoals}
                  />
                </div>

                <div className="md:col-span-1 lg:col-span-7 flex flex-col">
                  <SubjectPerformanceChart
                    data={subjectPerformanceData}
                    viewMode={pieChartMode}
                    onViewModeChange={setPieChartMode}
                  />
                </div>
                <div className="md:col-span-1 lg:col-span-5 flex flex-col">
                  <AccuracyTrendChart />
                </div>

                <div className="md:col-span-2 lg:col-span-12">
                  <RecentExamsTable exams={recentExams} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Weak topics tab */}
          <TabsContent value="weak-topics" className="mt-0">
            <WeakTopicsTab topics={topics} loading={weakTopicsLoading} />
          </TabsContent>
        </Tabs>

        {/* Stats Drilldown Drawer */}
        <StatsDrilldownDrawer
          type={drilldown.activeDrawer}
          onClose={drilldown.closeDrawer}
          loading={drilldown.loading}
          completedExams={drilldown.completedExams}
          averageScore={drilldown.averageScore}
          scoreBreakdown={drilldown.scoreBreakdown}
          excludedCount={drilldown.excludedCount}
          totalHours={drilldown.totalHours}
          studySessions={drilldown.studySessions}
          weeklyBreakdown={drilldown.weeklyBreakdown}
          streakData={drilldown.streakData}
          studyTimeRange={drilldown.studyTimeRange}
          onStudyTimeRangeChange={drilldown.handleStudyTimeRangeChange}
        />
      </div>
    </DashboardLayout>
  );
};

export default Stats;