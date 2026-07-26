import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface TopicScore {
  topic: string;
  score: number; // -1 means unstarted
  attempts: number;
  source: "exam" | "practice" | "both";
}

interface ProfileTopicGridProps {
  profileId: string;
  profileTopics: string[];
  subjectName: string;
}

export const ProfileTopicGrid = ({ profileId, profileTopics, subjectName }: ProfileTopicGridProps) => {
  const navigate = useNavigate();
  const [topicScores, setTopicScores] = useState<TopicScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [examRes, practiceRes] = await Promise.all([
          supabase
            .from("student_answers")
            .select("score, is_correct, exam_questions!inner(topic_tag, marks, profile_id)")
            .eq("student_id", user.id)
            .eq("exam_questions.profile_id", profileId),
          supabase
            .from("practice_question_answers")
            .select("score, is_correct, practice_questions!inner(subtopic, marks, profile_id)")
            .eq("user_id", user.id)
            .eq("practice_questions.profile_id", profileId),
        ]);

        const topicMap: Record<string, { totalScore: number; totalMarks: number; attempts: number; sources: Set<"exam" | "practice"> }> = {};

        const add = (topic: string | null | undefined, score: number, marks: number, source: "exam" | "practice") => {
          if (!topic) return;
          if (!topicMap[topic]) {
            topicMap[topic] = { totalScore: 0, totalMarks: 0, attempts: 0, sources: new Set() };
          }
          topicMap[topic].totalScore += score ?? 0;
          topicMap[topic].totalMarks += marks || 1;
          topicMap[topic].attempts += 1;
          topicMap[topic].sources.add(source);
        };

        (examRes.data ?? []).forEach((a: any) => {
          const q = a.exam_questions;
          add(q?.topic_tag, a.score ?? 0, q?.marks ?? 1, "exam");
        });
        (practiceRes.data ?? []).forEach((a: any) => {
          const q = a.practice_questions;
          add(q?.subtopic, a.score ?? 0, q?.marks ?? 1, "practice");
        });

        const scored: TopicScore[] = Object.entries(topicMap).map(([topic, d]) => ({
          topic,
          score: d.totalMarks > 0 ? Math.round((d.totalScore / d.totalMarks) * 100) : 0,
          attempts: d.attempts,
          source: d.sources.has("exam") && d.sources.has("practice")
            ? "both"
            : d.sources.has("exam") ? "exam" : "practice",
        }));

        // Add unstarted profile topics not present in the scored set
        const seen = new Set(scored.map((s) => s.topic));
        const unstarted: TopicScore[] = profileTopics
          .filter((t) => !seen.has(t))
          .map((t) => ({ topic: t, score: -1, attempts: 0, source: "practice" as const }));

        // Sort scored ascending (weakest first), then unstarted at end
        scored.sort((a, b) => a.score - b.score);
        if (!cancelled) {
          setTopicScores([...scored, ...unstarted]);
          setLoading(false);
        }
      } catch (err) {
        console.error("ProfileTopicGrid error:", err);
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profileId, profileTopics]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (topicScores.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
        <p className="text-13 text-muted-foreground">
          No topic data yet for this profile. Complete an exam or practice quiz to see performance by topic.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
      {topicScores.map(({ topic, score, attempts, source }) => {
        const unstarted = score === -1;
        const displayScore = Math.max(0, score);

        const bg = unstarted
          ? "bg-muted/30 border-border/40"
          : displayScore >= 70 ? "bg-success/10 border-success/20"
          : displayScore >= 50 ? "bg-warning/10 border-warning/20"
          : "bg-danger/10 border-danger/20";

        const textColor = unstarted
          ? "text-muted-foreground"
          : displayScore >= 70 ? "text-success"
          : displayScore >= 50 ? "text-warning"
          : "text-danger";

        const sourceLabel = source === "both" ? "exam + quiz" : source;

        return (
          <button
            key={topic}
            disabled={unstarted}
            onClick={() =>
              !unstarted &&
              navigate(
                `/create-practice-questions?subject=${encodeURIComponent(subjectName)}&subtopic=${encodeURIComponent(topic)}&profileId=${profileId}`
              )
            }
            className={`group w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${unstarted ? "cursor-default" : "hover:bg-foreground/[0.03]"}`}
          >
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full shrink-0 ${unstarted ? "bg-border-strong" : displayScore >= 70 ? "bg-success" : displayScore >= 50 ? "bg-warning" : "bg-danger"}`}
            />
            <span className="min-w-0 flex-1 text-13 font-medium text-foreground truncate">{topic}</span>
            {!unstarted && (
              <span className={`hidden sm:inline text-xs tabular-nums font-semibold ${textColor}`}>{displayScore}%</span>
            )}
            {!unstarted && (
              <span className="hidden md:inline text-10 text-muted-foreground tabular-nums" title={sourceLabel}>{attempts}×</span>
            )}
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-10 font-medium ${
              unstarted ? "text-muted-foreground/70 border-border-strong bg-transparent"
              : displayScore >= 70 ? "text-success border-success/25 bg-success/[0.07]"
              : displayScore >= 50 ? "text-warning border-warning/25 bg-warning/[0.07]"
              : "text-danger border-danger/25 bg-danger/[0.07]"
            }`}>
              {unstarted ? "Not started" : displayScore >= 70 ? "Mastered" : displayScore >= 50 ? "Improving" : "Review needed"}
            </span>
          </button>
        );
      })}
    </div>
  );
};
