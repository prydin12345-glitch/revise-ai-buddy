import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TutorStudent {
  id: string;
  display_name: string | null;
  student_code: string | null;
  email: string;
  group_name: string;
  group_id: string;
  first_name?: string | null;
  completion_rate?: number;
  average_score?: number;
  weakest_subject?: string | null;
  exams_completed?: number;
  exams_assigned?: number;
}

interface AggregateStats {
  averageScore: number;
  completionRate: number;
  weakestTopics: string[];
}

export const useTutorStudents = () => {
  const [students, setStudents] = useState<TutorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aggregateStats, setAggregateStats] = useState<AggregateStats>({
    averageScore: 0,
    completionRate: 0,
    weakestTopics: []
  });

  useEffect(() => {
    const fetchTutorStudents = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Get all groups managed by this tutor
        const { data: groups, error: groupsError } = await supabase
          .from("student_groups")
          .select("id, name")
          .eq("tutor_id", user.id)
          .eq("is_active", true);

        if (groupsError) throw groupsError;

        if (!groups || groups.length === 0) {
          setStudents([]);
          setLoading(false);
          return;
        }

        const groupIds = groups.map(g => g.id);

        // Get all students in these groups with their profiles
        const { data: members, error: membersError } = await supabase
          .from("group_members")
          .select(`
            student_id,
            group_id,
            user_profiles!group_members_student_id_fkey(id, display_name, student_code, first_name)
          `)
          .in("group_id", groupIds)
          .eq("is_active", true);

        if (membersError) throw membersError;

        // Get exam submissions for all students
        const studentIds = [...new Set(members?.map(m => m.student_id) || [])];
        
        let submissions: any[] = [];
        if (studentIds.length > 0) {
          const { data: submissionsData, error: submissionsError } = await supabase
            .from("exam_submissions")
            .select("student_id, total_score, total_marks, exam_id")
            .in("student_id", studentIds)
            .in("status", ["submitted", "graded"]);
          
          if (!submissionsError) {
            submissions = submissionsData || [];
          }
        }

        // Get exams to map subject
        const examIds = [...new Set(submissions.map(s => s.exam_id))];
        let examsMap: Record<string, string> = {};
        if (examIds.length > 0) {
          const { data: exams } = await supabase
            .from("exams")
            .select("id, subject_id")
            .in("id", examIds);
          
          exams?.forEach(e => {
            examsMap[e.id] = e.subject_id;
          });
        }

        // Get assignments for completion rate calculation
        const { data: assignments } = await supabase
          .from("exam_assignments")
          .select("id, exam_id, target_id, assignment_type")
          .eq("is_active", true)
          .eq("assigned_by", user.id);

        // Calculate per-student stats
        const studentSubmissionMap: Record<string, any[]> = {};
        submissions.forEach(s => {
          if (!studentSubmissionMap[s.student_id]) {
            studentSubmissionMap[s.student_id] = [];
          }
          studentSubmissionMap[s.student_id].push(s);
        });

        // Build students data with stats
        const studentsData: TutorStudent[] = [];
        const allSubjectScores: Record<string, { total: number; count: number }> = {};
        let totalScoreSum = 0;
        let totalScoreCount = 0;
        let totalAssigned = 0;
        let totalCompleted = 0;
        
        for (const member of members || []) {
          const profile = member.user_profiles as any;
          const group = groups.find(g => g.id === member.group_id);
          const studentSubs = studentSubmissionMap[member.student_id] || [];
          
          // Calculate average score for this student
          let avgScore = 0;
          let scoreCount = 0;
          const subjectScores: Record<string, { total: number; count: number }> = {};
          
          studentSubs.forEach(s => {
            if (s.total_score !== null && s.total_marks && s.total_marks > 0) {
              const score = (s.total_score / s.total_marks) * 100;
              avgScore += score;
              scoreCount++;
              totalScoreSum += score;
              totalScoreCount++;
              
              const subject = examsMap[s.exam_id] || "Unknown";
              if (!subjectScores[subject]) {
                subjectScores[subject] = { total: 0, count: 0 };
              }
              subjectScores[subject].total += score;
              subjectScores[subject].count++;
              
              if (!allSubjectScores[subject]) {
                allSubjectScores[subject] = { total: 0, count: 0 };
              }
              allSubjectScores[subject].total += score;
              allSubjectScores[subject].count++;
            }
          });

          // Find weakest subject for this student
          let weakestSubject: string | null = null;
          let minScore = 101;
          Object.entries(subjectScores).forEach(([subject, { total, count }]) => {
            const avg = total / count;
            if (avg < minScore) {
              minScore = avg;
              weakestSubject = subject;
            }
          });

          // Count assignments for this student
          const assignedToStudent = assignments?.filter(a => 
            (a.assignment_type === "individual" && a.target_id === member.student_id) ||
            (a.assignment_type === "group" && a.target_id === member.group_id)
          ).length || 0;

          totalAssigned += assignedToStudent;
          totalCompleted += studentSubs.length;

          studentsData.push({
            id: member.student_id,
            display_name: profile?.display_name || "Unknown",
            student_code: profile?.student_code || null,
            first_name: profile?.first_name || null,
            email: "",
            group_name: group?.name || "Unknown Group",
            group_id: member.group_id,
            completion_rate: assignedToStudent > 0 ? (studentSubs.length / assignedToStudent) * 100 : 0,
            average_score: scoreCount > 0 ? avgScore / scoreCount : 0,
            weakest_subject: weakestSubject,
            exams_completed: studentSubs.length,
            exams_assigned: assignedToStudent
          });
        }

        // Calculate aggregate stats
        const weakestTopics = Object.entries(allSubjectScores)
          .map(([subject, { total, count }]) => ({ subject, avg: total / count }))
          .sort((a, b) => a.avg - b.avg)
          .slice(0, 3)
          .map(s => s.subject);

        setAggregateStats({
          averageScore: totalScoreCount > 0 ? totalScoreSum / totalScoreCount : 0,
          completionRate: totalAssigned > 0 ? (totalCompleted / totalAssigned) * 100 : 0,
          weakestTopics
        });

        setStudents(studentsData);
      } catch (err) {
        console.error("Error fetching tutor students:", err);
        setError(err instanceof Error ? err.message : "Failed to load students");
      } finally {
        setLoading(false);
      }
    };

    fetchTutorStudents();
  }, []);

  return { students, loading, error, aggregateStats };
};
