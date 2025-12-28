import { useState, useEffect, useMemo } from "react";
import { X, BarChart3, Users, FileQuestion, TrendingUp, Search, ArrowUpDown, ChevronRight, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";

interface StudentResult {
  studentId: string;
  studentName: string;
  studentCode: string;
  status: "not_started" | "in_progress" | "submitted";
  isLate: boolean;
  timeTaken: number | null;
  score: number | null;
  totalMarks: number | null;
  submittedAt: string | null;
  percentage: number | null;
}

interface QuestionStats {
  id: string;
  questionNumber: string;
  questionText: string;
  correctCount: number;
  totalAnswers: number;
  correctPercentage: number;
  topicTag: string | null;
  difficultyLevel: string | null;
}

interface ExamResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  examTitle: string;
  groupId?: string;
  groupName?: string;
}

export const ExamResultsModal = ({
  open,
  onOpenChange,
  examId,
  examTitle,
  groupId,
  groupName,
}: ExamResultsModalProps) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [questions, setQuestions] = useState<QuestionStats[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSort, setStudentSort] = useState<"score-high" | "score-low" | "name-asc" | "status">("score-high");
  const [questionSort, setQuestionSort] = useState<"accuracy-low" | "accuracy-high" | "number">("accuracy-low");
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);

  useEffect(() => {
    if (open && examId) {
      loadResults();
    }
  }, [open, examId, groupId]);

  const loadResults = async () => {
    setLoading(true);
    try {
      // Get assigned students
      const studentIds: string[] = [];

      if (groupId) {
        const { data: members } = await supabase
          .from("group_members")
          .select("student_id")
          .eq("group_id", groupId)
          .eq("is_active", true);
        
        if (members) {
          studentIds.push(...members.map(m => m.student_id));
        }
      } else {
        // Get all assignments for this exam
        const { data: assignments } = await supabase
          .from("exam_assignments")
          .select("target_id, assignment_type")
          .eq("exam_id", examId)
          .eq("is_active", true);

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
      }

      const uniqueStudentIds = [...new Set(studentIds)];

      // Get profiles
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, display_name, student_code")
        .in("id", uniqueStudentIds);

      // Get submissions
      const { data: submissions } = await supabase
        .from("exam_submissions")
        .select("*")
        .eq("exam_id", examId);

      // Build student results
      const studentResults: StudentResult[] = uniqueStudentIds.map(studentId => {
        const profile = profiles?.find(p => p.id === studentId);
        const submission = submissions?.find(s => s.student_id === studentId);

        let status: "not_started" | "in_progress" | "submitted" = "not_started";
        if (submission) {
          status = submission.status === "submitted" || submission.status === "graded" ? "submitted" : "in_progress";
        }

        const score = submission?.total_score ? Number(submission.total_score) : null;
        const totalMarks = submission?.total_marks || null;
        const percentage = score !== null && totalMarks ? Math.round((score / totalMarks) * 100) : null;

        return {
          studentId,
          studentName: profile?.display_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Unknown",
          studentCode: profile?.student_code || "-",
          status,
          isLate: submission?.is_late || false,
          timeTaken: submission?.time_taken_seconds || null,
          score,
          totalMarks,
          submittedAt: submission?.submitted_at || null,
          percentage,
        };
      });

      setResults(studentResults);

      // Get questions and calculate stats
      const { data: examQuestions } = await supabase
        .from("exam_questions")
        .select("id, question_number, question_text, topic_tag, difficulty_level")
        .eq("exam_id", examId)
        .order("question_number");

      const { data: answers } = await supabase
        .from("student_answers")
        .select("question_id, is_correct, student_id")
        .eq("exam_id", examId);

      const questionStats: QuestionStats[] = (examQuestions || []).map(q => {
        const questionAnswers = answers?.filter(a => a.question_id === q.id) || [];
        const correctCount = questionAnswers.filter(a => a.is_correct).length;

        return {
          id: q.id,
          questionNumber: q.question_number,
          questionText: q.question_text,
          correctCount,
          totalAnswers: questionAnswers.length,
          correctPercentage: questionAnswers.length > 0 ? Math.round((correctCount / questionAnswers.length) * 100) : 0,
          topicTag: q.topic_tag,
          difficultyLevel: q.difficulty_level,
        };
      });

      setQuestions(questionStats);
    } catch (error) {
      console.error("Error loading results:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const completed = results.filter(r => r.status === "submitted");
    const scores = completed.filter(r => r.percentage !== null).map(r => r.percentage!);
    
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const highest = scores.length > 0 ? Math.max(...scores) : null;
    const lowest = scores.length > 0 ? Math.min(...scores) : null;
    const median = scores.length > 0 
      ? [...scores].sort((a, b) => a - b)[Math.floor(scores.length / 2)] 
      : null;
    const completionRate = results.length > 0 
      ? Math.round((completed.length / results.length) * 100) 
      : 0;

    // Weak topics
    const topicScores: { [key: string]: { correct: number; total: number } } = {};
    questions.forEach(q => {
      const topic = q.topicTag || "General";
      if (!topicScores[topic]) topicScores[topic] = { correct: 0, total: 0 };
      topicScores[topic].correct += q.correctCount;
      topicScores[topic].total += q.totalAnswers;
    });

    const weakTopics = Object.entries(topicScores)
      .map(([topic, data]) => ({
        topic,
        percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3);

    return {
      total: results.length,
      completed: completed.length,
      avg,
      highest,
      lowest,
      median,
      completionRate,
      weakTopics,
    };
  }, [results, questions]);

  // Histogram data
  const histogramData = useMemo(() => {
    const ranges = [
      { label: "0-10", min: 0, max: 10 },
      { label: "11-20", min: 11, max: 20 },
      { label: "21-30", min: 21, max: 30 },
      { label: "31-40", min: 31, max: 40 },
      { label: "41-50", min: 41, max: 50 },
      { label: "51-60", min: 51, max: 60 },
      { label: "61-70", min: 61, max: 70 },
      { label: "71-80", min: 71, max: 80 },
      { label: "81-90", min: 81, max: 90 },
      { label: "91-100", min: 91, max: 100 },
    ];

    return ranges.map(range => {
      const count = results.filter(r => {
        if (r.percentage === null) return false;
        return r.percentage >= range.min && r.percentage <= range.max;
      }).length;

      return { range: range.label, count };
    });
  }, [results]);

  // Filtered and sorted students
  const filteredStudents = useMemo(() => {
    return results
      .filter(r => {
        if (!studentSearch) return true;
        const q = studentSearch.toLowerCase();
        return r.studentName.toLowerCase().includes(q) || r.studentCode.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (studentSort === "score-high") {
          return (b.percentage ?? -1) - (a.percentage ?? -1);
        }
        if (studentSort === "score-low") {
          return (a.percentage ?? 101) - (b.percentage ?? 101);
        }
        if (studentSort === "name-asc") {
          return a.studentName.localeCompare(b.studentName);
        }
        // status
        const statusOrder = { submitted: 0, in_progress: 1, not_started: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
  }, [results, studentSearch, studentSort]);

  // Filtered and sorted questions
  const filteredQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      if (questionSort === "accuracy-low") {
        return a.correctPercentage - b.correctPercentage;
      }
      if (questionSort === "accuracy-high") {
        return b.correctPercentage - a.correctPercentage;
      }
      return a.questionNumber.localeCompare(b.questionNumber, undefined, { numeric: true });
    });
  }, [questions, questionSort]);

  const formatTime = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  const getBarColor = (range: string) => {
    const num = parseInt(range.split("-")[0]);
    if (num >= 81) return "hsl(142, 71%, 45%)";
    if (num >= 61) return "hsl(210, 85%, 55%)";
    if (num >= 41) return "hsl(45, 93%, 47%)";
    return "hsl(0, 72%, 51%)";
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm">Score: {data.range}%</p>
        <p className="text-xs text-muted-foreground">{data.count} student{data.count !== 1 ? "s" : ""}</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden rounded-2xl border-white/10 bg-card shadow-2xl backdrop-blur-sm grid grid-rows-[88px_56px_1fr]"
        style={{
          width: "clamp(900px, 80vw, 1200px)",
          height: "clamp(600px, 80vh, 760px)",
          maxWidth: "none",
          maxHeight: "none",
        }}
        hideCloseButton
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 border-b border-border/50 bg-card h-full">
          <div className="space-y-1.5">
            <DialogTitle className="text-xl font-semibold tracking-tight flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              {examTitle}
            </DialogTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              {groupName && <Badge variant="secondary" className="font-normal">{groupName}</Badge>}
              <span>{stats.completed}/{stats.total} completed</span>
              <span className="text-muted-foreground/60">•</span>
              <span>{stats.completionRate}% completion rate</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="rounded-full hover:bg-muted/50"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="contents">
          <div className="px-6 flex items-end border-b border-border/30 bg-card/50 h-full">
            <TabsList className="bg-transparent p-0 h-auto gap-1">
              <TabsTrigger
                value="overview"
                className="gap-2 px-4 py-2.5 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <TrendingUp className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="distribution"
                className="gap-2 px-4 py-2.5 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <BarChart3 className="w-4 h-4" />
                Distribution
              </TabsTrigger>
              <TabsTrigger
                value="students"
                className="gap-2 px-4 py-2.5 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <Users className="w-4 h-4" />
                Students
              </TabsTrigger>
              <TabsTrigger
                value="questions"
                className="gap-2 px-4 py-2.5 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <FileQuestion className="w-4 h-4" />
                Questions
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content */}
          <div className="overflow-y-auto overflow-x-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                <TabsContent value="overview" className="m-0 p-5 space-y-5 data-[state=inactive]:hidden">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-2xl font-bold">{stats.avg !== null ? `${stats.avg.toFixed(1)}%` : "-"}</p>
                      <p className="text-xs text-muted-foreground mt-1">Average Score</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-2xl font-bold">{stats.completionRate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Completion</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-2xl font-bold text-emerald-500">{stats.highest !== null ? `${stats.highest}%` : "-"}</p>
                      <p className="text-xs text-muted-foreground mt-1">Highest</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-2xl font-bold text-destructive">{stats.lowest !== null ? `${stats.lowest}%` : "-"}</p>
                      <p className="text-xs text-muted-foreground mt-1">Lowest</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-2xl font-bold">{stats.median !== null ? `${stats.median}%` : "-"}</p>
                      <p className="text-xs text-muted-foreground mt-1">Median</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-2xl font-bold">{stats.completed}/{stats.total}</p>
                      <p className="text-xs text-muted-foreground mt-1">Completed</p>
                    </div>
                  </div>

                  {/* At a Glance */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Weak Topics */}
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                      <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        Topics Needing Attention
                      </h3>
                      {stats.weakTopics.length > 0 ? (
                        <div className="space-y-3">
                          {stats.weakTopics.map((topic, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="truncate">{topic.topic}</span>
                                <span className="text-muted-foreground">{topic.percentage}%</span>
                              </div>
                              <Progress value={topic.percentage} className="h-1.5" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No topic data available</p>
                      )}
                    </div>

                    {/* Quick Summary */}
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                      <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        Quick Summary
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Students assigned</span>
                          <span className="font-medium">{stats.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Submissions</span>
                          <span className="font-medium">{stats.completed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Not started</span>
                          <span className="font-medium">{results.filter(r => r.status === "not_started").length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">In progress</span>
                          <span className="font-medium">{results.filter(r => r.status === "in_progress").length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {stats.total === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No results yet</p>
                      <p className="text-sm mt-1">Check back once students complete the exam</p>
                    </div>
                  )}
                </TabsContent>

                {/* Distribution Tab */}
                <TabsContent value="distribution" className="m-0 p-5 space-y-4 data-[state=inactive]:hidden">
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                    <h3 className="font-medium text-sm mb-4">Score Distribution</h3>
                    {stats.completed > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis
                            dataKey="range"
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={{ stroke: "hsl(var(--border))" }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={{ stroke: "hsl(var(--border))" }}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey="count"
                            radius={[4, 4, 0, 0]}
                            fill="hsl(var(--primary))"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        <div className="text-center">
                          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="font-medium">No submissions yet</p>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Students Tab */}
                <TabsContent value="students" className="m-0 p-5 space-y-4 data-[state=inactive]:hidden">
                  {/* Controls */}
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search students..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="pl-9 bg-muted/30 border-border/50"
                      />
                    </div>
                    <Select value={studentSort} onValueChange={(v: any) => setStudentSort(v)}>
                      <SelectTrigger className="w-[160px] bg-muted/30 border-border/50">
                        <ArrowUpDown className="w-3.5 h-3.5 mr-2 opacity-50" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="score-high">Score High→Low</SelectItem>
                        <SelectItem value="score-low">Score Low→High</SelectItem>
                        <SelectItem value="name-asc">Name A–Z</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Student List */}
                  <div className="space-y-2">
                    {filteredStudents.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No students found</p>
                      </div>
                    ) : (
                      filteredStudents.map((student) => (
                        <div
                          key={student.studentId}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors border border-border/30 group cursor-pointer"
                          onClick={() => setSelectedStudent(selectedStudent?.studentId === student.studentId ? null : student)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-border/50">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                {student.studentName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm flex items-center gap-2">
                                {student.studentName}
                                <span className="text-muted-foreground font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                                  {student.studentCode}
                                </span>
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {student.status === "submitted" ? (
                                  <Badge variant={student.isLate ? "destructive" : "default"} className="text-[10px] px-1.5 py-0">
                                    {student.isLate ? "Late" : "Submitted"}
                                  </Badge>
                                ) : student.status === "in_progress" ? (
                                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 text-[10px] px-1.5 py-0">In Progress</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Not Started</Badge>
                                )}
                                {student.submittedAt && (
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(student.submittedAt), "MMM d, p")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {student.percentage !== null && (
                              <div className="text-right">
                                <p className={`font-semibold ${student.percentage >= 70 ? "text-emerald-500" : student.percentage >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                  {student.percentage}%
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {student.score}/{student.totalMarks}
                                </p>
                              </div>
                            )}
                            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selectedStudent?.studentId === student.studentId ? "rotate-90" : ""}`} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Questions Tab */}
                <TabsContent value="questions" className="m-0 p-5 space-y-4 data-[state=inactive]:hidden">
                  {/* Controls */}
                  <div className="flex gap-2 flex-wrap">
                    <Select value={questionSort} onValueChange={(v: any) => setQuestionSort(v)}>
                      <SelectTrigger className="w-[180px] bg-muted/30 border-border/50">
                        <ArrowUpDown className="w-3.5 h-3.5 mr-2 opacity-50" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accuracy-low">Lowest Accuracy</SelectItem>
                        <SelectItem value="accuracy-high">Highest Accuracy</SelectItem>
                        <SelectItem value="number">Question Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-2">
                    {filteredQuestions.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileQuestion className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No questions found</p>
                      </div>
                    ) : (
                      filteredQuestions.map((q) => (
                        <div
                          key={q.id}
                          className="p-4 rounded-xl bg-muted/20 border border-border/30"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">Q{q.questionNumber}</span>
                                {q.topicTag && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{q.topicTag}</Badge>
                                )}
                                {q.difficultyLevel && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{q.difficultyLevel}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{q.questionText}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-semibold ${q.correctPercentage >= 70 ? "text-emerald-500" : q.correctPercentage >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                {q.correctPercentage}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {q.correctCount}/{q.totalAnswers} correct
                              </p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <Progress value={q.correctPercentage} className="h-1.5" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};