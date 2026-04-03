import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Clock, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { EmptyChartState } from "./EmptyChartState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, startOfWeek, addDays, subWeeks, addWeeks, isSameWeek } from "date-fns";

interface WeeklyStudyChartProps {
  data: Array<{
    day: string;
    [key: string]: number | string;
  }>;
  subjects: Array<{
    name: string;
    color: string;
  }>;
}

export const WeeklyStudyChart = ({ data, subjects }: WeeklyStudyChartProps) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const isCurrentWeek = weekOffset === 0;

  // Compute the week date range label
  const weekLabel = useMemo(() => {
    const now = new Date();
    const target = weekOffset === 0 ? now : subWeeks(now, -weekOffset);
    const ws = startOfWeek(target, { weekStartsOn: 1 });
    const we = addDays(ws, 6);
    return `${format(ws, "EEE d")} - ${format(we, "d MMM")}`;
  }, [weekOffset]);

  // Total hours for the week
  const totalHours = useMemo(() => {
    let total = 0;
    data.forEach((day) => {
      Object.entries(day).forEach(([key, val]) => {
        if (key !== "day" && typeof val === "number") total += val;
      });
    });
    return total;
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce(
        (sum: number, entry: any) => sum + (entry.value || 0),
        0
      );
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
          <p className="font-semibold text-foreground mb-1.5">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.fill }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-medium text-foreground ml-auto">
                {entry.value.toFixed(1)}h
              </span>
            </div>
          ))}
          <div className="mt-1.5 pt-1.5 border-t border-border font-semibold text-foreground">
            Total: {total.toFixed(1)}h
          </div>
        </div>
      );
    }
    return null;
  };

  const ChartBody = ({ height }: { height: number }) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}h`}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        {subjects.map((subject) => (
          <Bar
            key={subject.name}
            dataKey={subject.name}
            stackId="study"
            fill={subject.color}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                Weekly Study
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Total time per day
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Week navigation */}
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] text-muted-foreground font-medium min-w-[110px] text-center">
              {weekLabel}
            </span>
            <button
              onClick={() => setWeekOffset((o) => Math.min(o + 1, 0))}
              disabled={isCurrentWeek}
              className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setExpanded(true)}
              className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-1"
              title="Expand chart"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Total hours badge */}
        <div className="px-5 pt-3 flex gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {totalHours.toFixed(1)}h
            </span>
            <span className="text-[11px] text-muted-foreground">this week</span>
          </div>
        </div>

        {/* Chart */}
        <div className="p-4 flex-1 min-h-0">
          {data.length > 0 && subjects.length > 0 ? (
            <ChartBody height={180} />
          ) : (
            <EmptyChartState
              message="Start tracking your study time"
              icon={Clock}
              height={180}
            />
          )}
        </div>
      </div>

      {/* Expanded modal */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[800px] w-[90vw]">
          <DialogHeader>
            <DialogTitle>Weekly Study — {weekLabel}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {data.length > 0 && subjects.length > 0 ? (
              <ChartBody height={350} />
            ) : (
              <EmptyChartState
                message="Start tracking your study time"
                icon={Clock}
                height={350}
              />
            )}
            {subjects.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4 justify-center">
                {subjects.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: s.color }}
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
