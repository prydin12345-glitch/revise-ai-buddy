import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubjectTrend = "up" | "down" | "neutral" | null;

interface SubjectAverage {
  percentage: number | null;
  average: number | null; // alias for percentage
  questionsAttempted: number;
  trend: SubjectTrend;
  loading: boolean;
}

/**
 * Aggregated practice-question accuracy for a single subject, plus a
 * short-window trend derived from the most recent answers.
 */
export const useSubjectAverage = (subjectName: string): SubjectAverage => {
  const [state, setState] = useState<SubjectAverage>({
    percentage: null,
    average: null,
    questionsAttempted: 0,
    trend: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setState({ percentage: null, average: null, questionsAttempted: 0, trend: null, loading: false });
          return;
        }

        const { data: sets } = await supabase
          .from("practice_question_sets")
          .select("id")
          .eq("user_id", user.id)
          .eq("subject_id", subjectName);

        if (!sets || sets.length === 0) {
          if (!cancelled) setState({ percentage: null, average: null, questionsAttempted: 0, trend: null, loading: false });
          return;
        }
        const setIds = sets.map((s) => s.id);

        const { data: questions } = await supabase
          .from("practice_questions")
          .select("id, marks")
          .in("set_id", setIds);

        if (!questions || questions.length === 0) {
          if (!cancelled) setState({ percentage: null, average: null, questionsAttempted: 0, trend: null, loading: false });
          return;
        }
        const qIds = questions.map((q) => q.id);
        const qMarks = new Map(questions.map((q) => [q.id, q.marks || 0]));

        const { data: answers } = await supabase
          .from("practice_question_answers")
          .select("question_id, score, submitted_at, created_at")
          .eq("user_id", user.id)
          .in("question_id", qIds)
          .order("submitted_at", { ascending: false, nullsFirst: false });

        if (!answers || answers.length === 0) {
          if (!cancelled) setState({ percentage: null, average: null, questionsAttempted: 0, trend: null, loading: false });
          return;
        }

        let total = 0;
        let scored = 0;
        const perAnswerPct: number[] = [];
        for (const a of answers) {
          const marks = qMarks.get(a.question_id) || 0;
          const s = Number(a.score) || 0;
          total += marks;
          scored += s;
          if (marks > 0) perAnswerPct.push((s / marks) * 100);
        }

        const pct = total > 0 ? Math.round((scored / total) * 100) : null;

        // Trend: last 3 vs previous 3
        const recent = perAnswerPct.slice(0, 3);
        const previous = perAnswerPct.slice(3, 6);
        const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
        const recentAvg = avg(recent);
        const previousAvg = avg(previous);
        let trend: SubjectTrend = null;
        if (recentAvg !== null && previousAvg !== null) {
          if (recentAvg > previousAvg + 3) trend = "up";
          else if (recentAvg < previousAvg - 3) trend = "down";
          else trend = "neutral";
        }

        if (!cancelled) {
          setState({ percentage: pct, average: pct, questionsAttempted: answers.length, trend, loading: false });
        }
      } catch (err) {
        console.error("useSubjectAverage error:", err);
        if (!cancelled) setState({ percentage: null, average: null, questionsAttempted: 0, trend: null, loading: false });
      }
    };
    run();
    return () => { cancelled = true; };
  }, [subjectName]);

  return state;
};
