import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";
import type { WorkspaceStore } from "@/hooks/use-workspace-session";
import { workspaceUser, boundedQuery } from "./workspace-query-client";

interface StudyActivityData { day: string; [key: string]: number | string; }

export const accuracyTrendQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["workspace-accuracy-trend"],
  queryFn: async () => {
    const user = await workspaceUser(store);
    if (!user) throw new Error("Sign in to view your accuracy trend.");
    const { data, error } = await supabase.from("exam_submissions")
      .select("submitted_at, total_score, total_marks, status")
      .eq("student_id", user.id).eq("status", "graded")
      .gte("submitted_at", subWeeks(new Date(), 12).toISOString());
    if (error) throw error;
    return data || [];
  },
});

/** Same input rows and calculations, with independent reads issued together. */
export const examStatsQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["workspace-exam-stats"],
  queryFn: async () => {
    const user = await workspaceUser(store);
    if (!user) throw new Error("Sign in to view your progress.");
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const [{ data: exams }, { data: subs }, { data: userSubjects }, { data: tasks }, { data: weekSubmissions }, { data: practiceProgress }, { data: goals }, { data: streakData }] = await Promise.all([
      supabase.from("exams").select("id, subject_id, title, created_at, status").eq("user_id", user.id).throwOnError(),
      supabase.from("exam_submissions").select("*, exams!inner(subject_id, title)").eq("student_id", user.id).eq("status", "graded").order("submitted_at", { ascending: false }).throwOnError(),
      supabase.from("user_subjects").select("subject_name, subject_color").eq("user_id", user.id).throwOnError(),
      supabase.from("revision_tasks").select("subject, duration, date").eq("user_id", user.id).gte("date", weekStart.toISOString()).lte("date", weekEnd.toISOString()).throwOnError(),
      supabase.from("exam_submissions").select("time_taken_seconds, submitted_at, exams!inner(subject_id)").eq("student_id", user.id).eq("status", "graded").gte("submitted_at", weekStart.toISOString()).lte("submitted_at", weekEnd.toISOString()).throwOnError(),
      supabase.from("practice_set_progress").select("time_spent_seconds, completed_at, practice_question_sets!inner(subject_id)").eq("user_id", user.id).not("completed_at", "is", null).gte("completed_at", weekStart.toISOString()).lte("completed_at", weekEnd.toISOString()).throwOnError(),
      supabase.from("revision_goals").select("subject, target_percentage, deadline, subject_color").eq("user_id", user.id).throwOnError(),
      supabase.from("user_streaks").select("current_streak, longest_streak, last_exam_submitted_at").eq("user_id", user.id).maybeSingle().throwOnError(),
    ]);
    const totalExams = (exams || []).filter(exam => exam.status === "published").length;
    const submissions = subs || [];
    const subjectColors: Record<string, string> = {};
    (userSubjects || []).forEach(subject => { subjectColors[subject.subject_name.toLowerCase()] = subject.subject_color; });
      const studyMap = new Map<string, Map<string, number>>();
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      days.forEach(day => studyMap.set(day, new Map()));

      const addStudy = (dayName: string, subject: string, hours: number) => {
        const bucket = studyMap.get(dayName);
        if (!bucket || !subject || !Number.isFinite(hours)) return;
        bucket.set(subject, (bucket.get(subject) || 0) + hours);
      };

      (tasks || []).forEach(task => {
        addStudy(format(new Date(task.date), 'EEEE'), task.subject, (task.duration || 0) / 60);
      });
      (weekSubmissions || []).forEach(sub => {
        addStudy(
          format(new Date(sub.submitted_at), 'EEEE'),
          (sub.exams as any).subject_id,
          (sub.time_taken_seconds || 0) / 3600
        );
      });
      (practiceProgress || []).forEach(p => {
        addStudy(
          format(new Date(p.completed_at!), 'EEEE'),
          (p.practice_question_sets as any).subject_id,
          (p.time_spent_seconds || 0) / 3600
        );
      });

      const studyActivityData = days.map(day => {
        const data: StudyActivityData = { day };
        studyMap.get(day)!.forEach((hours, subject) => {
          data[subject] = Math.round(hours * 10) / 10;
        });
        return data;
      });


    const currentStreak = streakData?.last_exam_submitted_at && (Date.now() - new Date(streakData.last_exam_submitted_at).getTime()) / 3600000 <= 24 ? streakData.current_streak : 0;
    const longestStreak = streakData?.last_exam_submitted_at ? streakData.longest_streak : 0;
    return { totalExams, completedExams: submissions.length, inProgressExams: Math.max(0, totalExams - submissions.length), submissions, subjectColors, studyActivityData, revisionGoalRows: goals || [], currentStreak, longestStreak };
  },
});
