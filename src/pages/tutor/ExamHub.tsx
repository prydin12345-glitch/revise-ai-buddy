import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, Clock, CheckCircle, AlertCircle, 
  Eye, Loader2, Calendar, BarChart3, FileText, 
  Settings, Share2, Download, Trash2, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ReleaseGradesModal } from "@/components/tutor/ReleaseGradesModal";
import { EditDeadlineModal } from "@/components/tutor/EditDeadlineModal";
import { AssignModal } from "@/components/tutor/AssignModal";
import { MathRenderer } from "@/components/MathRenderer";
import { DestructiveConfirmationModal } from "@/components/tutor/DestructiveConfirmationModal";

type TabValue = "results" | "questions" | "assignments" | "export" | "settings";

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

interface ExamQuestion {
  id: string;
  question_number: string;
  question_text: string;
  question_type: string;
  marks: number;
  correct_answer: string | null;
}

interface ExamDetails {
  id: string;
  title: string;
  subject_id: string;
  status: string;
  gradeReleased: boolean;
  deadline: string | null;
  totalStudents: number;
  completedStudents: number;
  averageScore: number | null;
  lateSubmissions: number;
  created_at: string;
}

const ExamHub = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const initialTab = (searchParams.get("tab") as TabValue) || "results";
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  
  const [loading, setLoading] = useState(true);
  const [examDetails, setExamDetails] = useState<ExamDetails | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as TabValue);
    setSearchParams({ tab: value });
  }, [setSearchParams]);

  const loadExamData = async () => {
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

      // Load questions
      const { data: questionsData } = await supabase
        .from("exam_questions")
        .select("id, question_number, question_text, question_type, marks, correct_answer")
        .eq("exam_id", examId)
        .order("question_number");

      setQuestions(questionsData || []);

      // Load assignments (avoid embedded joins; relationship may not exist in backend schema)
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("exam_assignments")
        .select("*")
        .eq("exam_id", examId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (assignmentsError) throw assignmentsError;

      const rawAssignments = assignmentsData || [];

      // Resolve group names for display (best-effort)
      const groupTargetIds = rawAssignments
        .filter((a) => a.assignment_type === "group" && a.target_id)
        .map((a) => a.target_id as string);

      const { data: groupsData, error: groupsError } = groupTargetIds.length
        ? await supabase
            .from("student_groups")
            .select("id, name")
            .in("id", groupTargetIds)
        : { data: [], error: null };

      if (groupsError) throw groupsError;

      const groupNameById = new Map<string, string>(
        (groupsData || []).map((g) => [g.id, g.name])
      );

      const normalizedAssignments = rawAssignments.map((a) => {
        if (a.assignment_type === "group" && a.target_id) {
          const groupName = groupNameById.get(a.target_id);
          return {
            ...a,
            // Keep existing UI contract: assignment.student_groups?.name
            student_groups: groupName ? { name: groupName } : null,
          };
        }
        return { ...a, student_groups: null };
      });

      setAssignments(normalizedAssignments);

      const deadline = rawAssignments[0]?.deadline || null;

      // Collect assigned students (groups/classes/individuals)
      const assignedStudentIdSet = new Set<string>();

      if (groupTargetIds.length) {
        const { data: members, error: membersError } = await supabase
          .from("group_members")
          .select("student_id")
          .in("group_id", groupTargetIds)
          .eq("is_active", true);

        if (membersError) throw membersError;
        (members || []).forEach((m) => assignedStudentIdSet.add(m.student_id));
      }

      const classNames = rawAssignments
        .map((a) => a.class_name)
        .filter(Boolean) as string[];

      if (classNames.length) {
        const { data: classMembers, error: classMembersError } = await supabase
          .from("class_assignments")
          .select("student_id")
          .eq("teacher_id", user.id)
          .in("class_name", classNames)
          .eq("is_active", true);

        if (classMembersError) throw classMembersError;
        (classMembers || []).forEach((m) => assignedStudentIdSet.add(m.student_id));
      }

      rawAssignments.forEach((a) => {
        if (a.assignment_type === "individual" && a.target_id) {
          assignedStudentIdSet.add(a.target_id);
        }
      });

      const assignedStudentIds = [...assignedStudentIdSet];

      // Get submissions (authoritative for results)
      const { data: examSubmissions, error: submissionsError } = await supabase
        .from("exam_submissions")
        .select("*")
        .eq("exam_id", examId);

      if (submissionsError) throw submissionsError;

      // Include students with submissions even if assignment membership changed
      const submissionStudentIds = (examSubmissions || []).map((s) => s.student_id);
      const allStudentIds = [...new Set([...assignedStudentIds, ...submissionStudentIds])];

      // Get student profiles
      const { data: profiles, error: profilesError } = allStudentIds.length
        ? await supabase
            .from("user_profiles")
            .select("id, first_name, last_name, display_name, student_code")
            .in("id", allStudentIds)
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      // Build submission data
      const submissionsData: StudentSubmission[] = allStudentIds.map((studentId) => {
        const profile = profiles?.find((p) => p.id === studentId);
        const submission = examSubmissions?.find((s) => s.student_id === studentId);

        let status: "not_started" | "in_progress" | "submitted" = "not_started";
        if (submission) {
          status = submission.status === "submitted" || submission.status === "graded"
            ? "submitted"
            : "in_progress";
        }

        return {
          studentId,
          studentName:
            profile?.display_name ||
            `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
            "Unknown",
          studentCode: profile?.student_code || "-",
          status,
          isLate: submission?.is_late || false,
          timeTaken: submission?.time_taken_seconds || null,
          score: submission?.total_score ? Number(submission.total_score) : null,
          totalMarks: submission?.total_marks || null,
          submittedAt: submission?.submitted_at || null,
        };
      });

      const primaryStudentIds = assignedStudentIds.length ? assignedStudentIds : allStudentIds;
      const primarySet = new Set(primaryStudentIds);

      const completedSubmissions = submissionsData.filter(
        (s) => primarySet.has(s.studentId) && s.status === "submitted"
      );
      const lateCount = submissionsData.filter(
        (s) => primarySet.has(s.studentId) && s.isLate
      ).length;

      let avgScore: number | null = null;
      const scoresWithMarks = completedSubmissions.filter((s) => s.score !== null && s.totalMarks);
      if (scoresWithMarks.length > 0) {
        const percentages = scoresWithMarks.map((s) => (s.score! / s.totalMarks!) * 100);
        avgScore = percentages.reduce((a, b) => a + b, 0) / percentages.length;
      }

      setExamDetails({
        id: exam.id,
        title: exam.title,
        subject_id: exam.subject_id,
        status: exam.status,
        gradeReleased: exam.grade_released || false,
        deadline,
        totalStudents: primaryStudentIds.length,
        completedStudents: completedSubmissions.length,
        averageScore: avgScore,
        lateSubmissions: lateCount,
        created_at: exam.created_at,
      });

      setSubmissions(submissionsData);
    } catch (error) {
      console.error("Error loading exam:", error);
      toast.error("Failed to load exam");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamData();
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
        <Badge variant={isLate ? "danger" : "default"} className="capitalize">
          {isLate ? "Late" : "Submitted"}
        </Badge>
      );
    }
    if (status === "in_progress") {
      return <Badge variant="warning">In Progress</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">Not Started</Badge>;
  };

  const handleDelete = async () => {
    if (!examId) return;
    
    try {
      await supabase.from("exam_question_drafts").delete().eq("exam_id", examId);
      await supabase.from("exam_questions").delete().eq("exam_id", examId);
      await supabase.from("exam_assignments").delete().eq("exam_id", examId);
      await supabase.from("exam_submissions").delete().eq("exam_id", examId);
      await supabase.from("exam_topics").delete().eq("exam_id", examId);
      await supabase.from("exam_format").delete().eq("exam_id", examId);
      await supabase.from("exam_timer").delete().eq("exam_id", examId);
      await supabase.from("student_answers").delete().eq("exam_id", examId);
      
      const { error } = await supabase.from("exams").delete().eq("id", examId);
      
      if (error) throw error;
      
      toast.success("Exam deleted successfully");
      navigate("/tutor/exams");
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Failed to delete exam");
    }
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
        <Button variant="link" onClick={() => navigate("/tutor/exams")}>
          Back to exams
        </Button>
      </div>
    );
  }

  const tabs = [
    { value: "results", label: "Results", icon: BarChart3 },
    { value: "questions", label: "Questions", icon: FileText },
    { value: "assignments", label: "Assignments", icon: Share2 },
    { value: "export", label: "Export", icon: Download },
    { value: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header - No back button, rely on tab navigation and sidebar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{examDetails.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{examDetails.subject_id}</Badge>
            <Badge variant={examDetails.status === "published" ? "default" : "secondary"}>
              {examDetails.status}
            </Badge>
            {examDetails.gradeReleased && (
              <Badge variant="success">Grades Released</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation - Scrollable on mobile */}
      <ScrollArea className="w-full">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="inline-flex h-12 w-full sm:w-auto bg-muted/50 p-1 rounded-xl">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm min-w-[100px]"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />

          {/* Results Tab */}
          <TabsContent value="results" className="mt-6 space-y-6">
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
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Deadline: <span className="font-medium">{format(new Date(examDetails.deadline), "PPP 'at' p")}</span>
                        {new Date(examDetails.deadline) < new Date() && (
                          <Badge variant="danger" className="ml-2">Passed</Badge>
                        )}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDeadlineModalOpen(true)}>
                        Edit Deadline
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button 
                              size="sm"
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
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No students assigned to this exam</p>
                    <Button variant="outline" className="mt-4" onClick={() => handleTabChange("assignments")}>
                      Assign Students
                    </Button>
                  </div>
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
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Questions ({questions.length})</span>
                  {examDetails.status === "draft" && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/upload/${examId}/review-questions`)}>
                      Edit Questions
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {questions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No questions found</p>
                ) : (
                  <div className="space-y-4">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="p-4 rounded-lg border border-border bg-card/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">Q{q.question_number}</Badge>
                              <Badge variant="secondary">{q.question_type}</Badge>
                              <span className="text-sm text-muted-foreground">{q.marks} marks</span>
                            </div>
                            <div className="text-sm">
                              <MathRenderer content={q.question_text} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="mt-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Current Assignments</h3>
              <Button onClick={() => setAssignModalOpen(true)}>
                <Share2 className="h-4 w-4 mr-2" />
                Assign to Group
              </Button>
            </div>

            {assignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">This exam hasn't been assigned to any groups yet</p>
                  <Button className="mt-4" onClick={() => setAssignModalOpen(true)}>
                    Assign Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <Card key={assignment.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {assignment.student_groups?.name || assignment.class_name || "Unknown Group"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.assignment_type === "group" ? "Group Assignment" : "Individual"}
                          </p>
                        </div>
                        {assignment.deadline && (
                          <div className="text-right">
                            <p className="text-sm">Deadline</p>
                            <p className="text-sm font-medium">
                              {format(new Date(assignment.deadline), "PPP")}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Download className="h-4 w-4" />
                  Download Exam PDF
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Download className="h-4 w-4" />
                  Download Results CSV
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Download className="h-4 w-4" />
                  Download Answer Key
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Exam Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">Current exam status</p>
                  </div>
                  <Badge variant={examDetails.status === "published" ? "default" : "secondary"}>
                    {examDetails.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">When this exam was created</p>
                  </div>
                  <span className="text-sm">{format(new Date(examDetails.created_at), "PPP")}</span>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-2 border-[hsl(0_65%_55%)] bg-[hsl(0_50%_15%)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[hsl(0_90%_70%)]">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[hsl(0_60%_80%)] mb-4">
                  Permanently delete this exam and all associated data including student submissions.
                </p>
                <Button 
                  variant="destructive" 
                  onClick={() => setDeleteModalOpen(true)}
                  className="bg-[hsl(0_72%_51%)] hover:bg-[hsl(0_72%_45%)] text-white"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Exam
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </ScrollArea>

      {/* Modals */}
      <ReleaseGradesModal
        open={releaseModalOpen}
        onOpenChange={setReleaseModalOpen}
        examId={examDetails.id}
        examTitle={examDetails.title}
        onReleased={loadExamData}
      />

      <EditDeadlineModal
        open={deadlineModalOpen}
        onOpenChange={setDeadlineModalOpen}
        examId={examDetails.id}
        examTitle={examDetails.title}
        currentDeadline={examDetails.deadline}
        onUpdated={loadExamData}
      />

      <AssignModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        examId={examDetails.id}
        examTitle={examDetails.title}
        onAssigned={loadExamData}
      />

      <DestructiveConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Exam"
        description={`Are you sure you want to delete "${examDetails.title}"? This action cannot be undone and will remove all student submissions.`}
        confirmText={examDetails.title}
        confirmPlaceholder="Type exam title to confirm"
        actionLabel="Delete Exam"
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default ExamHub;
