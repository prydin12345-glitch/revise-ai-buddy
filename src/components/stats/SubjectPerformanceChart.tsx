import { BookOpen } from "lucide-react";
import { EmptyChartState } from "./EmptyChartState";
import { useNavigate } from "react-router-dom";

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
}

const getScoreColour = (score: number): string => {
  if (score >= 70) return "#22c55e";
  if (score >= 50) return "#f97316";
  return "#ef4444";
};

export const SubjectPerformanceChart = ({
  data,
}: SubjectPerformanceChartProps) => {
  const navigate = useNavigate();
  const sorted = [...data].sort((a, b) => b.avgScore - a.avgScore);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="text-sm font-semibold text-foreground">
          Subject Performance
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Average score per subject
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 flex-1">
        {sorted.length === 0 ? (
          <EmptyChartState
            message="No exam data yet"
            icon={BookOpen}
            action={{
              label: "Create an exam",
              onClick: () => navigate("/my-exams"),
            }}
            height={200}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map((subject) => {
              const scoreColour = getScoreColour(subject.avgScore);
              return (
                <div key={subject.name}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: subject.color }}
                      />
                      <span className="text-[13px] font-medium text-foreground">
                        {subject.name}
                      </span>
                    </div>
                    <span
                      className="text-[13px] font-bold tabular-nums"
                      style={{ color: scoreColour }}
                    >
                      {Math.round(subject.avgScore)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(subject.avgScore, 100)}%`,
                        background: scoreColour,
                        transition: "width 0.8s ease",
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {subject.count} exam{subject.count !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
