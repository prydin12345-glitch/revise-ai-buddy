import { useState } from "react";
import { Activity, BarChart3, PieChart, LineChart } from "lucide-react";
import { WeeklyStudyChart } from "./WeeklyStudyChart";
import { ExamResultsChart } from "./ExamResultsChart";
import { SubjectPerformanceChart } from "./SubjectPerformanceChart";
import { AccuracyTrendChart } from "./AccuracyTrendChart";

type ChartKey = "activity" | "results" | "subjects" | "accuracy";

interface MobileChartSwitcherProps {
  studyActivityData: any[];
  subjects: { name: string; color: string }[];
  examResultsData: any[];
  subjectPerformanceData: any[];
  timeRange: any;
  setTimeRange: (v: any) => void;
  pieChartMode: any;
  setPieChartMode: (v: any) => void;
  revisionGoals: any;
}

const TABS: Array<{ key: ChartKey; label: string; icon: typeof Activity }> = [
  { key: "activity", label: "Activity", icon: Activity },
  { key: "results", label: "Results", icon: BarChart3 },
  { key: "subjects", label: "Subjects", icon: PieChart },
  { key: "accuracy", label: "Accuracy", icon: LineChart },
];

/**
 * Mobile-only segmented control that swaps between the four charts.
 * Keeps the viewport tidy and gives the charts a consistent footprint.
 */
export const MobileChartSwitcher = ({
  studyActivityData,
  subjects,
  examResultsData,
  subjectPerformanceData,
  timeRange,
  setTimeRange,
  pieChartMode,
  setPieChartMode,
  revisionGoals,
}: MobileChartSwitcherProps) => {
  const [active, setActive] = useState<ChartKey>("activity");

  return (
    <div className="space-y-2">
      {/* Segmented tab control */}
      <div
        role="tablist"
        aria-label="Charts"
        className="grid grid-cols-4 gap-1 p-1 bg-card border border-border rounded-xl"
      >
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.key)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} strokeWidth={2} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Chart container — single child rendered at a time */}
      <div>
        {active === "activity" && (
          <WeeklyStudyChart data={studyActivityData} subjects={subjects} />
        )}
        {active === "results" && (
          <ExamResultsChart
            data={examResultsData}
            subjects={subjects}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            revisionGoals={revisionGoals}
          />
        )}
        {active === "subjects" && (
          <SubjectPerformanceChart
            data={subjectPerformanceData}
            viewMode={pieChartMode}
            onViewModeChange={setPieChartMode}
          />
        )}
        {active === "accuracy" && <AccuracyTrendChart />}
      </div>
    </div>
  );
};
