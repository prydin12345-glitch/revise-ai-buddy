import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, FileText, ListChecks, Plus, Target,
  TrendingUp, TrendingDown, Minus, Clock, Award, BarChart3, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProfileScoreTrend } from "@/components/subjects/ProfileScoreTrend";
import { ProfileTopicGrid } from "@/components/subjects/ProfileTopicGrid";
import { ProfileExamList } from "@/components/subjects/ProfileExamList";
import { getBoardDisplayName } from "@/lib/board-scrubber";

interface Profile {
  id: string;
  profile_name: string;
  topics: string[];
  question_count: number;
  educational_tier: string | null;
  exam_board: string | null;
  time_limit_minutes: number | null;
  subject_id?: string;
}

interface ProfileStats {
  totalExams: number;
  totalQuizzes: number;
  averageScore: number | null;
  bestScore: number | null;
  trend: "up" | "down" | "neutral" | null;
  lastAttempt: string | null;
}

export default function ProfileDetail() {
  const { subjectName, profileId } = useParams<{ subjectName: string; profileId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  const decodedSubject = subjectName ? decodeURIComponent(subjectName) : "";

  const loadProfile = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("subject_exam_profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (!profileData) {
        navigate(`/my-subjects/${subjectName}`);
        return;
      }
      setProfile(profileData as any);

      const [examsRes, quizzesRes] = await Promise.all([
        supabase
          .from("exam_submissions")
          .select("id, total_score, total_marks, submitted_at, exams!inner(id, title, profile_id)")
          .eq("student_id", user.id)
          .eq("exams.profile_id", profileId)
          .in("status", ["graded", "submitted"])
          .not("total_score", "is", null)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("practice_question_sets")
          .select("id, profile_id")
          .eq("user_id", user.id)
          .eq("profile_id", profileId)
          .eq("status", "published"),
      ]);

      const examScores = (examsRes.data ?? [])
        .filter((e: any) => e.total_marks > 0)
        .map((e: any) => ({
          pct: Math.round((e.total_score / e.total_marks) * 100),
          date: e.submitted_at as string,
        }));

      const average = examScores.length
        ? Math.round(examScores.reduce((s, e) => s + e.pct, 0) / examScores.length)
        : null;
      const best = examScores.length ? Math.max(...examScores.map((e) => e.pct)) : null;

      const recent = examScores.slice(0, 3);
      const previous = examScores.slice(3, 6);
      const avg = (arr: typeof examScores) =>
        arr.length ? arr.reduce((s, e) => s + e.pct, 0) / arr.length : null;
      const recentAvg = avg(recent);
      const previousAvg = avg(previous);
      const trend: ProfileStats["trend"] =
        recentAvg === null || previousAvg === null ? null
        : recentAvg > previousAvg + 3 ? "up"
        : recentAvg < previousAvg - 3 ? "down"
        : "neutral";

      setStats({
        totalExams: (examsRes.data ?? []).length,
        totalQuizzes: (quizzesRes.data ?? []).length,
        averageScore: average,
        bestScore: best,
        trend,
        lastAttempt: examScores[0]?.date ?? null,
      });
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }, [profileId, subjectName, navigate]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) return null;

  const scoreColor =
    stats?.averageScore == null ? "text-muted-foreground"
    : stats.averageScore >= 70 ? "text-green-500"
    : stats.averageScore >= 50 ? "text-amber-500"
    : "text-red-500";

  const bestColor =
    stats?.bestScore == null ? "text-muted-foreground"
    : stats.bestScore >= 70 ? "text-green-500"
    : stats.bestScore >= 50 ? "text-amber-500"
    : "text-red-500";

  const TrendIcon =
    stats?.trend === "up" ? TrendingUp
    : stats?.trend === "down" ? TrendingDown
    : Minus;

  const trendColor =
    stats?.trend === "up" ? "text-green-500"
    : stats?.trend === "down" ? "text-red-500"
    : "text-muted-foreground";

  const trendLabel =
    stats?.trend === "up" ? "Improving"
    : stats?.trend === "down" ? "Needs work"
    : "Steady";

  const totalAttempts = (stats?.totalExams ?? 0) + (stats?.totalQuizzes ?? 0);

  return (
    <DashboardLayout>
      <div className="py-6 px-6 md:px-12 lg:px-16 space-y-8 w-full max-w-[1300px] mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[12.5px] text-muted-foreground flex-wrap">
          <button onClick={() => navigate("/my-subjects")} className="hover:text-foreground transition-colors">
            Subjects
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <button onClick={() => navigate(`/my-subjects/${subjectName}`)} className="hover:text-foreground transition-colors">
            {decodedSubject}
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate">{profile.profile_name}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={() => navigate(`/my-subjects/${subjectName}`)}
              className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors shrink-0"
              aria-label="Back to subject"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {profile.profile_name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {profile.exam_board && (
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {getBoardDisplayName(profile.exam_board)}
                  </span>
                )}
                {profile.educational_tier && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {profile.educational_tier}
                    </span>
                  </>
                )}
                {profile.time_limit_minutes && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {profile.time_limit_minutes} min
                    </span>
                  </>
                )}
                <span className="text-muted-foreground/50">·</span>
                <span className="text-[11px] text-muted-foreground">
                  {profile.question_count} questions
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() =>
                navigate(`/create-practice-questions?profileId=${profileId}&subject=${encodeURIComponent(decodedSubject)}`)
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-[12.5px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
            >
              <ListChecks className="w-3.5 h-3.5" />
              Practice quiz
            </button>
            <button
              onClick={() =>
                navigate(`/upload?profileId=${profileId}&subject=${encodeURIComponent(decodedSubject)}`)
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New exam
            </button>
          </div>
        </div>

        {/* SECTION 1 — Stats overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-[hsl(220_6%_20%)]/70 divide-x divide-[hsl(220_6%_20%)]/50">
          {[
            {
              label: "Average",
              value: stats?.averageScore !== null && stats?.averageScore !== undefined ? `${stats.averageScore}%` : "—",
              cls: stats?.averageScore !== null && stats?.averageScore !== undefined ? scoreColor : "text-muted-foreground/40",
              sub: null as string | null,
            },
            {
              label: "Best",
              value: stats?.bestScore !== null && stats?.bestScore !== undefined ? `${stats.bestScore}%` : "—",
              cls: stats?.bestScore !== null && stats?.bestScore !== undefined ? bestColor : "text-muted-foreground/40",
              sub: null as string | null,
            },
            {
              label: "Trend",
              value: stats?.trend ? trendLabel : "—",
              cls: stats?.trend ? `${trendColor} text-[17px]` : "text-muted-foreground/40",
              sub: null as string | null,
            },
            {
              label: "Attempts",
              value: String(totalAttempts),
              cls: "text-foreground",
              sub: `${stats?.totalExams ?? 0} exam${(stats?.totalExams ?? 0) !== 1 ? "s" : ""} · ${stats?.totalQuizzes ?? 0} quiz${(stats?.totalQuizzes ?? 0) !== 1 ? "zes" : ""}`,
            },
          ].map((mtr) => (
            <div key={mtr.label} className="px-4 py-4 flex flex-col justify-center min-h-[76px]">
              <div className="flex items-baseline gap-2">
                <span className={`text-[22px] font-bold tabular-nums leading-none ${mtr.cls}`}>{mtr.value}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">{mtr.label}</span>
              </div>
              {mtr.sub && <div className="text-[10.5px] text-muted-foreground mt-1.5 tabular-nums">{mtr.sub}</div>}
            </div>
          ))}
        </div>

        {/* SECTION 2 — Score trend */}
        {(stats?.totalExams ?? 0) > 1 && (
          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold text-foreground">Score Trend</h2>
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <ProfileScoreTrend profileId={profileId!} />
            </div>
          </section>
        )}

        {/* SECTION 3 — Topic mastery */}
        <section className="space-y-3">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Topic Performance</h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              Based on questions from this profile only
            </p>
          </div>
          <ProfileTopicGrid
            profileId={profileId!}
            profileTopics={profile.topics || []}
            subjectName={decodedSubject}
          />
        </section>

        {/* SECTION 4 — Exam history */}
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold text-foreground">Exam History</h2>
          <ProfileExamList profileId={profileId!} subjectName={decodedSubject} />
        </section>
      </div>
    </DashboardLayout>
  );
}
