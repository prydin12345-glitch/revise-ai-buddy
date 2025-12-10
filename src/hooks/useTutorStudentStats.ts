import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ExamSubmission {
  id: string;
  exam_id: string;
  submitted_at: string;
  total_score: number | null;
  total_marks: number | null;
  time_taken_seconds: number | null;
  exam_title: string;
  subject_id: string;
}

interface FeedbackThread {
  id: string;
  question_id: string;
  student_comment: string;
  tutor_response: string | null;
  status: string;
  created_at: string;
}

interface StudentStats {
  totalExams: number;
  completedExams: number;
  averageScore: number;
  completionRate: number;
  totalTimeSpent: number; // in minutes
  submissions: ExamSubmission[];
  subjectPerformance: Array<{
    name: string;
    avgScore: number;
    count: number;
    color: string;
  }>;
  examResultsOverTime: Array<{
    period: string;
    score: number;
    subject: string;
  }>;
  feedbackThreads: FeedbackThread[];
  weakestSubject: string | null;
  strongestSubject: string | null;
}

export const useTutorStudentStats = (studentId: string | null) => {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    const fetchStudentStats = async () => {
      try {
        setLoading(true);
        
        // Get the current user (tutor)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Fetch exam submissions for this student
        const { data: submissions, error: submissionsError } = await supabase
          .from("exam_submissions")
          .select(`
            id,
            exam_id,
            submitted_at,
            total_score,
            total_marks,
            time_taken_seconds,
            status
          `)
          .eq("student_id", studentId)
          .in("status", ["submitted", "graded"])
          .order("submitted_at", { ascending: false });

        if (submissionsError) throw submissionsError;

        // Get exam details for the submissions
        const examIds = [...new Set(submissions?.map(s => s.exam_id) || [])];
        const { data: exams, error: examsError } = await supabase
          .from("exams")
          .select("id, title, subject_id")
          .in("id", examIds.length > 0 ? examIds : ["00000000-0000-0000-0000-000000000000"]);

        if (examsError) throw examsError;

        // Get user subjects for colors
        const { data: userSubjects } = await supabase
          .from("user_subjects")
          .select("subject_name, subject_color")
          .eq("user_id", studentId);

        const subjectColorMap: Record<string, string> = {};
        userSubjects?.forEach(s => {
          subjectColorMap[s.subject_name] = s.subject_color;
        });

        // Fetch feedback threads for this student
        const { data: feedbackThreads, error: feedbackError } = await supabase
          .from("question_feedback_threads")
          .select("id, question_id, student_comment, tutor_response, status, created_at")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (feedbackError) throw feedbackError;

        // Get assignments for this student to calculate completion rate
        const { data: assignments, error: assignmentsError } = await supabase
          .from("exam_assignments")
          .select("id, exam_id")
          .eq("is_active", true);

        // Process the data
        const examMap = new Map(exams?.map(e => [e.id, e]) || []);
        
        const processedSubmissions: ExamSubmission[] = (submissions || []).map(s => {
          const exam = examMap.get(s.exam_id);
          return {
            id: s.id,
            exam_id: s.exam_id,
            submitted_at: s.submitted_at,
            total_score: s.total_score,
            total_marks: s.total_marks,
            time_taken_seconds: s.time_taken_seconds,
            exam_title: exam?.title || "Unknown Exam",
            subject_id: exam?.subject_id || "Unknown"
          };
        });

        // Calculate subject performance
        const subjectStats: Record<string, { total: number; count: number }> = {};
        processedSubmissions.forEach(s => {
          if (s.total_score !== null && s.total_marks && s.total_marks > 0) {
            const score = (s.total_score / s.total_marks) * 100;
            if (!subjectStats[s.subject_id]) {
              subjectStats[s.subject_id] = { total: 0, count: 0 };
            }
            subjectStats[s.subject_id].total += score;
            subjectStats[s.subject_id].count += 1;
          }
        });

        const subjectPerformance = Object.entries(subjectStats).map(([name, { total, count }]) => ({
          name,
          avgScore: total / count,
          count,
          color: subjectColorMap[name] || "#3B82F6"
        }));

        // Find weakest and strongest subjects
        let weakestSubject: string | null = null;
        let strongestSubject: string | null = null;
        let minScore = 101;
        let maxScore = -1;
        
        subjectPerformance.forEach(s => {
          if (s.avgScore < minScore) {
            minScore = s.avgScore;
            weakestSubject = s.name;
          }
          if (s.avgScore > maxScore) {
            maxScore = s.avgScore;
            strongestSubject = s.name;
          }
        });

        // Calculate exam results over time
        const examResultsOverTime = processedSubmissions
          .filter(s => s.total_score !== null && s.total_marks && s.total_marks > 0)
          .map(s => ({
            period: new Date(s.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            score: (s.total_score! / s.total_marks!) * 100,
            subject: s.subject_id
          }))
          .reverse();

        // Calculate overall stats
        const completedExams = processedSubmissions.length;
        const totalExams = assignments?.length || completedExams;
        const averageScore = subjectPerformance.length > 0
          ? subjectPerformance.reduce((sum, s) => sum + s.avgScore * s.count, 0) / 
            subjectPerformance.reduce((sum, s) => sum + s.count, 0)
          : 0;
        const completionRate = totalExams > 0 ? (completedExams / totalExams) * 100 : 0;
        const totalTimeSpent = processedSubmissions.reduce(
          (sum, s) => sum + (s.time_taken_seconds || 0), 0
        ) / 60;

        setStats({
          totalExams,
          completedExams,
          averageScore,
          completionRate,
          totalTimeSpent,
          submissions: processedSubmissions,
          subjectPerformance,
          examResultsOverTime,
          feedbackThreads: feedbackThreads || [],
          weakestSubject,
          strongestSubject
        });
      } catch (err) {
        console.error("Error fetching student stats:", err);
        setError(err instanceof Error ? err.message : "Failed to load student stats");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentStats();
  }, [studentId]);

  return { stats, loading, error };
};
