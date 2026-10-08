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
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Maximize2,
  LineChart as LineChartIcon,
} from "lucide-react";
import { DiagramModal } from "@/components/shared/DiagramModal";
import { ChartDataTable } from "./ChartDataTable";
import { Skeleton } from "@/components/ui/skeleton";
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
  data: Array<{
    week: string;
    score: number | null;
    examCount: number;
    isEmpty: boolean;
  }>;
  height: number;
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart
      accessibilityLayer
      data={data}
      margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
    >
      <CartesianGrid
        strokeDasharray="3 3"
        stroke="hsl(var(--border))"
        vertical={false}
      />
      <XAxis
        dataKey="week"
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
        width={44}
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
              <div
                style={{
                  fontSize: 11,
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: 2,
                }}
              >
                Week of {label}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "hsl(var(--foreground))",
                }}
              >
                {point.score}%
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 2,
                }}
              >
                {point.examCount} exam{point.examCount !== 1 ? "s" : ""}{" "}
                completed
              </div>
            </div>
          );
        }}
      />
      <ReferenceLine
        y={70}
        stroke="hsl(var(--muted-foreground))"
        strokeDasharray="4 4"
        strokeWidth={1}
        label={{
          value: "70%",
          position: "insideTopRight",
          fontSize: 11,
          fill: "hsl(var(--muted-foreground))",
        }}
      />
      <ReferenceLine
        y={50}
        stroke="hsl(var(--muted-foreground))"
        strokeDasharray="4 4"
        strokeWidth={1}
        label={{
          value: "50%",
          position: "insideTopRight",
          fontSize: 11,
          fill: "hsl(var(--muted-foreground))",
        }}
      />
      <Line
        type="monotone"
        dataKey="score"
        stroke="var(--stats-series-4)"
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
              stroke="var(--stats-series-4)"
              strokeWidth={2}
            />
          );
        }}
        activeDot={{ r: 6, fill: "var(--stats-series-4)" }}
        connectNulls={false}
        isAnimationActive={false}
      />
    </LineChart>
  </ResponsiveContainer>
);

export const AccuracyTrendChart = () => {
  const [expanded, setExpanded] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        const since = subWeeks(new Date(), 12).toISOString();
        const { data, error } = await supabase
          .from("exam_submissions")
          .select("submitted_at, total_score, total_marks, status")
          .eq("student_id", user.id)
          .eq("status", "graded")
          .gte("submitted_at", since);
        if (error) throw error;
        setSubmissions(data ?? []);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [retry]);

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
      ? "hsl(var(--success))"
      : trendData?.direction === "down"
        ? "hsl(var(--destructive))"
        : "hsl(var(--muted-foreground))";

  return (
    <>
      <div className="stats-panel stats-overall-trend overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="stats-panel-heading flex justify-between items-center gap-2 flex-shrink-0">
          <div className="min-w-0">
            <h2>Overall exam trend</h2>
            <div className="text-[11px] text-muted-foreground mt-px truncate">
              Average score per week · last 12 weeks
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {trendData && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-md"
                style={{
                  background: "hsl(var(--muted))",
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
              className="stats-chart-control rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Expand accuracy trend"
              title="Expand chart"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        {trendData && (
          <div className="stats-trend-summary px-[18px] pt-3 grid grid-cols-3 gap-2">
            {[
              {
                label: "Recent avg",
                value: `${trendData.recentAvg}%`,
                color:
                  trendData.recentAvg >= 70
                    ? "hsl(var(--success))"
                    : trendData.recentAvg >= 50
                      ? "hsl(var(--warning))"
                      : "hsl(var(--destructive))",
              },
              {
                label: "12-week avg",
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
              <Skeleton
                className="mx-5 h-44 w-full"
                aria-label="Loading accuracy trend"
              />
            </div>
          ) : failed ? (
            <div
              role="alert"
              className="h-[200px] flex flex-col items-center justify-center gap-3 text-sm"
            >
              <p>Accuracy trend couldn’t load.</p>
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2.5 text-primary"
                onClick={() => setRetry((v) => v + 1)}
              >
                Retry accuracy trend
              </button>
            </div>
          ) : hasData ? (
            <ChartBody data={chartData} height={125} />
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center gap-3 px-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <LineChartIcon
                  size={22}
                  className="text-muted-foreground"
                  strokeWidth={1.5}
                />
              </div>
              <div className="text-xs text-muted-foreground max-w-[220px]">
                Complete exams to see your accuracy trend
              </div>
            </div>
          )}
        </div>
        {!loading && !failed && hasData && (
          <ChartDataTable
            caption="Accuracy trend: last 12 weeks"
            rows={chartData}
            series={[{ key: "score", label: "Average score" }]}
            periodKey="week"
          />
        )}
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
