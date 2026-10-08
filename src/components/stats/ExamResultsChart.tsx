import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Maximize2, FileText } from "lucide-react";
import { EmptyChartState } from "./EmptyChartState";
import { ChartDataTable } from "./ChartDataTable";
import { chartColour, chartDash } from "./chart-palette";
import { useNavigate } from "react-router-dom";

interface ExamResultsChartProps {
  data: Array<{ period: string; [key: string]: number | string }>;
  subjects: Array<{ name: string; color: string }>;
  timeRange: "weekly" | "monthly" | "yearly";
  onTimeRangeChange: (range: "weekly" | "monthly" | "yearly") => void;
  revisionGoals: Array<{
    subject: string;
    targetPercentage: number;
    deadline: string;
    currentAverage: number;
    color: string;
  }>;
}

const ChartContent = ({
  data,
  subjects,
  revisionGoals,
  height,
}: {
  data: ExamResultsChartProps["data"];
  subjects: ExamResultsChartProps["subjects"];
  revisionGoals: ExamResultsChartProps["revisionGoals"];
  height: number;
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          width={35}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: any, name: string) => [
            `${Math.round(value)}%`,
            name,
          ]}
          labelStyle={{
            color: "hsl(var(--foreground))",
            marginBottom: 4,
            fontWeight: 600,
          }}
        />
        {subjects.map((subject, index) => (
          <Line
            key={subject.name}
            type="monotone"
            dataKey={subject.name}
            stroke={chartColour(index)}
            strokeDasharray={chartDash(index)}
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 5, fill: chartColour(index), strokeWidth: 0 }}
            connectNulls
            name={subject.name}
          />
        ))}
        {revisionGoals.map((goal) => (
          <ReferenceLine
            key={`goal-${goal.subject}`}
            y={goal.targetPercentage}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `Goal: ${goal.targetPercentage}%`,
              position: "insideTopRight",
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export const ExamResultsChart = ({
  data,
  subjects,
  timeRange,
  onTimeRangeChange,
  revisionGoals,
}: ExamResultsChartProps) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const timeRangeOptions: Array<{
    key: "weekly" | "monthly" | "yearly";
    label: string;
  }> = [
    { key: "weekly", label: "7 days" },
    { key: "monthly", label: "30 days" },
    { key: "yearly", label: "12 months" },
  ];

  return (
    <>
      <div className="stats-panel overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="stats-panel-heading flex-shrink-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="flex justify-between items-start sm:items-center gap-2">
            <div className="min-w-0">
              <h2>Score trends</h2>
              <div className="text-[11px] text-muted-foreground mt-px truncate">
                Average score per period
              </div>
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="sm:hidden stats-chart-control rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              aria-label="Expand score trends"
              title="Expand chart"
            >
              <Maximize2 size={13} />
            </button>
          </div>
          <div className="flex gap-1.5 items-center justify-end">
            {/* Pill time range selector */}
            <div className="flex bg-muted rounded-lg p-[3px] gap-[2px]">
              {timeRangeOptions.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => onTimeRangeChange(key)}
                  aria-pressed={timeRange === key}
                  className="min-h-9 text-xs font-medium transition-colors"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "none",
                    background:
                      timeRange === key ? "hsl(var(--card))" : "transparent",
                    color:
                      timeRange === key
                        ? "hsl(var(--foreground))"
                        : "hsl(var(--muted-foreground))",
                    fontSize: 11,
                    fontWeight: timeRange === key ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="hidden sm:flex stats-chart-control rounded-md bg-background border border-border items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Expand score trends"
              title="Expand chart"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="p-4 flex-1 min-h-0">
          {data.length === 0 || subjects.length === 0 ? (
            <EmptyChartState
              message="Complete your first exam to see results here"
              icon={FileText}
              action={{
                label: "Take an exam",
                onClick: () => navigate("/my-exams"),
              }}
              height={200}
            />
          ) : (
            <ChartContent
              data={data}
              subjects={subjects}
              revisionGoals={revisionGoals}
              height={220}
            />
          )}
        </div>

        {/* Subject legend */}
        {subjects.length > 0 && data.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 pb-3 pt-1 border-t border-border mt-1">
            {subjects.map((s, index) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: chartColour(index) }}
                />
                <span className="text-xs text-muted-foreground break-words">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}
        <ChartDataTable
          caption="Score trends"
          rows={data}
          series={subjects.map((s) => ({ key: s.name, label: s.name }))}
        />
      </div>

      {/* Expanded modal */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="stats-chart-dialog max-w-[900px] w-[90vw]">
          <DialogHeader>
            <DialogTitle>Score trends</DialogTitle>
            <DialogDescription>
              Average exam score per period, using the selected date range.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            {data.length > 0 && subjects.length > 0 && (
              <ChartContent
                data={data}
                subjects={subjects}
                revisionGoals={revisionGoals}
                height={400}
              />
            )}
            {subjects.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4 justify-center">
                {subjects.map((s, index) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: chartColour(index) }}
                    />
                    <span className="text-xs text-muted-foreground font-medium">
                      {s.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
