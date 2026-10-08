import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, AlertTriangle } from "lucide-react";
import { ScoreTargetChart } from "@/components/stats/ScoreTargetChart";
import { SubjectScoresChart } from "@/components/stats/SubjectScoresChart";
import { SubjectPerformanceChart } from "@/components/stats/SubjectPerformanceChart";
import { WeeklyStudyChart } from "@/components/stats/WeeklyStudyChart";
import { AccuracyTrendChart } from "@/components/stats/AccuracyTrendChart";
import {
  DesktopLearningGauges,
  TopicProgressOverview,
} from "@/components/stats/TopicProgressOverview";
import { RevisionPrioritiesCard } from "@/components/stats/RevisionPrioritiesCard";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  const [desktopTab, setDesktopTab] = useState(defaultTab);
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
          <StatsPageHeading
            actions={
              !isMobile && <Skeleton className="h-[52px] w-72 max-w-full" />
            }
          />
          <StatsLoading showTabs={isMobile} />
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
        {isMobile ? (
          /* One tab layer on mobile. The outer Stats / Weak Topics tabs wrapped
             a component that already had its own Overview / Topics / Performance
             control, and the outer "Weak Topics" tab duplicated the inner one. */
          <>
            <StatsPageHeading />
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
              totalExams={totalExams}
              completedExams={completedExams}
              inProgressExams={inProgressExams}
              totalStudyHours={totalStudyHours}
              bestSubject={bestSubject}
              revisionGoals={revisionGoals}
              viewMode={pieChartMode}
              onViewModeChange={setPieChartMode}
              onSummaryClick={drilldown.openDrawer}
            />
          </>
        ) : (
          <Tabs
            value={desktopTab}
            onValueChange={setDesktopTab}
            className="w-full"
          >
            <StatsPageHeading
              actions={
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
              }
            />

            <TabsContent value="stats" className="mt-0">
              <div className="stats-dashboard">
                <div className="stats-dashboard-column stats-dashboard-history">
                  <SubjectScoresChart
                    data={subjectPerformanceData}
                    viewMode={pieChartMode}
                    onViewModeChange={setPieChartMode}
                  />
                  <WeeklyStudyChart
                    data={studyActivityData}
                    subjects={subjects}
                  />
                </div>

                <div className="stats-dashboard-column stats-dashboard-learning">
                  <RevisionPrioritiesCard
                    topics={topics}
                    loading={weakTopicsLoading}
                    limit={2}
                    action={
                      <button
                        type="button"
                        className="stats-view-link"
                        onClick={() => setDesktopTab("weak-topics")}
                      >
                        View all
                      </button>
                    }
                  />
                  <ScoreTargetChart
                    data={examResultsData}
                    subjects={subjectPerformanceData}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    revisionGoals={revisionGoals}
                  />
                </div>

                <div className="stats-dashboard-column stats-dashboard-subjects">
                  <SubjectPerformanceChart
                    data={subjectPerformanceData}
                    viewMode={pieChartMode}
                    onViewModeChange={setPieChartMode}
                    trendData={examResultsData}
                  />
                  <AccuracyTrendChart />
                </div>
                <div className="stats-dashboard-progress">
                  <div>
                    <div className="stats-section-heading">
                      <h2>Learning progress</h2>
                    </div>
                    <DesktopLearningGauges
                      topics={topics}
                      average={avgScore}
                      streak={currentStreak}
                      bestStreak={longestStreak}
                      hasExams={subjectPerformanceData.some(
                        (subject) => subject.count > 0,
                      )}
                      loading={weakTopicsLoading}
                    />
                  </div>
                  <TopicProgressOverview
                    topics={topics}
                    loading={weakTopicsLoading}
                    action={
                      <button
                        type="button"
                        className="stats-view-link"
                        onClick={() => setDesktopTab("weak-topics")}
                      >
                        Explore
                      </button>
                    }
                  />
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
