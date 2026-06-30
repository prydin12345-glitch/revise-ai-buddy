import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubjectAverage {
  percentage: number | null; // null = untested
  questionsAttempted: number;
  loading: boolean;
}

/**
 * Aggregated practice-question accuracy for a single subject.
 * Mirrors useTopicPerformance but returns one overall figure.
 */
export const useSubjectAverage = (subjectName: string): SubjectAverage => {
  const [state, setState] = useState<SubjectAverage>({
    percentage: null,
    questionsAttempted: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setState({ percentage: null, questionsAttempted: 0, loading: false });
          return;
        }

        const { data: sets } = await supabase
          .from("practice_question_sets")
          .select("id")
          .eq("user_id", user.id)
          .eq("subject_id", subjectName);

        if (!sets || sets.length === 0) {
          if (!cancelled) setState({ percentage: null, questionsAttempted: 0, loading: false });
          return;
        }
        const setIds = sets.map((s) => s.id);

        const { data: questions } = await supabase
          .from("practice_questions")
          .select("id, marks")
          .in("set_id", setIds);

        if (!questions || questions.length === 0) {
          if (!cancelled) setState({ percentage: null, questionsAttempted: 0, loading: false });
          return;
        }
        const qIds = questions.map((q) => q.id);

        const { data: answers } = await supabase
          .from("practice_question_answers")
          .select("question_id, score")
          .eq("user_id", user.id)
          .in("question_id", qIds);

        if (!answers || answers.length === 0) {
          if (!cancelled) setState({ percentage: null, questionsAttempted: 0, loading: false });
          return;
        }

        let total = 0;
        let scored = 0;
        for (const a of answers) {
          const q = questions.find((x) => x.id === a.question_id);
          if (!q) continue;
          total += q.marks || 0;
          scored += Number(a.score) || 0;
        }

        const pct = total > 0 ? Math.round((scored / total) * 100) : null;
        if (!cancelled) {
          setState({ percentage: pct, questionsAttempted: answers.length, loading: false });
        }
      } catch (err) {
        console.error("useSubjectAverage error:", err);
        if (!cancelled) setState({ percentage: null, questionsAttempted: 0, loading: false });
      }
    };
    run();
    return () => { cancelled = true; };
  }, [subjectName]);

  return state;
};
