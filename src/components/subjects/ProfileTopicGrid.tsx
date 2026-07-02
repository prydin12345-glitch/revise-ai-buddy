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
        <p className="text-[13px] text-muted-foreground">
          No topic data yet for this profile. Complete an exam or practice quiz to see performance by topic.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {topicScores.map(({ topic, score, attempts, source }) => {
        const unstarted = score === -1;
        const displayScore = Math.max(0, score);

        const bg = unstarted
          ? "bg-muted/30 border-border/40"
          : displayScore >= 70 ? "bg-green-500/10 border-green-500/20"
          : displayScore >= 50 ? "bg-amber-500/10 border-amber-500/20"
          : "bg-red-500/10 border-red-500/20";

        const textColor = unstarted
          ? "text-muted-foreground"
          : displayScore >= 70 ? "text-green-600"
          : displayScore >= 50 ? "text-amber-600"
          : "text-red-500";

        const sourceLabel = source === "both" ? "exam + quiz" : source;

        return (
          <button
            key={topic}
            disabled={unstarted}
            onClick={() =>
              !unstarted &&
              navigate(
                `/create-practice-questions?subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(topic)}&profileId=${profileId}`
              )
            }
            className={`group text-left rounded-xl border p-3.5 transition-all duration-150 ${bg} ${unstarted ? "cursor-default" : "hover:shadow-sm"}`}
          >
            {unstarted ? (
              <>
                <div className="text-[12px] font-medium text-foreground line-clamp-2 leading-snug">
                  {topic}
                </div>
                <div className="text-[10.5px] text-muted-foreground mt-2">Not attempted yet</div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-1.5">
                  <div className={`text-2xl font-bold tabular-nums ${textColor}`}>{displayScore}%</div>
                  <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground rounded-md px-1.5 py-0.5 bg-background/60 border border-border/50 shrink-0 mt-1">
                    {sourceLabel}
                  </span>
                </div>
                <div className="text-[12px] font-medium text-foreground mt-1 line-clamp-2 leading-snug">
                  {topic}
                </div>
                <div className="text-[10.5px] text-muted-foreground mt-1">
                  {attempts} attempt{attempts !== 1 ? "s" : ""}
                </div>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
};
