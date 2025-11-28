import { useState, useEffect } from "react";
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

  useEffect(() => {
    const fetchTutorExams = async () => {
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

          // Get group names for group assignments
          const groupNames: string[] = [];
          if (assignments) {
            for (const assignment of assignments) {
              if (assignment.assignment_type === "group" && assignment.target_id) {
                const { data: group } = await supabase
                  .from("student_groups")
                  .select("name")
                  .eq("id", assignment.target_id)
                  .single();
                if (group) groupNames.push(group.name);
              } else if (assignment.class_name) {
                groupNames.push(assignment.class_name);
              } else {
                groupNames.push("Individual");
              }
            }
          }

          const assignedGroups = groupNames;

          const totalStudents = assignments?.length || 0;
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
            assigned_groups: assignedGroups,
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
    };

    fetchTutorExams();
  }, []);

  const refetch = async () => {
    setLoading(true);
    setError(null);
    // Re-run the fetch logic
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: examsData, error: examsError } = await supabase
      .from("exams")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (examsError) {
      setError(examsError.message);
      setLoading(false);
      return;
    }

    const examsWithStats: TutorExam[] = [];
    for (const exam of examsData || []) {
      const { data: assignments } = await supabase
        .from("exam_assignments")
        .select("*")
        .eq("exam_id", exam.id)
        .eq("is_active", true);

      const { data: submissions } = await supabase
        .from("exam_submissions")
        .select("id, status")
        .eq("exam_id", exam.id);

      // Get group names for group assignments
      const groupNames: string[] = [];
      if (assignments) {
        for (const assignment of assignments) {
          if (assignment.assignment_type === "group" && assignment.target_id) {
            const { data: group } = await supabase
              .from("student_groups")
              .select("name")
              .eq("id", assignment.target_id)
              .single();
            if (group) groupNames.push(group.name);
          } else if (assignment.class_name) {
            groupNames.push(assignment.class_name);
          } else {
            groupNames.push("Individual");
          }
        }
      }

      const assignedGroups = groupNames;

      const totalStudents = assignments?.length || 0;
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
        assigned_groups: assignedGroups,
        deadline: assignments?.[0]?.deadline || null,
        completion_percentage: completionPercentage,
        total_students: totalStudents,
        completed_students: completedStudents,
        grade_released: exam.grade_released || false
      });
    }

    setExams(examsWithStats);
    setLoading(false);
  };

  return { exams, loading, error, refetch };
};
