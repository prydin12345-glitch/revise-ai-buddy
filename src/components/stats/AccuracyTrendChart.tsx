import { useEffect, useMemo, useState } from "react";
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
  subWeeks,
  startOfWeek,
  endOfWeek,
  format,
  isWithinInterval,
} from "date-fns";
import { TrendingUp, TrendingDown, Minus, Maximize2, LineChart as LineChartIcon } from "lucide-react";
import { DiagramModal } from "@/components/shared/DiagramModal";
import { supabase } from "@/integrations/supabase/client";

interface SubmissionRow {
  submitted_at: string | null;
  total_score: number | null;
  total_marks: number | null;
  status: string | null;
}

const ChartBody = ({
  data,
  height,
}: {
  data: Array<{ week: string; score: number | null; examCount: number; isEmpty: boolean }>;
  height: number;
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
      <XAxis
        dataKey="week"
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
        width={32}
      />
      <Tooltip
        cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
        content={({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null;
          const point = payload[0]?.payload;
          if (!point || point.isEmpty || point.score === null) return null;
          return (
            <div
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 2 }}>
                Week of {label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "hsl(var(--foreground))" }}>
                {point.score}%
              </div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                {point.examCount} exam{point.examCount !== 1 ? "s" : ""} completed
              </div>
            </div>
          );
        }}
      />
      <ReferenceLine
        y={70}
        stroke="hsl(142 71% 45%)"
        strokeDasharray="4 4"
        strokeWidth={1}
        label={{ value: "Good", position: "right", fontSize: 9, fill: "hsl(142 71% 45%)" }}
      />
      <ReferenceLine
        y={50}
        stroke="hsl(25 95% 53%)"
        strokeDasharray="4 4"
        strokeWidth={1}
        label={{ value: "Pass", position: "right", fontSize: 9, fill: "hsl(25 95% 53%)" }}
      />
      <Line
        type="monotone"
        dataKey="score"
        stroke="hsl(var(--primary))"
        strokeWidth={2.5}
        dot={(props: any) => {
          const { cx, cy, payload, key } = props;
          if (!payload || payload.isEmpty || payload.score === null) {
            return <g key={key} />;
          }
          return (
            <circle
              key={key}
              cx={cx}
              cy={cy}
              r={4}
              fill="hsl(var(--card))"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
            />
          );
        }}
        activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
        connectNulls={false}
      />
    </LineChart>
  </ResponsiveContainer>
);

