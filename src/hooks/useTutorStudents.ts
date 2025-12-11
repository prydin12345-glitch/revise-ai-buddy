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

interface ExamSubmissionDetail {
  student_id: string;
  student_name: string;
  exam_id: string;
  exam_title: string;
  total_score: number | null;
  total_marks: number | null;
  submitted_at: string | null;
}

interface CompletionBreakdown {
  examId: string;
  examTitle: string;
  deadline: string | null;
  completedStudents: { id: string; name: string; studentCode: string | null; submittedAt: string | null }[];
  pendingStudents: { id: string; name: string; studentCode: string | null }[];
}

interface TopicAnalysis {
  topic: string;
  avgScore: number;
  incorrectCount: number;
  totalAttempts: number;
  questionNumbers: string[];
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
  const [allSubmissions, setAllSubmissions] = useState<ExamSubmissionDetail[]>([]);
  const [completionBreakdown, setCompletionBreakdown] = useState<CompletionBreakdown[]>([]);
  const [topicAnalysis, setTopicAnalysis] = useState<TopicAnalysis[]>([]);

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

        // Get exam submissions for all students with submitted_at
        const studentIds = [...new Set(members?.map(m => m.student_id) || [])];
        
        let submissions: any[] = [];
        if (studentIds.length > 0) {
          const { data: submissionsData, error: submissionsError } = await supabase
            .from("exam_submissions")
            .select("student_id, total_score, total_marks, exam_id, submitted_at")
            .in("student_id", studentIds)
            .in("status", ["submitted", "graded"]);
          
          if (!submissionsError) {
            submissions = submissionsData || [];
          }
        }

        // Get exams with titles to map subject and title
        const examIds = [...new Set(submissions.map(s => s.exam_id))];
        let examsMap: Record<string, { subject_id: string; title: string }> = {};
        if (examIds.length > 0) {
          const { data: exams } = await supabase
            .from("exams")
            .select("id, subject_id, title")
            .in("id", examIds);
          
          exams?.forEach(e => {
            examsMap[e.id] = { subject_id: e.subject_id, title: e.title };
          });
        }

        // Get assignments for completion rate calculation with deadline
        const { data: assignments } = await supabase
          .from("exam_assignments")
          .select("id, exam_id, target_id, assignment_type, deadline")
          .eq("is_active", true)
          .eq("assigned_by", user.id);

        // Get exam titles for assignments
        const assignmentExamIds = [...new Set(assignments?.map(a => a.exam_id) || [])];
        if (assignmentExamIds.length > 0) {
          const { data: assignmentExams } = await supabase
            .from("exams")
            .select("id, title")
            .in("id", assignmentExamIds);
          
          assignmentExams?.forEach(e => {
            if (!examsMap[e.id]) {
              examsMap[e.id] = { subject_id: "", title: e.title };
            }
          });
        }

        // Build student name map
        const studentNameMap: Record<string, { name: string; code: string | null }> = {};
        members?.forEach(m => {
          const profile = m.user_profiles as any;
          studentNameMap[m.student_id] = {
            name: profile?.first_name || profile?.display_name || "Unknown",
            code: profile?.student_code || null
          };
        });

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
              
              const subject = examsMap[s.exam_id]?.subject_id || "Unknown";
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

        // Build all submissions for histogram
        const submissionDetails: ExamSubmissionDetail[] = submissions.map(s => ({
          student_id: s.student_id,
          student_name: studentNameMap[s.student_id]?.name || "Unknown",
          exam_id: s.exam_id,
          exam_title: examsMap[s.exam_id]?.title || "Unknown Exam",
          total_score: s.total_score,
          total_marks: s.total_marks,
          submitted_at: s.submitted_at
        }));
        setAllSubmissions(submissionDetails);

        // Build completion breakdown per exam
        const completionMap: Record<string, CompletionBreakdown> = {};
        assignments?.forEach(a => {
          if (!completionMap[a.exam_id]) {
            completionMap[a.exam_id] = {
              examId: a.exam_id,
              examTitle: examsMap[a.exam_id]?.title || "Unknown Exam",
              deadline: a.deadline,
              completedStudents: [],
              pendingStudents: []
            };
          }

          // Find students assigned to this exam
          let assignedStudentIds: string[] = [];
          if (a.assignment_type === "individual" && a.target_id) {
            assignedStudentIds = [a.target_id];
          } else if (a.assignment_type === "group" && a.target_id) {
            assignedStudentIds = members
              ?.filter(m => m.group_id === a.target_id)
              .map(m => m.student_id) || [];
          }

          assignedStudentIds.forEach(sid => {
            const submission = submissions.find(s => s.exam_id === a.exam_id && s.student_id === sid);
            const studentInfo = studentNameMap[sid];
            if (submission) {
              completionMap[a.exam_id].completedStudents.push({
                id: sid,
                name: studentInfo?.name || "Unknown",
                studentCode: studentInfo?.code || null,
                submittedAt: submission.submitted_at
              });
            } else if (studentInfo) {
              completionMap[a.exam_id].pendingStudents.push({
                id: sid,
                name: studentInfo?.name || "Unknown",
                studentCode: studentInfo?.code || null
              });
            }
          });
        });
        setCompletionBreakdown(Object.values(completionMap));

        // Fetch topic analysis from student answers and exam questions
        if (examIds.length > 0 && studentIds.length > 0) {
          const { data: questions } = await supabase
            .from("exam_questions")
            .select("id, exam_id, topic_tag, question_number, marks")
            .in("exam_id", examIds);

          const { data: answers } = await supabase
            .from("student_answers")
            .select("question_id, student_id, score, is_correct")
            .in("student_id", studentIds);

          if (questions && answers) {
            const topicStats: Record<string, { 
              totalScore: number; 
              maxScore: number; 
              incorrectCount: number; 
              totalAttempts: number;
              questionNumbers: Set<string>;
            }> = {};

            answers.forEach(answer => {
              const question = questions.find(q => q.id === answer.question_id);
              if (question && question.topic_tag) {
                const topic = question.topic_tag;
                if (!topicStats[topic]) {
                  topicStats[topic] = { 
                    totalScore: 0, 
                    maxScore: 0, 
                    incorrectCount: 0, 
                    totalAttempts: 0,
                    questionNumbers: new Set()
                  };
                }
                topicStats[topic].totalAttempts++;
                topicStats[topic].maxScore += question.marks || 1;
                topicStats[topic].totalScore += answer.score || 0;
                topicStats[topic].questionNumbers.add(question.question_number);
                if (answer.is_correct === false) {
                  topicStats[topic].incorrectCount++;
                }
              }
            });

            const topicAnalysisData: TopicAnalysis[] = Object.entries(topicStats)
              .map(([topic, stats]) => ({
                topic,
                avgScore: stats.maxScore > 0 ? (stats.totalScore / stats.maxScore) * 100 : 0,
                incorrectCount: stats.incorrectCount,
                totalAttempts: stats.totalAttempts,
                questionNumbers: Array.from(stats.questionNumbers)
              }))
              .sort((a, b) => a.avgScore - b.avgScore);

            setTopicAnalysis(topicAnalysisData);
          }
        }

      } catch (err) {
        console.error("Error fetching tutor students:", err);
        setError(err instanceof Error ? err.message : "Failed to load students");
      } finally {
        setLoading(false);
      }
    };

    fetchTutorStudents();
  }, []);

  return { students, loading, error, aggregateStats, allSubmissions, completionBreakdown, topicAnalysis };
};
