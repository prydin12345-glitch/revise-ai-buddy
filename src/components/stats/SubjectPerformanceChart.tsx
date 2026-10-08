import { useState } from "react";
import { ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { chartColour } from "./chart-palette";
import { SubjectHistoryBars } from "./SubjectHistoryBars";

interface SubjectPerformanceChartProps {
  data: Array<{
    name: string;
    value: number;
    count: number;
    avgScore: number;
    color: string;
  }>;
  viewMode: "score" | "count";
  onViewModeChange: (mode: "score" | "count") => void;
  trendData?: Array<{ period: string; [key: string]: string | number }>;
}

export const SubjectPerformanceChart = ({
  data,
  trendData = [],
}: SubjectPerformanceChartProps) => {
  const navigate = useNavigate();
  const sorted = [...data].sort((a, b) => b.avgScore - a.avgScore);
  const [activeIndex, setActiveIndex] = useState(0);
  const goTo = (newIndex: number) => {
    if (sorted.length === 0) return;
    setActiveIndex(
      ((newIndex % sorted.length) + sorted.length) % sorted.length,
    );
  };
  // Two compact panels; existing selection controls keep every subject available.
  const visible =
    sorted.length > 1
      ? [
          sorted[activeIndex % sorted.length],
          sorted[(activeIndex + 1) % sorted.length],
        ]
      : sorted;
  return (
    <section
      className="stats-subject-snapshots flex flex-col"
      aria-label="Subject snapshots"
    >
      <div className="stats-section-heading flex items-start justify-between gap-3">
        <div>
          <h2>Subject snapshots</h2>
          <p>History follows selected range</p>
        </div>
        {sorted.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              className="stats-chart-control flex items-center justify-center border border-border text-muted-foreground hover:text-foreground"
              aria-label="Previous subject"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs tabular-nums text-muted-foreground px-1">
              {activeIndex + 1}/{sorted.length}
            </span>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              className="stats-chart-control flex items-center justify-center border border-border text-muted-foreground hover:text-foreground"
              aria-label="Next subject"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <BarChart2
            size={24}
            className="text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">No exam data yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Complete an exam to see your subject performance here.
          </p>
          <button
            type="button"
            onClick={() => navigate("/my-exams")}
            className="rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
          >
            Create an exam
          </button>
        </div>
      ) : (
        <div className="stats-subject-tiles">
          {visible.map((subject, index) => (
            <div
              key={subject.name}
              className="stats-subject-tile"
              aria-current={index === 0 ? "true" : undefined}
            >
              <SubjectHistoryBars
                subject={subject.name}
                rows={trendData}
                colour={chartColour(data.indexOf(subject))}
              />
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-medium">
                    {subject.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {subject.count} exam{subject.count === 1 ? "" : "s"} ·{" "}
                    {subject.avgScore >= 70
                      ? "Strong"
                      : subject.avgScore >= 50
                        ? "Developing"
                        : "Needs Work"}
                  </p>
                </div>
                <span className="stats-subject-score">
                  {Math.round(subject.avgScore)}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-label={`${subject.name} average exam score`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={subject.avgScore}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(Math.max(subject.avgScore, 0), 100)}%`,
                    background: chartColour(data.indexOf(subject)),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {sorted.length > 0 && (
        <p className="stats-selected-subject" aria-live="polite">
          Selected: {visible[0]?.name} ·{" "}
          {Math.round(visible[0]?.avgScore ?? 0)}%
        </p>
      )}
    </section>
  );
};
