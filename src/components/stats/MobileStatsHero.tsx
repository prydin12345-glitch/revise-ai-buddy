import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subWeeks, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

interface MobileStatsHeroProps {
  avgScore: number;
}

interface SubmissionRow {
  submitted_at: string | null;
  total_score: number | null;
  total_marks: number | null;
}

/**
 * Mobile-only hero card. Big average-score number + 8-week sparkline.
 * Anchors the page and gives a clear "headline metric".
 */
export const MobileStatsHero = ({ avgScore }: MobileStatsHeroProps) => {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const since = subWeeks(new Date(), 8).toISOString();
      const { data } = await supabase
        .from("exam_submissions")
        .select("submitted_at, total_score, total_marks, status")
        .eq("student_id", user.id)
        .eq("status", "graded")
        .gte("submitted_at", since);
      setSubmissions(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const weeks = useMemo(() => {
    const out: Array<{ score: number | null }> = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const we = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const subs = submissions.filter((s) => {
        if (!s.submitted_at) return false;
        return isWithinInterval(new Date(s.submitted_at), { start: ws, end: we });
      });
      const scores = subs
        .map((s) => (s.total_score != null && s.total_marks ? (s.total_score / s.total_marks) * 100 : null))
        .filter((s): s is number => s !== null);
      out.push({ score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null });
    }
    return out;
  }, [submissions]);

  const trend = useMemo(() => {
    const real = weeks.filter((w) => w.score !== null) as Array<{ score: number }>;
    if (real.length < 2) return { dir: "neutral" as const, delta: 0 };
    const recent = real.slice(-3);
    const prior = real.slice(-6, -3);
    if (!prior.length) return { dir: "neutral" as const, delta: 0 };
    const r = recent.reduce((a, b) => a + b.score, 0) / recent.length;
    const p = prior.reduce((a, b) => a + b.score, 0) / prior.length;
    const delta = Math.round(r - p);
    return { dir: delta > 2 ? "up" : delta < -2 ? "down" : ("neutral" as const), delta };
  }, [weeks]);

  // Sparkline geometry
  const W = 120;
  const H = 44;
  const PAD = 4;
  const points = weeks.map((w) => w.score);
  const hasData = points.some((p) => p !== null);
  const minV = 0;
  const maxV = 100;
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const path = points
    .map((v, i) => {
      if (v === null) return null;
      const x = PAD + i * stepX;
      const y = H - PAD - ((v - minV) / (maxV - minV)) * (H - PAD * 2);
      return `${x},${y}`;
    })
    .filter(Boolean) as string[];

  const TrendIcon = trend.dir === "up" ? TrendingUp : trend.dir === "down" ? TrendingDown : Minus;
  const trendColor =
    trend.dir === "up"
      ? "hsl(142 71% 45%)"
      : trend.dir === "down"
      ? "hsl(0 84% 60%)"
      : "hsl(var(--muted-foreground))";

  const scoreColor =
    avgScore >= 70 ? "hsl(142 71% 45%)" : avgScore >= 50 ? "hsl(25 95% 53%)" : avgScore > 0 ? "hsl(0 84% 60%)" : "hsl(var(--muted-foreground))";

  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-4"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted) / 0.4) 100%)",
      }}
    >
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Average Score
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span
            className="font-extrabold tracking-tight"
            style={{ fontSize: 36, lineHeight: 1, color: scoreColor, letterSpacing: "-1px" }}
          >
            {avgScore > 0 ? `${avgScore}%` : "—"}
          </span>
          {trend.delta !== 0 && (
            <span
              className="flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{ background: `${trendColor}18`, color: trendColor }}
            >
              <TrendIcon size={11} strokeWidth={2.5} />
              {trend.delta > 0 ? "+" : ""}
              {trend.delta}%
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">Last 8 weeks</div>
      </div>

      <div className="shrink-0">
        {loading ? (
          <div className="w-[120px] h-[44px] rounded-md bg-muted animate-pulse" />
        ) : hasData && path.length >= 2 ? (
          <svg width={W} height={H} className="overflow-visible">
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              fill="url(#sparkFill)"
              points={`${path[0].split(",")[0]},${H - PAD} ${path.join(" ")} ${path[path.length - 1].split(",")[0]},${H - PAD}`}
            />
            <polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={path.join(" ")}
            />
            {path.length > 0 && (
              <circle
                cx={Number(path[path.length - 1].split(",")[0])}
                cy={Number(path[path.length - 1].split(",")[1])}
                r={3}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--card))"
                strokeWidth={1.5}
              />
            )}
          </svg>
        ) : (
          <div className="w-[120px] h-[44px] flex items-center justify-center text-[10px] text-muted-foreground">
            No trend yet
          </div>
        )}
      </div>
    </div>
  );
};
