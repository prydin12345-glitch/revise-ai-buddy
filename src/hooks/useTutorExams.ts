import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TutorExam {
  id: string;
  title: string;
  subject_id: string;
  status: string;
  created_at: string;
  assigned_groups: string[];
  deadline: string | null;
  completion_percentage: number;
  total_students: number;
  completed_students: number;
  grade_released: boolean;
}

export const useTutorExams = () => {
  const [exams, setExams] = useState<TutorExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTutorExams = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get all exams created by this tutor
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (examsError) throw examsError;

      // Get assignment data for each exam
      const examsWithStats: TutorExam[] = [];

      for (const exam of examsData || []) {
        // Get assignments
        const { data: assignments } = await supabase
          .from("exam_assignments")
          .select("*")
          .eq("exam_id", exam.id)
          .eq("is_active", true);

        // Get submissions
        const { data: submissions } = await supabase
          .from("exam_submissions")
          .select("id, status")
          .eq("exam_id", exam.id);

        // Get group names and count actual students
        const groupNames: string[] = [];
        let totalStudents = 0;

        if (assignments) {
          for (const assignment of assignments) {
            if (assignment.assignment_type === "group" && assignment.target_id) {
              // Get group name
              const { data: group } = await supabase
                .from("student_groups")
                .select("name")
                .eq("id", assignment.target_id)
                .single();
              if (group) groupNames.push(group.name);

              // Count actual students in this group
              const { count } = await supabase
                .from("group_members")
                .select("*", { count: "exact", head: true })
                .eq("group_id", assignment.target_id)
                .eq("is_active", true);
              
              totalStudents += count || 0;
            } else if (assignment.class_name) {
              groupNames.push(assignment.class_name);
              // For class assignments, count students in that class
              const { count } = await supabase
                .from("class_assignments")
                .select("*", { count: "exact", head: true })
                .eq("teacher_id", user.id)
                .eq("class_name", assignment.class_name)
                .eq("is_active", true);
              
              totalStudents += count || 0;
            } else if (assignment.assignment_type === "individual" && assignment.target_id) {
              groupNames.push("Individual");
              totalStudents += 1;
            }
          }
        }

        const completedStudents = submissions?.filter(s => 
          s.status === "submitted" || s.status === "graded"
        ).length || 0;

        const completionPercentage = totalStudents > 0 
          ? Math.round((completedStudents / totalStudents) * 100)
          : 0;

        examsWithStats.push({
          id: exam.id,
          title: exam.title,
          subject_id: exam.subject_id,
          status: exam.status,
          created_at: exam.created_at,
          assigned_groups: groupNames,
          deadline: assignments?.[0]?.deadline || null,
          completion_percentage: completionPercentage,
          total_students: totalStudents,
          completed_students: completedStudents,
          grade_released: exam.grade_released || false
        });
      }

      setExams(examsWithStats);
    } catch (err) {
      console.error("Error fetching tutor exams:", err);
      setError(err instanceof Error ? err.message : "Failed to load exams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTutorExams();
  }, [fetchTutorExams]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchTutorExams();
  }, [fetchTutorExams]);

  return { exams, loading, error, refetch };
};