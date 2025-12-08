import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ArrowLeft, Users, Clock, CheckCircle, AlertCircle, 
  Eye, Loader2, Calendar, BarChart3, MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { ReleaseGradesModal } from "@/components/tutor/ReleaseGradesModal";
import { EditDeadlineModal } from "@/components/tutor/EditDeadlineModal";

interface StudentSubmission {
  studentId: string;
  studentName: string;
  studentCode: string;
  status: "not_started" | "in_progress" | "submitted";
  isLate: boolean;
  timeTaken: number | null;
  score: number | null;
  totalMarks: number | null;
  submittedAt: string | null;
}

interface ExamDetails {
  id: string;
  title: string;
  status: string;
  gradeReleased: boolean;
  deadline: string | null;
  totalStudents: number;
  completedStudents: number;
  averageScore: number | null;
  lateSubmissions: number;
}

const ExamDashboard = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [examDetails, setExamDetails] = useState<ExamDetails | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);

  const loadExamDashboard = async () => {
    if (!examId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Load exam details
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();

      if (examError) throw examError;

      // Load assignments to get deadline
      const { data: assignments } = await supabase
        .from("exam_assignments")
        .select("*")
        .eq("exam_id", examId)
        .eq("is_active", true);

      const deadline = assignments?.[0]?.deadline || null;

      // Get all assigned students
      const studentIds: string[] = [];
      
      if (assignments) {
        for (const assignment of assignments) {
          if (assignment.assignment_type === "group" && assignment.target_id) {
            const { data: members } = await supabase
              .from("group_members")
              .select("student_id")
              .eq("group_id", assignment.target_id)
              .eq("is_active", true);
            
            if (members) {
              studentIds.push(...members.map(m => m.student_id));
            }
          } else if (assignment.assignment_type === "individual" && assignment.target_id) {
            studentIds.push(assignment.target_id);
          }
        }
      }

      const uniqueStudentIds = [...new Set(studentIds)];

      // Get student profiles
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, display_name, student_code")
        .in("id", uniqueStudentIds);

      // Get submissions
      const { data: examSubmissions } = await supabase
        .from("exam_submissions")
        .select("*")
        .eq("exam_id", examId);

      // Build submission data
      const submissionsData: StudentSubmission[] = uniqueStudentIds.map(studentId => {
        const profile = profiles?.find(p => p.id === studentId);
        const submission = examSubmissions?.find(s => s.student_id === studentId);

        let status: "not_started" | "in_progress" | "submitted" = "not_started";
        if (submission) {
          status = submission.status === "submitted" || submission.status === "graded" 
            ? "submitted" 
            : "in_progress";
        }

        return {
          studentId,
          studentName: profile?.display_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Unknown",
          studentCode: profile?.student_code || "-",
          status,
          isLate: submission?.is_late || false,
          timeTaken: submission?.time_taken_seconds || null,
          score: submission?.total_score ? Number(submission.total_score) : null,
          totalMarks: submission?.total_marks || null,
          submittedAt: submission?.submitted_at || null,
        };
      });

      const completedSubmissions = submissionsData.filter(s => s.status === "submitted");
      const lateCount = submissionsData.filter(s => s.isLate).length;
      
      let avgScore: number | null = null;
      const scoresWithMarks = completedSubmissions.filter(s => s.score !== null && s.totalMarks);
      if (scoresWithMarks.length > 0) {
        const percentages = scoresWithMarks.map(s => (s.score! / s.totalMarks!) * 100);
        avgScore = percentages.reduce((a, b) => a + b, 0) / percentages.length;
      }

      setExamDetails({
        id: exam.id,
        title: exam.title,
        status: exam.status,
        gradeReleased: exam.grade_released || false,
        deadline,
        totalStudents: uniqueStudentIds.length,
        completedStudents: completedSubmissions.length,
        averageScore: avgScore,
        lateSubmissions: lateCount,
      });

      setSubmissions(submissionsData);
    } catch (error) {
      console.error("Error loading exam dashboard:", error);
      toast.error("Failed to load exam dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamDashboard();
  }, [examId]);

  const canReleaseGrades = useMemo(() => {
    if (!examDetails) return false;
    if (examDetails.gradeReleased) return false;
    
    const allSubmitted = examDetails.totalStudents > 0 && 
      examDetails.completedStudents === examDetails.totalStudents;
    const deadlinePassed = examDetails.deadline && new Date(examDetails.deadline) < new Date();
    
    return allSubmitted || deadlinePassed;
  }, [examDetails]);

  const formatTime = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadge = (status: string, isLate: boolean) => {
    if (status === "submitted") {
      return (
        <Badge variant={isLate ? "destructive" : "default"} className="capitalize">
          {isLate ? "Late" : "Submitted"}
        </Badge>
      );
    }
    if (status === "in_progress") {
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">In Progress</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">Not Started</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!examDetails) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Exam not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tutor/exams")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{examDetails.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={examDetails.status === "published" ? "default" : "secondary"}>
                {examDetails.status}
              </Badge>
              {examDetails.gradeReleased && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Grades Released
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDeadlineModalOpen(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Edit Deadline
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button 
                  onClick={() => setReleaseModalOpen(true)}
                  disabled={!canReleaseGrades || examDetails.gradeReleased}
                >
                  {examDetails.gradeReleased ? "Grades Released" : "Release Grades"}
                </Button>
              </span>
            </TooltipTrigger>
            {!canReleaseGrades && !examDetails.gradeReleased && (
              <TooltipContent>
                Grades can be released after the deadline or once all students submit
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{examDetails.totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {examDetails.completedStudents}/{examDetails.totalStudents}
                </p>
                <p className="text-sm text-muted-foreground">Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">
                  {examDetails.averageScore !== null ? `${examDetails.averageScore.toFixed(1)}%` : "-"}
                </p>
                <p className="text-sm text-muted-foreground">Average Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{examDetails.lateSubmissions}</p>
                <p className="text-sm text-muted-foreground">Late Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deadline Info */}
      {examDetails.deadline && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Deadline: <span className="font-medium">{format(new Date(examDetails.deadline), "PPP 'at' p")}</span>
                {new Date(examDetails.deadline) < new Date() && (
                  <Badge variant="destructive" className="ml-2">Passed</Badge>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No students assigned to this exam</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time Taken</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.studentId}>
                    <TableCell className="font-medium">{sub.studentName}</TableCell>
                    <TableCell className="text-muted-foreground">{sub.studentCode}</TableCell>
                    <TableCell>{getStatusBadge(sub.status, sub.isLate)}</TableCell>
                    <TableCell>{formatTime(sub.timeTaken)}</TableCell>
                    <TableCell>
                      {sub.score !== null && sub.totalMarks ? (
                        <span className="font-medium">
                          {sub.score}/{sub.totalMarks} ({((sub.score / sub.totalMarks) * 100).toFixed(0)}%)
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {sub.submittedAt ? format(new Date(sub.submittedAt), "MMM d, p") : "-"}
                    </TableCell>
                    <TableCell>
                      {sub.status === "submitted" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/tutor/exams/${examId}/student/${sub.studentId}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ReleaseGradesModal
        open={releaseModalOpen}
        onOpenChange={setReleaseModalOpen}
        examId={examDetails.id}
        examTitle={examDetails.title}
        onReleased={loadExamDashboard}
      />

      <EditDeadlineModal
        open={deadlineModalOpen}
        onOpenChange={setDeadlineModalOpen}
        examId={examDetails.id}
        examTitle={examDetails.title}
        currentDeadline={examDetails.deadline}
        onUpdated={loadExamDashboard}
      />
    </div>
  );
};

export default ExamDashboard;
