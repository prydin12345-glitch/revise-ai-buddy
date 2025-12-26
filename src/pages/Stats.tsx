import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, AlertCircle } from "lucide-react";
import { TopStatsCards } from "@/components/stats/TopStatsCards";
import { ExamResultsChart } from "@/components/stats/ExamResultsChart";
import { SubjectPerformanceChart } from "@/components/stats/SubjectPerformanceChart";
import { WeeklyStudyChart } from "@/components/stats/WeeklyStudyChart";
import { RecentExamsTable } from "@/components/stats/RecentExamsTable";
import { BestSubjectCard } from "@/components/stats/BestSubjectCard";
import { useExamStats } from "@/hooks/useExamStats";
import { useStatsDrilldown } from "@/hooks/useStatsDrilldown";
import { StatsDrilldownDrawer } from "@/components/dashboard/StatsDrilldownDrawer";
import { Card, CardContent } from "@/components/ui/card";

const Stats = () => {
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

  const subjects = subjectPerformanceData.map(s => ({ name: s.name, color: s.color }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground">Loading your statistics...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <Tabs defaultValue="stats" className="w-full">
          <div className="flex items-center gap-4 mb-8">
            <TabsList className="inline-flex h-12 items-center justify-start rounded-full bg-muted/50 p-1.5">
              <TabsTrigger 
                value="stats" 
                className="rounded-full px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Stats
              </TabsTrigger>
              <TabsTrigger 
                value="weak-topics"
                className="rounded-full px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Weak Topics
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="stats" className="space-y-6">
            {/* Top Stats Cards */}
            <TopStatsCards 
              totalExams={totalExams}
              completedExams={completedExams}
              inProgressExams={inProgressExams}
              currentStreak={currentStreak}
              longestStreak={longestStreak}
              onCardClick={drilldown.openDrawer}
            />

            {/* Best Subject Highlight */}
            {bestSubject && (
              <BestSubjectCard
                subjectName={bestSubject.name}
                subjectColor={bestSubject.color}
                avgScore={bestSubject.avgScore}
                totalExams={bestSubject.totalExams}
                trend={bestSubject.trend}
                trendValue={bestSubject.trendValue}
              />
            )}

            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-6">
              <ExamResultsChart
                data={examResultsData}
                subjects={subjects}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                revisionGoals={revisionGoals}
              />
              <SubjectPerformanceChart
                data={subjectPerformanceData}
                viewMode={pieChartMode}
                onViewModeChange={setPieChartMode}
              />
            </div>

            {/* Weekly Study Activity */}
            <WeeklyStudyChart
              data={studyActivityData}
              subjects={subjects}
            />

            {/* Recent Exams Table */}
            <RecentExamsTable exams={recentExams} />
          </TabsContent>

          <TabsContent value="weak-topics">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Weak Topics Analysis Coming Soon</p>
                  <p className="text-sm">
                    We're analyzing your exam performance to identify areas that need more attention.
                  </p>
                </div>
              </CardContent>
            </Card>
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
        />
      </div>
    </DashboardLayout>
  );
};

export default Stats;