export const AccuracyTrendChart = () => {
  const [expanded, setExpanded] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const since = subWeeks(new Date(), 12).toISOString();
      const { data } = await supabase
        .from("exam_submissions")
        .select("submitted_at, total_score, total_marks, status")
        .eq("student_id", user.id)
        .eq("status", "graded")
        .gte("submitted_at", since);
      setSubmissions(data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const chartData = useMemo(() => {
    const now = new Date();
    const weeks: Array<{
      week: string;
      score: number | null;
      examCount: number;
      isEmpty: boolean;
    }> = [];

    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });

      const weekSubs = submissions.filter((s) => {
        if (!s.submitted_at) return false;
        const date = new Date(s.submitted_at);
        return isWithinInterval(date, { start: weekStart, end: weekEnd });
      });

      const scores = weekSubs
        .map((s) => {
          if (s.total_score == null || !s.total_marks) return null;
          return (s.total_score / s.total_marks) * 100;
        })
        .filter((s): s is number => s !== null && s >= 0 && s <= 100);

      const avgScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;

      weeks.push({
        week: format(weekStart, "dd MMM"),
        score: avgScore,
        examCount: weekSubs.length,
        isEmpty: avgScore === null,
      });
    }

    return weeks;
  }, [submissions]);

  const trendData = useMemo(() => {
    const withScores = chartData.filter((w) => w.score !== null);
    if (withScores.length < 2) return null;

    const recent = withScores.slice(-4);
    const previous = withScores.slice(-8, -4);
    if (recent.length === 0) return null;

    const recentAvg =
      recent.reduce((a, b) => a + (b.score ?? 0), 0) / recent.length;
    const previousAvg =
      previous.length > 0
        ? previous.reduce((a, b) => a + (b.score ?? 0), 0) / previous.length
        : null;
    const overallAvg =
      withScores.reduce((a, b) => a + (b.score ?? 0), 0) / withScores.length;

    return {
      recentAvg: Math.round(recentAvg),
      previousAvg: previousAvg !== null ? Math.round(previousAvg) : null,
      overallAvg: Math.round(overallAvg),
      direction:
        previousAvg === null
          ? "neutral"
          : recentAvg > previousAvg + 2
          ? "up"
          : recentAvg < previousAvg - 2
          ? "down"
          : "neutral",
      change: previousAvg !== null ? Math.round(recentAvg - previousAvg) : null,
    };
  }, [chartData]);

  const hasData = chartData.some((w) => w.score !== null);

  const TrendIcon =
    trendData?.direction === "up"
      ? TrendingUp
      : trendData?.direction === "down"
      ? TrendingDown
      : Minus;

  const trendColor =
    trendData?.direction === "up"
      ? "hsl(142 71% 45%)"
      : trendData?.direction === "down"
      ? "hsl(0 84% 60%)"
      : "hsl(var(--muted-foreground))";

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="px-[18px] py-3.5 border-b border-border flex justify-between items-center gap-2 flex-shrink-0">
          <div className="min-w-0">
            <div
              className="text-[13px] font-semibold text-foreground truncate"
              style={{ letterSpacing: "-0.2px" }}
            >
              Accuracy Trend
            </div>
            <div className="text-[11px] text-muted-foreground mt-px truncate">
              Average score per week · last 12 weeks
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {trendData && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-md"
                style={{
                  background: `${trendColor}18`,
                  color: trendColor,
                }}
              >
                <TrendIcon size={11} />
                <span className="text-[11px] font-semibold">
                  {trendData.change !== null
                    ? `${trendData.change > 0 ? "+" : ""}${trendData.change}%`
                    : `${trendData.recentAvg}%`}
                </span>
              </div>
            )}
            <button
              onClick={() => setExpanded(true)}
              className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Expand chart"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        {trendData && (
          <div className="px-[18px] pt-3 grid grid-cols-3 gap-2">
            {[
              {
                label: "Recent avg",
                value: `${trendData.recentAvg}%`,
                color:
                  trendData.recentAvg >= 70
                    ? "hsl(142 71% 45%)"
                    : trendData.recentAvg >= 50
                    ? "hsl(25 95% 53%)"
                    : "hsl(0 84% 60%)",
              },
              {
                label: "All-time avg",
                value: `${trendData.overallAvg}%`,
                color: "hsl(var(--primary))",
              },
              {
                label: "vs last 4 wks",
                value:
                  trendData.change !== null
                    ? `${trendData.change > 0 ? "+" : ""}${trendData.change}%`
                    : "—",
                color: trendColor,
              },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <span
                  className="text-[15px] font-bold"
                  style={{ color: stat.color, letterSpacing: "-0.3px" }}
                >
                  {stat.value}
                </span>
                <span className="text-[10px] text-muted-foreground mt-px">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        <div className="px-2 pb-3 pt-2 flex-1 min-h-0">
          {loading ? (
            <div className="h-[200px] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : hasData ? (
            <ChartBody data={chartData} height={200} />
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center gap-3 px-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <LineChartIcon size={22} className="text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="text-xs text-muted-foreground max-w-[220px]">
                Complete exams to see your accuracy trend
              </div>
            </div>
          )}
        </div>
      </div>

      <DiagramModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Accuracy Trend — Last 12 Weeks"
      >
        <div style={{ width: "100%", padding: 8 }}>
          {hasData ? (
            <ChartBody data={chartData} height={420} />
          ) : (
            <div className="text-center text-sm text-muted-foreground py-12">
              No exam data yet
            </div>
          )}
        </div>
      </DiagramModal>
    </>
  );
};
