import { useState } from "react";
import {
  AreaChart,
  Area,
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

const GRADIENTS = (subjects: Array<{ name: string; color: string }>) =>
  subjects.map((s) => ({
    id: `grad-${s.name.replace(/\s/g, "")}`,
    color: s.color,
  }));

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
  const grads = GRADIENTS(subjects);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <defs>
          {grads.map((g) => (
            <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={g.color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={g.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
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
        {subjects.map((subject, i) => (
          <Area
            key={subject.name}
            type="monotone"
            dataKey={subject.name}
            stroke={subject.color}
            strokeWidth={2.5}
            fill={`url(#${grads[i]?.id})`}
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
      </AreaChart>
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

  const timeRangeLabels: Record<string, string> = {
    weekly: "1D",
    monthly: "1M",
    yearly: "1Y",
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
          <div className="flex gap-1 items-center">
            {/* Pill time range selector like the reference image */}
            <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
              {Object.entries(timeRangeLabels).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => onTimeRangeChange(val as any)}
                  className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                    timeRange === val
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-1"
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

        {/* Subject legend — circular dots like reference */}
        {subjects.length > 0 && data.length > 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-4 justify-center">
            {subjects.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border-2"
                  style={{ borderColor: s.color, background: `${s.color}30` }}
                />
                <span className="text-xs text-muted-foreground font-medium">
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
              <div className="mt-4 flex flex-wrap gap-4 justify-center">
                {subjects.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border-2"
                      style={{ borderColor: s.color, background: `${s.color}30` }}
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
