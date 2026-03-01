import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TopicMastery = "untested" | "weak" | "developing" | "strong";

interface TopicPerformance {
  topic: string;
  mastery: TopicMastery;
  percentage: number; // 0-100
  questionsAttempted: number;
}

/**
 * Returns mastery level based on success rate
 */
const getMastery = (percentage: number, attempted: number): TopicMastery => {
  if (attempted === 0) return "untested";
  if (percentage < 40) return "weak";
  if (percentage < 70) return "developing";
  return "strong";
};

/**
 * Color mapping for mastery levels
 */
export const MASTERY_COLORS: Record<TopicMastery, { bg: string; text: string; border: string }> = {
  untested: {
    bg: "hsl(var(--muted))",
    text: "hsl(var(--muted-foreground))",
    border: "hsl(var(--border))",
  },
  weak: {
    bg: "hsl(0 84% 60% / 0.12)",
    text: "hsl(0 84% 45%)",
    border: "hsl(0 84% 60% / 0.3)",
  },
  developing: {
    bg: "hsl(38 92% 50% / 0.12)",
    text: "hsl(38 92% 40%)",
    border: "hsl(38 92% 50% / 0.3)",
  },
  strong: {
    bg: "hsl(142 76% 36% / 0.12)",
    text: "hsl(142 76% 30%)",
    border: "hsl(142 76% 36% / 0.3)",
  },
};

/**
 * Hook to fetch topic-level performance data from practice question answers
 */
export const useTopicPerformance = (subjectName: string) => {
  const [performances, setPerformances] = useState<Map<string, TopicPerformance>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchPerformance = useCallback(async () => {
    if (!subjectName) {
      setPerformances(new Map());
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get practice sets for this subject
      const { data: sets } = await supabase
        .from("practice_question_sets")
        .select("id")
        .eq("user_id", user.id)
        .eq("subject_id", subjectName);

      if (!sets || sets.length === 0) {
        setPerformances(new Map());
        setLoading(false);
        return;
      }

      const setIds = sets.map((s) => s.id);

      // Get questions with subtopics from these sets
      const { data: questions } = await supabase
        .from("practice_questions")
        .select("id, subtopic, marks")
        .in("set_id", setIds);

      if (!questions || questions.length === 0) {
        setPerformances(new Map());
        setLoading(false);
        return;
      }

      // Get answers for these questions
      const questionIds = questions.map((q) => q.id);
      const { data: answers } = await supabase
        .from("practice_question_answers")
        .select("question_id, score, is_correct")
        .eq("user_id", user.id)
        .in("question_id", questionIds);

      // Build per-topic stats
      const topicStats = new Map<string, { totalMarks: number; scoredMarks: number; attempted: number }>();

      for (const q of questions) {
        const topic = q.subtopic.toLowerCase();
        if (!topicStats.has(topic)) {
          topicStats.set(topic, { totalMarks: 0, scoredMarks: 0, attempted: 0 });
        }
      }

      if (answers) {
        for (const a of answers) {
          const question = questions.find((q) => q.id === a.question_id);
          if (!question) continue;
          const topic = question.subtopic.toLowerCase();
          const stat = topicStats.get(topic);
          if (stat) {
            stat.attempted++;
            stat.totalMarks += question.marks;
            stat.scoredMarks += Number(a.score) || 0;
          }
        }
      }

      const result = new Map<string, TopicPerformance>();
      for (const [topic, stat] of topicStats) {
        const percentage = stat.totalMarks > 0 ? (stat.scoredMarks / stat.totalMarks) * 100 : 0;
        result.set(topic, {
          topic,
          mastery: getMastery(percentage, stat.attempted),
          percentage: Math.round(percentage),
          questionsAttempted: stat.attempted,
        });
      }

      setPerformances(result);
    } catch (err) {
      console.error("Error fetching topic performance:", err);
    } finally {
      setLoading(false);
    }
  }, [subjectName]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const getPerformance = useCallback(
    (topicName: string): TopicPerformance => {
      const key = topicName.toLowerCase();
      return performances.get(key) || {
        topic: topicName,
        mastery: "untested",
        percentage: 0,
        questionsAttempted: 0,
      };
    },
    [performances]
  );

  return { getPerformance, loading };
};
