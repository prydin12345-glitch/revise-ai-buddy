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
              <stop offset="5%" stopColor={g.color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={g.color} stopOpacity={0.02} />
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
            dot={false}
            activeDot={{ r: 5, fill: subject.color, strokeWidth: 0 }}
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

  const timeRangeOptions: Array<{ key: "weekly" | "monthly" | "yearly"; label: string }> = [
    { key: "weekly", label: "1W" },
    { key: "monthly", label: "1M" },
    { key: "yearly", label: "1Y" },
  ];

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="px-[18px] py-3.5 flex justify-between items-center border-b border-border flex-shrink-0">
          <div>
            <div className="text-[13px] font-semibold text-foreground" style={{ letterSpacing: "-0.2px" }}>
              Exam Results Over Time
            </div>
            <div className="text-[11px] text-muted-foreground mt-px">
              Score percentage per submission
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            {/* Pill time range selector */}
            <div className="flex bg-muted rounded-lg p-[3px] gap-[2px]">
              {timeRangeOptions.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => onTimeRangeChange(key)}
                  className="font-inherit transition-all"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: timeRange === key ? "hsl(var(--card))" : "transparent",
                    color: timeRange === key ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    fontSize: 11,
                    fontWeight: timeRange === key ? 600 : 400,
                    cursor: "pointer",
                    boxShadow: timeRange === key ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
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
            {subjects.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: s.color, border: `2px solid ${s.color}40` }}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
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
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: s.color, border: `2px solid ${s.color}40` }}
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