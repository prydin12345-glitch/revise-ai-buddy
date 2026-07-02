import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ListChecks, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ActivityItem {
  id: string;
  title: string;
  type: "exam" | "quiz";
  score: number | null;
  totalMarks: number | null;
  date: string;
}

interface RecentActivityListProps {
  subjectName: string;
}

export const RecentActivityList = ({ subjectName }: RecentActivityListProps) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [examsRes, quizzesRes] = await Promise.all([
          supabase
            .from("exam_submissions")
            .select(`id, total_score, total_marks, submitted_at, exams!inner(title, subject_id)`)
            .eq("student_id", user.id)
            .eq("exams.subject_id", subjectName)
            .in("status", ["graded", "submitted"])
            .not("total_score", "is", null)
            .order("submitted_at", { ascending: false })
            .limit(5),
          supabase
            .from("practice_question_sets")
            .select("id, set_name, subtopics, created_at")
            .eq("user_id", user.id)
            .eq("subject_id", subjectName)
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        const examItems: ActivityItem[] = (examsRes.data ?? []).map((e: any) => ({
          id: e.id,
          title: e.exams?.title ?? "Exam",
          type: "exam",
          score: e.total_score,
          totalMarks: e.total_marks,
          date: e.submitted_at,
        }));

        const quizItems: ActivityItem[] = (quizzesRes.data ?? []).map((q: any) => ({
          id: q.id,
          title:
            q.set_name ||
            (Array.isArray(q.subtopics) ? q.subtopics.slice(0, 2).join(", ") : "") ||
            "Practice Quiz",
          type: "quiz",
          score: null,
          totalMarks: null,
          date: q.created_at,
        }));

        const merged = [...examItems, ...quizItems]
          .filter((x) => x.date)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 8);

        if (!cancelled) {
          setItems(merged);
          setLoading(false);
        }
      } catch (err) {
        console.error("RecentActivityList error:", err);
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [subjectName]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
        <p className="text-[13px] text-muted-foreground">
          No activity yet for this subject. Create an exam or practice quiz to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct =
          item.score !== null && item.totalMarks
            ? Math.round((item.score / item.totalMarks) * 100)
            : null;

        const scoreColor =
          pct === null ? "" : pct >= 70 ? "text-green-500" : pct >= 50 ? "text-amber-500" : "text-red-500";

        return (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => {
              if (item.type === "exam") navigate(`/exam/${item.id}/review`);
              else navigate(`/practice-questions/${item.id}/preview`);
            }}
            className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-150 group"
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {item.type === "exam" ? (
                <FileText className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ListChecks className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-foreground truncate">{item.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(item.date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {" · "}
                {item.type === "exam" ? "Exam" : "Practice quiz"}
              </div>
            </div>

            {pct !== null && (
              <div className={`text-[13px] font-semibold tabular-nums ${scoreColor}`}>{pct}%</div>
            )}

            <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        );
      })}
    </div>
  );
};
