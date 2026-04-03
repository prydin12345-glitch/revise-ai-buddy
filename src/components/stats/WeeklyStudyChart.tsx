import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Clock } from "lucide-react";
import { EmptyChartState } from "./EmptyChartState";

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

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Weekly Study
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Total time per day this week
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 flex-1 min-h-0">
        {data.length > 0 && subjects.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
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
        ) : (
          <EmptyChartState
            message="Start tracking your study time"
            icon={Clock}
            height={220}
          />
        )}
      </div>
    </div>
  );
};
