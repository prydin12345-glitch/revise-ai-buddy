import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subWeeks, startOfWeek, addDays, subDays, eachDayOfInterval } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MoreHorizontal } from "lucide-react";

export const ActivityHeatmap = () => {
  const [dailyData, setDailyData] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const since = subWeeks(new Date(), 12).toISOString();

      const [{ data: submissions }, { data: practice }] = await Promise.all([
        supabase
          .from("exam_submissions")
          .select("submitted_at, time_taken_seconds")
          .eq("student_id", user.id)
          .eq("status", "graded")
          .gte("submitted_at", since),
        supabase
          .from("practice_set_progress")
          .select("completed_at, time_spent_seconds")
          .eq("user_id", user.id)
          .not("completed_at", "is", null)
          .gte("completed_at", since),
      ]);

      const map: Record<string, number> = {};

      submissions?.forEach((s) => {
        if (!s.submitted_at) return;
        const key = format(new Date(s.submitted_at), "yyyy-MM-dd");
        map[key] = (map[key] || 0) + (s.time_taken_seconds || 0) / 3600;
      });

      practice?.forEach((p) => {
        if (!p.completed_at) return;
        const key = format(new Date(p.completed_at), "yyyy-MM-dd");
        map[key] = (map[key] || 0) + (p.time_spent_seconds || 0) / 3600;
      });

      setDailyData(map);
    };
    fetchData();
  }, []);

  // Build last 7 days chart data for the "returning customer rate" style
  const chartData = useMemo(() => {
    const now = new Date();
    const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return {
        day: format(d, "EEE"),
        hours: Math.round((dailyData[key] || 0) * 100) / 100,
      };
    });
  }, [dailyData]);

  // Total and trend
  const totalHours = useMemo(
    () => Object.values(dailyData).reduce((a, b) => a + b, 0),
    [dailyData]
  );

  const thisWeekHours = useMemo(() => {
    return chartData.reduce((s, d) => s + d.hours, 0);
  }, [chartData]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex justify-between items-center">
        <div>
          <div className="text-sm font-semibold text-foreground">
            Study Activity
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Hours studied over time
          </div>
        </div>
        <button className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="px-5 pt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground tracking-tight">
          {totalHours.toFixed(1)}h
        </span>
        {thisWeekHours > 0 && (
          <span className="text-[11px] text-primary font-medium">
            +{thisWeekHours.toFixed(1)}h this week
          </span>
        )}
      </div>

      {/* Area chart */}
      <div className="px-2 pb-3 pt-2 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: any) => [`${Number(value).toFixed(1)}h`, "Study"]}
            />
            <Area
              type="monotone"
              dataKey="hours"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#activityGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
