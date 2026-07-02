import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProfileScoreTrendProps {
  profileId: string;
}

export const ProfileScoreTrend = ({ profileId }: ProfileScoreTrendProps) => {
  const [points, setPoints] = useState<Array<{ label: string; score: number; date: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("exam_submissions")
          .select("total_score, total_marks, submitted_at, exams!inner(profile_id)")
          .eq("student_id", user.id)
          .eq("exams.profile_id", profileId)
          .in("status", ["graded", "submitted"])
          .not("total_score", "is", null)
          .gt("total_marks", 0)
          .order("submitted_at", { ascending: true });

        const mapped = (data ?? []).map((d: any) => {
          const pct = Math.round((d.total_score / d.total_marks) * 100);
          const dt = new Date(d.submitted_at);
          return {
            date: d.submitted_at,
            score: pct,
            label: dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          };
        });

        if (!cancelled) {
          setPoints(mapped);
          setLoading(false);
        }
      } catch (err) {
        console.error("ProfileScoreTrend error:", err);
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profileId]);

  if (loading) {
    return (
      <div className="h-56 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (points.length < 2) {
    return (
      <div className="h-40 rounded-xl border border-dashed border-border/60 flex items-center justify-center px-6 text-center">
        <p className="text-[13px] text-muted-foreground">
          Complete at least two exams under this profile to see your trend.
        </p>
      </div>
    );
  }

  const average = Math.round(points.reduce((s, p) => s + p.score, 0) / points.length);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => [`${v}%`, "Score"]}
          />
          <ReferenceLine y={average} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" opacity={0.5} label={{ value: `avg ${average}%`, fontSize: 10, fill: "hsl(var(--muted-foreground))", position: "insideTopRight" }} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
