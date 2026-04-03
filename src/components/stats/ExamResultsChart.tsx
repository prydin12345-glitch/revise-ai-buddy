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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2, FileText } from "lucide-react";
import { EmptyChartState } from "./EmptyChartState";
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
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
      <CartesianGrid
        strokeDasharray="3 3"
        stroke="hsl(var(--border))"
        vertical={false}
      />
      <XAxis
        dataKey="period"
        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        domain={[0, 100]}
        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
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
      {subjects.map((subject) => (
        <Line
          key={subject.name}
          type="monotone"
          dataKey={subject.name}
          stroke={subject.color}
          strokeWidth={2.5}
          dot={{ fill: subject.color, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: subject.color }}
          connectNulls
          name={subject.name}
        />
      ))}
      {revisionGoals.map((goal) => (
        <ReferenceLine
          key={`goal-${goal.subject}`}
          y={goal.targetPercentage}
          stroke={goal.color}
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{
            value: `Goal: ${goal.targetPercentage}%`,
            position: "right",
            fontSize: 10,
            fill: goal.color,
          }}
        />
      ))}
    </LineChart>
  </ResponsiveContainer>
);

export const ExamResultsChart = ({
  data,
  subjects,
  timeRange,
  onTimeRangeChange,
  revisionGoals,
}: ExamResultsChartProps) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const timeRangeLabels: Record<string, string> = {
    weekly: "7 days",
    monthly: "30 days",
    yearly: "1 year",
  };

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 flex justify-between items-center border-b border-border">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Exam Results Over Time
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Score percentage per submission
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
              <SelectTrigger className="h-7 text-[11px] w-[90px] bg-background border-border rounded-md px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(timeRangeLabels).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setExpanded(true)}
              className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
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
            />
          ) : (
            <ChartContent
              data={data}
              subjects={subjects}
              revisionGoals={revisionGoals}
              height={280}
            />
          )}
        </div>

        {/* Subject legend */}
        {subjects.length > 0 && data.length > 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-3">
            {subjects.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-[11px] text-muted-foreground">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded modal */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[900px] w-[90vw]">
          <DialogHeader>
            <DialogTitle>Exam Results Over Time</DialogTitle>
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
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                {subjects.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: s.color }}
                    />
                    <span className="text-xs text-muted-foreground">
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
