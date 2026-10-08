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
  DialogDescription,
} from "@/components/ui/dialog";
import { ChartDataTable } from "./ChartDataTable";
import { chartColour } from "./chart-palette";
import { format, startOfWeek, addDays, subWeeks } from "date-fns";

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

  const weekLabel = useMemo(() => {
    const now = new Date();
    const target = weekOffset === 0 ? now : subWeeks(now, -weekOffset);
    const ws = startOfWeek(target, { weekStartsOn: 1 });
    const we = addDays(ws, 6);
    return `${format(ws, "EEE d")} - ${format(we, "d MMM")}`;
  }, [weekOffset]);

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
        0,
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
      <BarChart
        data={data}
        accessibilityLayer
        margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tickFormatter={(day: string) => day.slice(0, 3)}
          interval={0}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}h`}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        {subjects.map((subject, index) => (
          <Bar
            key={subject.name}
            dataKey={subject.name}
            stackId="study"
            fill={chartColour(index)}
            isAnimationActive={false}
            radius={[2, 2, 0, 0]}
            stroke="hsl(var(--card))"
            strokeWidth={1}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <>
      <div className="stats-panel overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="stats-panel-heading flex-shrink-0 flex flex-col gap-3">
          <div className="min-w-0">
            <div className="min-w-0">
              <h2>Study activity</h2>
              <div className="text-[11px] text-muted-foreground mt-px">
                Recorded hours this week
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-1">
            <button
              aria-label="Previous week"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="stats-chart-control rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] text-muted-foreground font-medium min-w-[100px] text-center">
              {weekLabel}
            </span>
            <button
              aria-label="Next week"
              onClick={() => setWeekOffset((o) => Math.min(o + 1, 0))}
              disabled={isCurrentWeek}
              className="stats-chart-control rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setExpanded(true)}
              className="stats-chart-control rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-1"
              aria-label="Expand study activity"
              title="Expand chart"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {!isCurrentWeek && (
          <p className="px-5 text-xs text-muted-foreground">
            Recorded data covers the current week; historical week data is
            unavailable here.
          </p>
        )}
        {/* Chart */}
        <div className="p-4 flex-1 min-h-0">
          {data.length > 0 && subjects.length > 0 ? (
            <ChartBody height={170} />
          ) : (
            <EmptyChartState
              message="Start tracking your study time"
              icon={Clock}
              height={200}
            />
          )}
        </div>
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-2 px-5 pb-4 text-xs text-muted-foreground">
            {subjects.map((s, index) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: chartColour(index) }}
                />
                {s.name}
              </span>
            ))}
          </div>
        )}
        <ChartDataTable
          caption="Study activity this week"
          rows={data}
          series={subjects.map((s) => ({ key: s.name, label: s.name }))}
          periodKey="day"
          unit="h"
        />
      </div>

      {/* Expanded modal */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="stats-chart-dialog max-w-[800px] w-[90vw]">
          <DialogHeader>
            <DialogTitle>Study activity · {weekLabel}</DialogTitle>
            <DialogDescription>
              Recorded hours from the current week, grouped by subject.
            </DialogDescription>
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
                {subjects.map((s, index) => (
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
