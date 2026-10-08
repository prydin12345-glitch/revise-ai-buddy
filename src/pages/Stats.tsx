import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, AlertTriangle } from "lucide-react";
import { TopStatsCards } from "@/components/stats/TopStatsCards";
import { ExamResultsChart } from "@/components/stats/ExamResultsChart";
import { SubjectPerformanceChart } from "@/components/stats/SubjectPerformanceChart";
import { WeeklyStudyChart } from "@/components/stats/WeeklyStudyChart";
import { RecentExamsTable } from "@/components/stats/RecentExamsTable";
import { AccuracyTrendChart } from "@/components/stats/AccuracyTrendChart";
import { MobileStatsTelemetry } from "@/components/stats/mobile/MobileStatsTelemetry";
import { useExamStats } from "@/hooks/useExamStats";
import { useStatsDrilldown } from "@/hooks/useStatsDrilldown";
import { StatsDrilldownDrawer } from "@/components/dashboard/StatsDrilldownDrawer";
import { WeakTopicsTab } from "@/components/stats/WeakTopicsTab";
import { useUnifiedTopicPerformance } from "@/hooks/useUnifiedTopicPerformance";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  StatsPageHeading,
  StatsLoading,
  StatsError,
} from "@/components/stats/StatsPageStates";
import "@/styles/stats.css";

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
    error,
    refetch,
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
      0,
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

  // Deep links to ?tab=weak-topics land on the Topics tab of the single
  // mobile segmented control.
  const mobileInitialTab =
    searchParams.get("tab") === "weak-topics" ? "topics" : "overview";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="examly-stats mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
          <StatsPageHeading />
          <StatsLoading />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="examly-stats mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
          <StatsPageHeading />
          <StatsError
            onRetry={() => {
              void refetch();
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="examly-stats max-w-[1280px] mx-auto px-4 sm:px-6 pb-10 pt-6 sm:pt-8">
        <StatsPageHeading />
        {isMobile ? (
          /* One tab layer on mobile. The outer Stats / Weak Topics tabs wrapped
             a component that already had its own Overview / Topics / Performance
             control, and the outer "Weak Topics" tab duplicated the inner one. */
          <MobileStatsTelemetry
            avgScore={avgScore}
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            subjectPerformanceData={subjectPerformanceData}
            examResultsData={examResultsData}
            studyActivityData={studyActivityData}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            topics={topics}
            weakTopicsLoading={weakTopicsLoading}
            initialTab={mobileInitialTab}
          />
        ) : (
          <Tabs defaultValue={defaultTab} className="w-full">
            <div className="mb-5">
              <TabsList
                aria-label="Progress views"
                className="bg-muted rounded-lg p-1 gap-1 h-auto w-auto inline-flex"
              >
                <TabsTrigger
                  value="stats"
                  className="rounded-md px-4 py-2.5 text-sm gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="weak-topics"
                  className="rounded-md px-4 py-2.5 text-sm gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  Weak Topics
                  {weakCount > 0 && (
                    <span className="text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-px ml-0.5">
                      {weakCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="stats" className="mt-0">
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5"
                style={{ alignItems: "stretch" }}
              >
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

                <div className="min-w-0 md:col-span-2 lg:col-span-8 flex flex-col">
                  <ExamResultsChart
                    data={examResultsData}
                    subjects={subjects}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    revisionGoals={revisionGoals}
                  />
                </div>
                <div className="min-w-0 md:col-span-1 lg:col-span-4 flex flex-col">
                  <WeeklyStudyChart
                    data={studyActivityData}
                    subjects={subjects}
                  />
                </div>

                <div className="min-w-0 md:col-span-1 lg:col-span-7 flex flex-col">
                  <SubjectPerformanceChart
                    data={subjectPerformanceData}
                    viewMode={pieChartMode}
                    onViewModeChange={setPieChartMode}
                  />
                </div>
                <div className="min-w-0 md:col-span-2 lg:col-span-5 flex flex-col">
                  <AccuracyTrendChart />
                </div>

                <div className="md:col-span-2 lg:col-span-12">
                  <RecentExamsTable exams={recentExams} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="weak-topics" className="mt-0">
              <WeakTopicsTab topics={topics} loading={weakTopicsLoading} />
            </TabsContent>
          </Tabs>
        )}

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
