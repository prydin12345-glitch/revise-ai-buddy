import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ListChecks, ChevronRight, Clock, Trophy, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ExamHistoryItem {
  id: string;
  title: string;
  type: "exam" | "quiz";
  score: number | null;
  totalMarks: number | null;
  pct: number | null;
  date: string;
  timeTaken: number | null;
}

interface ProfileExamListProps {
  profileId: string;
  subjectName: string;
}

export const ProfileExamList = ({ profileId, subjectName: _subject }: ProfileExamListProps) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ExamHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [examRes, quizRes] = await Promise.all([
          supabase
            .from("exam_submissions")
            .select("id, total_score, total_marks, submitted_at, time_taken_seconds, exams!inner(id, title, profile_id)")
            .eq("student_id", user.id)
            .eq("exams.profile_id", profileId)
            .in("status", ["graded", "submitted"])
            .not("total_score", "is", null)
            .order("submitted_at", { ascending: false }),
          supabase
            .from("practice_question_sets")
            .select("id, set_name, subtopics, created_at, profile_id")
            .eq("user_id", user.id)
            .eq("profile_id", profileId)
            .eq("status", "published")
            .order("created_at", { ascending: false }),
        ]);

        const examItems: ExamHistoryItem[] = (examRes.data ?? []).map((e: any) => {
          const totalMarks = e.total_marks ?? 0;
          const score = e.total_score ?? 0;
          return {
            id: e.id,
            title: e.exams?.title ?? "Exam",
            type: "exam",
            score,
            totalMarks,
            pct: totalMarks > 0 ? Math.round((score / totalMarks) * 100) : null,
            date: e.submitted_at,
            timeTaken: e.time_taken_seconds,
          };
        });

        const quizItems: ExamHistoryItem[] = (quizRes.data ?? []).map((q: any) => ({
          id: q.id,
          title:
            q.set_name ||
            (Array.isArray(q.subtopics) ? q.subtopics.slice(0, 2).join(", ") : "") ||
            "Practice Quiz",
          type: "quiz",
          score: null,
          totalMarks: null,
          pct: null,
          date: q.created_at,
          timeTaken: null,
        }));

        const merged = [...examItems, ...quizItems]
          .filter((x) => x.date)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (!cancelled) {
          setItems(merged);
          setLoading(false);
        }
      } catch (err) {
        console.error("ProfileExamList error:", err);
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profileId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
          <BookOpen className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="text-[13px] font-semibold text-foreground mb-1">No exams yet</div>
        <p className="text-[12px] text-muted-foreground max-w-sm mx-auto">
          Exams and quizzes created under this profile will appear here.
          Exams created before this feature launched show in the general subject history.
        </p>
      </div>
    );
  }

  const displayed = showAll ? items : items.slice(0, 6);
  const scoredPcts = items.filter((i) => i.pct !== null).map((i) => i.pct!);
  const bestPct = scoredPcts.length ? Math.max(...scoredPcts) : null;

  return (
    <div className="rounded-2xl border border-[hsl(220_6%_20%)] bg-[hsl(220_8%_13%)] overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-[hsl(220_6%_20%)]/70">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">Attempt</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 hidden sm:block w-24 text-right">Date</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 w-14 text-right">Score</span>
        <span className="w-4" aria-hidden="true" />
      </div>
      <div className="divide-y divide-[hsl(220_6%_20%)]/50">
      {displayed.map((item) => {
        const scoreColor =
          item.pct === null ? ""
          : item.pct >= 70 ? "text-green-500"
          : item.pct >= 50 ? "text-amber-500"
          : "text-red-500";
        const isBest = bestPct !== null && item.pct === bestPct;
        const minutes = item.timeTaken ? Math.floor(item.timeTaken / 60) : null;

        return (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => {
              if (item.type === "exam") navigate(`/exam/${item.id}/review`);
              else navigate(`/practice-questions/${item.id}/preview`);
            }}
            className="w-full text-left grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors duration-150 group"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {item.type === "exam" ? (
                  <FileText className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                ) : (
                  <ListChecks className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                )}
                <span className="text-[13px] font-medium text-foreground truncate">{item.title}</span>
                {isBest && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              </div>
              <div className="text-[10.5px] text-muted-foreground mt-0.5 pl-5 flex items-center gap-2">
                <span>{item.type === "exam" ? "Exam" : "Quiz"}</span>
                {minutes !== null && (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{minutes}m</span>
                )}
                <span className="sm:hidden">
                  · {new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>
            </div>
            <span className="hidden sm:block w-24 text-right text-[11.5px] text-muted-foreground tabular-nums">
              {new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="w-14 text-right">
              {item.pct !== null ? (
                <span className={`text-[13px] font-semibold tabular-nums ${scoreColor}`}>{item.pct}%</span>
              ) : (
                <span className="text-[12px] text-muted-foreground/40">—</span>
              )}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
          </button>
        );
      })}

      </div>
      {items.length > 6 && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="w-full py-2.5 text-[12.5px] text-primary font-semibold hover:text-primary/80 transition-colors text-center"
        >
          {showAll ? "Show less" : `Show all ${items.length} attempts`}
        </button>
      )}
    </div>
  );
};
