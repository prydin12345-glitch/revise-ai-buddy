import { supabase } from "@/integrations/supabase/exam-metadata-client";
import type { WorkspaceStore } from "@/hooks/use-workspace-session";
import { LIBRARY_REVISION, sumLibraryMarks } from "./library-item-cache";
import { loadLibraryQuestionMetadata } from "./library-question-metadata";
import { workspaceUser, boundedQuery } from "./workspace-query-client";
import type { ExamProgress } from "@/pages/MyExams";

/** Read-only library preparation. Draft recovery/publication stays in the opened page. */
export const examLibraryQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["workspace-library", "exam", store.get(LIBRARY_REVISION, 0)],
  queryFn: async () => {
    const user = await workspaceUser(store);
    if (!user) throw new Error("Sign in to view your exams.");
    const [{ data: exams, error }, { data: favourites, error: favouritesError }] = await Promise.all([
      supabase.from("exams").select("*, exam_topics(topic_name)").order("created_at", { ascending: false }),
      supabase.from("favourite_exams").select("exam_id").eq("user_id", user.id),
    ]);
    if (error) throw error;
    const data = exams || [];
    const examIds = data.map(exam => exam.id);
    if (!examIds.length) return { exams: data, favouriteIds: favourites?.map(row => row.exam_id) || [], favouritesError, completedExamIds: [] as string[], statesMap: new Map<string, "not-started" | "in-progress" | "completed">(), progressMap: new Map<string, ExamProgress>() };
    const [{ data: allSubmissions, error: submissionsError }, { data: allAnswers, error: answersError }, questionsData, { data: timerData, error: timersError }] = await Promise.all([
      supabase.from("exam_submission_metadata").select("exam_id, status, time_remaining_seconds, last_accessed_at, exam_started_at").eq("student_id", user.id).in("exam_id", examIds),
      supabase.from("student_answers").select("exam_id").eq("student_id", user.id).in("exam_id", examIds),
      loadLibraryQuestionMetadata("exam", examIds),
      supabase.from("exam_timer").select("exam_id, enabled, duration_minutes").in("exam_id", examIds),
    ]);
    if (submissionsError || answersError || timersError) throw submissionsError || answersError || timersError;
    const submittedExamIds = new Set(allSubmissions?.filter(s => ["submitted", "completed", "graded"].includes(s.status || "")).map(s => s.exam_id) || []);
    const inProgressExamIds = new Set(allSubmissions?.filter(s => ["in_progress", "marking", "marking_failed"].includes(s.status || "")).map(s => s.exam_id) || []);
    const examIdsWithAnswers = new Set(allAnswers?.map(answer => answer.exam_id) || []);
    const submissionsMap = new Map(allSubmissions?.map(submission => [submission.exam_id, submission]) || []);
    const answersCountMap = new Map<string, number>();
    allAnswers?.forEach(answer => answersCountMap.set(answer.exam_id, (answersCountMap.get(answer.exam_id) || 0) + 1));
    const questionsCountMap = new Map<string, number>();
    questionsData.forEach(question => questionsCountMap.set(question.itemId, (questionsCountMap.get(question.itemId) || 0) + 1));
    const timerMap = new Map(timerData?.map(timer => [timer.exam_id, timer]) || []);
    const statesMap = new Map<string, "not-started" | "in-progress" | "completed">();
    const progressMap = new Map<string, ExamProgress>();
          data.forEach(exam => {
            let state: 'not-started' | 'in-progress' | 'completed';

            if (exam.status !== 'published') {
              state = 'not-started';
            } else if (submittedExamIds.has(exam.id)) {
              state = 'completed';
            } else if (inProgressExamIds.has(exam.id) || examIdsWithAnswers.has(exam.id)) {
              state = 'in-progress';
            } else {
              state = 'not-started';
            }

            statesMap.set(exam.id, state);

            // Calculate progress
            const totalQuestions = questionsCountMap.get(exam.id) || 0;
            const questionsCompleted = state === 'completed' ? totalQuestions : (answersCountMap.get(exam.id) || 0);
            const percentComplete = totalQuestions > 0 ? (questionsCompleted / totalQuestions) * 100 : 0;

            // Calculate time remaining
            let timeRemaining = "No timer";
            const timer = timerMap.get(exam.id);
            const submission = submissionsMap.get(exam.id);

            if (state === 'completed') {
              timeRemaining = "Completed";
            } else if (timer?.enabled) {
              if (submission?.time_remaining_seconds !== undefined && submission.time_remaining_seconds !== null) {
                const hours = Math.floor(submission.time_remaining_seconds / 3600);
                const minutes = Math.floor((submission.time_remaining_seconds % 3600) / 60);
                if (hours > 0) {
                  timeRemaining = `${hours}hr ${minutes}min`;
                } else {
                  timeRemaining = `${minutes}min`;
                }
              } else if (timer.duration_minutes) {
                const hours = Math.floor(timer.duration_minutes / 60);
                const minutes = timer.duration_minutes % 60;
                if (hours > 0) {
                  timeRemaining = `${hours}hr ${minutes}min`;
                } else {
                  timeRemaining = `${minutes}min`;
                }
              }
            }

            // Format last accessed
            let lastAccessed = "Never";
            if (submission?.last_accessed_at) {
              lastAccessed = new Date(submission.last_accessed_at).toLocaleDateString('en-GB');
            } else if (submission?.exam_started_at) {
              lastAccessed = new Date(submission.exam_started_at).toLocaleDateString('en-GB');
            }

            progressMap.set(exam.id, {
              questionsCompleted,
              totalQuestions,
              totalMarks: sumLibraryMarks((questionsData || []).filter(q => q.itemId === exam.id)),
              percentComplete,
              timeRemaining,
              lastAccessed,
              examState: state,
            });
          });

    return { exams: data, favouriteIds: favourites?.map(row => row.exam_id) || [], favouritesError, completedExamIds: Array.from(submittedExamIds), statesMap, progressMap };
  },
});

export const quizLibraryQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["workspace-library", "quiz", store.get(LIBRARY_REVISION, 0)],
  queryFn: async () => {
    const user = await workspaceUser(store);
    if (!user) throw new Error("Sign in to view your quizzes.");
    const [{ data: sets, error }, { data: progressData, error: progressError }] = await Promise.all([
      supabase.from("practice_question_sets").select("*").eq("user_id", user.id).eq("extraction_status", "completed").order("created_at", { ascending: false }),
      supabase.from("practice_set_progress").select("*").eq("user_id", user.id),
    ]);
    if (error || progressError) throw error || progressError;
    const marks = await loadLibraryQuestionMetadata("quiz", (sets || []).map(set => set.id)).then(data => ({ data, error: null })).catch((error: unknown) => ({ data: [], error }));
    const progressMap = Object.fromEntries((progressData || []).map(progress => [progress.set_id, { questions_attempted: progress.questions_attempted || 0, last_accessed_at: progress.last_accessed_at || progress.created_at, completed_at: progress.completed_at || undefined, time_spent_seconds: progress.time_spent_seconds || 0 }]));
    const totalMarks = Object.fromEntries((sets || []).map(set => [set.id, marks.error ? null : sumLibraryMarks(marks.data.filter(row => row.itemId === set.id))]));
    return { sets: sets || [], progressMap, totalMarks, marksError: marks.error };
  },
});
