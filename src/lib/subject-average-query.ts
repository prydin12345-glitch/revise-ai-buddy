import { supabase } from "@/integrations/supabase/client";
import type { WorkspaceStore } from "@/hooks/use-workspace-session";
import { boundedQuery, workspaceUser } from "./workspace-query-client";

export type SubjectTrend = "up" | "down" | "neutral" | null;

interface SubjectAverageData {
  percentage: number | null;
  average: number | null;
  questionsAttempted: number;
  trend: SubjectTrend;
}

const emptyAverage = (): SubjectAverageData => ({ percentage: null, average: null, questionsAttempted: 0, trend: null });

/** Existing weighted practice accuracy and recent-answer trend, shared by subject cards. */
export const subjectAverageQuery = (store: WorkspaceStore, subjectName: string) => boundedQuery({
  queryKey: ["workspace-subject-average", subjectName],
  queryFn: async (): Promise<SubjectAverageData> => {
    const user = await workspaceUser(store);
    if (!user) return emptyAverage();

    const { data: sets, error: setsError } = await supabase
      .from("practice_question_sets")
      .select("id")
      .eq("user_id", user.id)
      .eq("subject_id", subjectName);
    if (setsError) throw setsError;
    if (!sets || sets.length === 0) return emptyAverage();
    const setIds = sets.map(s => s.id);

    const { data: questions, error: questionsError } = await supabase
      .from("practice_questions")
      .select("id, marks")
      .in("set_id", setIds);
    if (questionsError) throw questionsError;
    if (!questions || questions.length === 0) return emptyAverage();
    const qIds = questions.map(q => q.id);
    const qMarks = new Map(questions.map(q => [q.id, q.marks || 0]));

    const { data: answers, error: answersError } = await supabase
      .from("practice_question_answers")
      .select("question_id, score, submitted_at, created_at")
      .eq("user_id", user.id)
      .in("question_id", qIds)
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (answersError) throw answersError;
    if (!answers || answers.length === 0) return emptyAverage();

    let total = 0;
    let scored = 0;
    const perAnswerPct: number[] = [];
    for (const answer of answers) {
      const marks = qMarks.get(answer.question_id) || 0;
      const score = Number(answer.score) || 0;
      total += marks;
      scored += score;
      if (marks > 0) perAnswerPct.push((score / marks) * 100);
    }
    const pct = total > 0 ? Math.round((scored / total) * 100) : null;

    // Trend: last 3 vs previous 3, retaining the existing three-point threshold.
    const recent = perAnswerPct.slice(0, 3);
    const previous = perAnswerPct.slice(3, 6);
    const avg = (arr: number[]) => arr.length ? arr.reduce((sum, value) => sum + value, 0) / arr.length : null;
    const recentAvg = avg(recent);
    const previousAvg = avg(previous);
    let trend: SubjectTrend = null;
    if (recentAvg !== null && previousAvg !== null) {
      if (recentAvg > previousAvg + 3) trend = "up";
      else if (recentAvg < previousAvg - 3) trend = "down";
      else trend = "neutral";
    }
    return { percentage: pct, average: pct, questionsAttempted: answers.length, trend };
  },
});
