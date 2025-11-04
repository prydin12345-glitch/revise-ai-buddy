import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, TrendingUp, Clock, Trophy, Flame, CheckSquare, Calendar as CalendarIcon, MessageSquare, RotateCcw, Plus, Heart, ClipboardList, MoreVertical, Play, Eye, Trash2, Edit as EditIcon, Filter, CheckCircle2, Award, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SubjectSelector } from "./SubjectSelector";
import { useUserSubjects } from "@/hooks/useUserSubjects";

interface DashboardContentProps {
  userEmail: string;
}

interface ExamWithSubmission {
  id: string;
  title: string;
  subject_id: string;
  status: string;
  type: string;
  created_at: string;
  totalQuestions?: number;
  answeredQuestions?: number;
  submission?: {
    total_score: number;
    total_marks: number;
    submitted_at: string;
  };
}

interface RevisionGoal {
  id: string;
  subject: string;
  target_exams: number;
  target_percentage: number | null;
  deadline: string | null;
  progress: number;
  subject_color: string;
}

export const DashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const userName = userEmail.split("@")[0];
  const { getSubjectColor } = useUserSubjects();
  
  const [exams, setExams] = useState<ExamWithSubmission[]>([]);
  const [filteredExams, setFilteredExams] = useState<ExamWithSubmission[]>([]);
  const [revisionGoals, setRevisionGoals] = useState<RevisionGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBy, setFilterBy] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editGoalDialogOpen, setEditGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<RevisionGoal | null>(null);
  const [newGoal, setNewGoal] = useState({
    subject: "",
    target_exams: 10,
    target_percentage: null as number | null,
    deadline: null as Date | null,
    subject_color: "#3B82F6",
  });

  const stats = [
    { label: "Exams Taken", value: exams.filter(e => e.submission).length.toString(), emoji: "📄" },
    { 
      label: "Average Score", 
      value: exams.filter(e => e.submission).length > 0 
        ? `${Math.round(exams.filter(e => e.submission).reduce((acc, e) => acc + ((e.submission!.total_score / e.submission!.total_marks) * 100), 0) / exams.filter(e => e.submission).length)}%`
        : "-", 
      emoji: "📊" 
    },
    { label: "Study Hours", value: "0h", emoji: "⏰" },
    { label: "Day Streak", value: "0", emoji: "🔥" },
  ];

  useEffect(() => {
    loadExams();
    loadRevisionGoals();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [exams, filterBy, sortBy]);

  const loadExams = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (examsError) throw examsError;

      const examsWithSubmissions = await Promise.all(
        (examsData || []).map(async (exam) => {
          const { data: submission } = await supabase
            .from("exam_submissions")
            .select("total_score, total_marks, submitted_at")
            .eq("exam_id", exam.id)
            .eq("student_id", user.id)
            .maybeSingle();

          // Fetch questions count
          const { count: totalQuestions } = await supabase
            .from("exam_questions")
            .select("*", { count: "exact", head: true })
            .eq("exam_id", exam.id);

          // Fetch answered questions count
          const { count: answeredQuestions } = await supabase
            .from("student_answers")
            .select("*", { count: "exact", head: true })
            .eq("exam_id", exam.id)
            .eq("student_id", user.id);

          return {
            ...exam,
            submission: submission || undefined,
            totalQuestions: totalQuestions || 0,
            answeredQuestions: answeredQuestions || 0,
          };
        })
      );

      setExams(examsWithSubmissions);
    } catch (error) {
      console.error("Error loading exams:", error);
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  const loadRevisionGoals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: goalsData, error: goalsError } = await supabase
        .from("revision_goals")
        .select("*")
        .eq("user_id", user.id);

      if (goalsError) throw goalsError;

      const goalsWithProgress = await Promise.all(
        (goalsData || []).map(async (goal) => {
          // Get all exams for this subject
          const { data: subjectExams } = await supabase
            .from("exams")
            .select("id")
            .eq("user_id", user.id)
            .eq("subject_id", goal.subject);

          const examIds = subjectExams?.map(e => e.id) || [];

          // Count how many of these exams have submissions
          if (examIds.length === 0) {
            return {
              ...goal,
              progress: 0,
              subject_color: goal.subject_color || "#3B82F6",
            };
          }

          const { count: completedCount } = await supabase
            .from("exam_submissions")
            .select("*", { count: "exact", head: true })
            .eq("student_id", user.id)
            .in("exam_id", examIds);

          return {
            ...goal,
            progress: completedCount || 0,
            subject_color: goal.subject_color || "#3B82F6",
          };
        })
      );

      setRevisionGoals(goalsWithProgress);
    } catch (error) {
      console.error("Error loading goals:", error);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...exams];

    // Apply status filter
    if (filterBy === "completed") {
      filtered = filtered.filter(exam => exam.submission);
    } else if (filterBy === "in-progress") {
      filtered = filtered.filter(exam => !exam.submission);
    }

    // Apply subject filter if not "all"
    if (filterBy !== "all" && filterBy !== "completed" && filterBy !== "in-progress") {
      filtered = filtered.filter(exam => exam.subject_id === filterBy);
    }

    // Apply sorting
    if (sortBy === "date-desc") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "date-asc") {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === "score-desc") {
      filtered.sort((a, b) => {
        const scoreA = a.submission ? (a.submission.total_score / a.submission.total_marks) * 100 : 0;
        const scoreB = b.submission ? (b.submission.total_score / b.submission.total_marks) * 100 : 0;
        return scoreB - scoreA;
      });
    } else if (sortBy === "score-asc") {
      filtered.sort((a, b) => {
        const scoreA = a.submission ? (a.submission.total_score / a.submission.total_marks) * 100 : 0;
        const scoreB = b.submission ? (b.submission.total_score / b.submission.total_marks) * 100 : 0;
        return scoreA - scoreB;
      });
    }

    setFilteredExams(filtered);
  };


  const getStatusConfig = (isCompleted: boolean) => {
    if (isCompleted) {
      return {
        label: "Completed",
        icon: CheckCircle2,
        cardBgClass: "bg-success-light",
        borderClass: "border-success-border",
        textClass: "text-white",
        dotColor: "bg-success",
        iconColor: "text-success",
      };
    }
    return {
      label: "In Progress",
      icon: Clock,
      cardBgClass: "bg-warning-light",
      borderClass: "border-warning-border",
      textClass: "text-white",
      dotColor: "bg-warning",
      iconColor: "text-warning",
    };
  };


  const deleteExam = async (examId: string) => {
    try {
      const { error } = await supabase
        .from("exams")
        .delete()
        .eq("id", examId);

      if (error) throw error;

      toast.success("Exam deleted successfully");
      loadExams();
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Failed to delete exam");
    }
  };

  const addGoal = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("revision_goals")
        .insert({
          user_id: user.id,
          subject: newGoal.subject,
          target_exams: newGoal.target_exams,
          target_percentage: newGoal.target_percentage,
          deadline: newGoal.deadline ? newGoal.deadline.toISOString() : null,
          subject_color: newGoal.subject_color,
        });

      if (error) throw error;

      toast.success("Goal added successfully");
      setGoalDialogOpen(false);
      setNewGoal({
        subject: "",
        target_exams: 10,
        target_percentage: null,
        deadline: null,
        subject_color: "#3B82F6",
      });
      loadRevisionGoals();
    } catch (error) {
      console.error("Error adding goal:", error);
      toast.error("Failed to add goal");
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from("revision_goals")
        .delete()
        .eq("id", goalId);

      if (error) throw error;

      toast.success("Goal deleted successfully");
      loadRevisionGoals();
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast.error("Failed to delete goal");
    }
  };

  const startEditGoal = (goal: RevisionGoal) => {
    setEditingGoal(goal);
    setEditGoalDialogOpen(true);
  };

  const updateGoal = async () => {
    if (!editingGoal) return;
    
    try {
      const { error } = await supabase
        .from("revision_goals")
        .update({
          subject: editingGoal.subject,
          target_exams: editingGoal.target_exams,
          target_percentage: editingGoal.target_percentage,
          deadline: editingGoal.deadline,
          subject_color: editingGoal.subject_color,
        })
        .eq("id", editingGoal.id);

      if (error) throw error;

      toast.success("Goal updated successfully");
      setEditGoalDialogOpen(false);
      setEditingGoal(null);
      loadRevisionGoals();
    } catch (error) {
      console.error("Error updating goal:", error);
      toast.error("Failed to update goal");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        {/* Left: Main Content */}
        <div className="space-y-8">
          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-16 text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
              onClick={() => navigate("/upload")}
            >
              <Upload className="w-5 h-5 mr-3" />
              Create Mock Exam
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-16 text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
              onClick={() => navigate("/exams/new")}
            >
              <FileText className="w-5 h-5 mr-3" />
              Create Practice Questions
            </Button>
          </div>

          {/* Recent exams section */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center justify-between text-2xl font-bold">
                <span>Recents</span>
                {/* Centralized Status Indicator */}
                {filteredExams.length > 0 && (
                  <div className="flex items-center gap-6">
                    {(filterBy === "all" || filterBy === "completed") && filteredExams.filter(e => e.submission).length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] font-medium text-white">
                          {filteredExams.filter(e => e.submission).length} Completed
                        </span>
                        <div className="h-3 w-3 rounded-full bg-success shadow-lg animate-pulse" />
                      </div>
                    )}
                    {(filterBy === "all" || filterBy === "in-progress") && filteredExams.filter(e => !e.submission).length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] font-medium text-white">
                          {filteredExams.filter(e => !e.submission).length} In Progress
                        </span>
                        <div className="h-3 w-3 rounded-full bg-warning shadow-lg animate-pulse" />
                      </div>
                    )}
                  </div>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      Filter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={filterBy} onValueChange={setFilterBy}>
                      <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="in-progress">In Progress</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                      <DropdownMenuRadioItem value="date-desc">Newest First</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="date-asc">Oldest First</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="score-desc">Highest Score</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="score-asc">Lowest Score</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {loading ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : filteredExams.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🎯</div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">No exams yet! Let's get started.</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Start your first mock exam to track your progress and identify areas for improvement
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredExams.map((exam) => {
                    const statusConfig = getStatusConfig(!!exam.submission);
                    const StatusIcon = statusConfig.icon;
                    const score = exam.submission 
                      ? Math.round((exam.submission.total_score / exam.submission.total_marks) * 100)
                      : null;

                    return (
                      <Card 
                        key={exam.id} 
                        className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 border-2 ${statusConfig.borderClass} rounded-xl ${statusConfig.cardBgClass} hover:brightness-95`}
                      >
                        <CardContent className="p-6 space-y-4">
                          {/* Header Row: Title + Actions */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-3">
                              <h3 className="text-[17px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                {exam.title}
                              </h3>
                              
                              {/* Subject Badge */}
                              <Badge 
                                style={{ 
                                  backgroundColor: getSubjectColor(exam.subject_id),
                                  color: 'white',
                                  borderColor: getSubjectColor(exam.subject_id)
                                }}
                                className="text-[13px] font-medium px-3 py-1 rounded-full border-0"
                              >
                                {exam.subject_id}
                              </Badge>
                            </div>
                            
                            {/* Action Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {exam.submission ? (
                                  <DropdownMenuItem onClick={() => navigate(`/exam/${exam.id}/review`)} className="gap-2">
                                    <Eye className="h-4 w-4" />
                                    Review Exam
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => navigate(`/exam/${exam.id}`)} className="gap-2">
                                    <Play className="h-4 w-4" />
                                    Resume Exam
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => navigate(`/exam/${exam.id}/preview`)} className="gap-2">
                                  <Eye className="h-4 w-4" />
                                  Preview Questions
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => deleteExam(exam.id)} 
                                  className="gap-2 text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Score and Date with thicker separator */}
                          <div className="flex items-center justify-between pt-4 border-t-2 border-white/30">
                            <div className="flex items-center gap-6 text-[13px]">
                              {score !== null && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <TrendingUp className="h-3.5 w-3.5" />
                                  <span className="text-[15px] font-semibold text-foreground">
                                    {score}%
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-white">
                                <CalendarIcon className="h-3.5 w-3.5 text-white" />
                                <span className="text-white text-[13px]">
                                  Created on: {new Date(exam.created_at).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                        </CardContent>

                        {/* Progress bar for in-progress exams */}
                        {!exam.submission && exam.totalQuestions && exam.totalQuestions > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-destructive/20">
                            <div 
                              className="h-full bg-destructive transition-all duration-500 relative group/progress"
                              style={{ width: `${(exam.answeredQuestions || 0) / exam.totalQuestions * 100}%` }}
                            >
                              <span className="absolute -top-8 right-0 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded opacity-0 group-hover/progress:opacity-100 transition-opacity whitespace-nowrap">
                                {exam.answeredQuestions || 0}/{exam.totalQuestions} ({Math.round((exam.answeredQuestions || 0) / exam.totalQuestions * 100)}%)
                              </span>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Sidebar Panels */}
        <div className="space-y-6">
          {/* Floating Stats Badges */}
          <TooltipProvider>
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent/20 hover:border hover:border-border cursor-pointer"
                    onClick={() => navigate("/stats?tab=stats")}
                  >
                    <FileText className="h-5 w-5 text-blue-500" />
                    <span className="text-base font-medium text-foreground">{exams.filter(e => e.submission).length}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>Total number of exams you've completed so far</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent/20 hover:border hover:border-border cursor-pointer"
                    onClick={() => navigate("/stats?tab=stats")}
                  >
                    <Target className="h-5 w-5 text-green-500" />
                    <span className="text-base font-medium text-foreground">
                      {exams.filter(e => e.submission).length > 0 
                        ? `${Math.round(exams.filter(e => e.submission).reduce((acc, e) => acc + ((e.submission!.total_score / e.submission!.total_marks) * 100), 0) / exams.filter(e => e.submission).length)}%`
                        : "-"}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>Your average score across all completed exams</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent/20 hover:border hover:border-border cursor-pointer"
                    onClick={() => navigate("/stats?tab=stats")}
                  >
                    <Clock className="h-5 w-5 text-purple-500" />
                    <span className="text-base font-medium text-foreground">0h</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>Total time spent actively revising or taking exams</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent/20 hover:border hover:border-border cursor-pointer"
                    onClick={() => navigate("/stats?tab=stats")}
                  >
                    <Flame className="h-5 w-5 text-orange-500" />
                    <span className="text-base font-medium text-foreground">0</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>How many consecutive days you've been active</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          {/* Revision goals panel */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                <Trophy className="w-6 h-6 text-primary" />
                Revision Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {revisionGoals.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No goals yet. Create your first goal!</p>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  {revisionGoals.map((goal) => {
                    const isCompleted = goal.progress >= goal.target_exams;
                    const daysUntilDeadline = goal.deadline 
                      ? Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                    return (
                      <Card 
                        key={goal.id} 
                        className="relative overflow-hidden hover:shadow-lg transition-all duration-300 group border-2 flex-shrink-0 w-[280px] sm:w-[320px] snap-center"
                        style={{ 
                          borderColor: `${goal.subject_color}40`,
                          backgroundColor: `${goal.subject_color}08` 
                        }}
                      >
                        <CardContent className="p-6 space-y-4">
                          {/* Header with subject and actions */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: goal.subject_color }}
                              />
                              <h3 className="text-lg font-bold text-foreground">{goal.subject}</h3>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background border-border z-[100]">
                                <DropdownMenuItem 
                                  onClick={() => startEditGoal(goal)}
                                >
                                  <EditIcon className="w-4 h-4 mr-2" />
                                  Edit Goal
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => deleteGoal(goal.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Goal
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Achievement badge */}
                          {isCompleted && (
                            <div className="flex items-center gap-2 text-success">
                              <Award className="w-5 h-5" />
                              <span className="text-sm font-semibold">Goal Achieved!</span>
                            </div>
                          )}

                          {/* Info section */}
                          <div className="space-y-2 text-sm">
                            {goal.target_percentage && (
                              <div className="flex items-center justify-between text-white">
                                <span>Target Average:</span>
                                <span className="font-semibold">{goal.target_percentage}%</span>
                              </div>
                            )}
                            {goal.deadline && (
                              <div className="flex items-center justify-between text-white">
                                <span>Deadline:</span>
                                <span className={cn(
                                  "font-semibold",
                                  daysUntilDeadline !== null && daysUntilDeadline < 7 ? "text-destructive" : ""
                                )}>
                                  {format(new Date(goal.deadline), "MMM dd, yyyy")}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Progress bar at bottom */}
                          <div className="relative mt-4 h-10 border-2 border-border rounded-lg overflow-hidden bg-muted/30">
                            <div 
                              className="h-full transition-all duration-700 ease-out flex items-center justify-center"
                              style={{ 
                                width: `${Math.min((goal.progress / goal.target_exams) * 100, 100)}%`,
                                backgroundColor: goal.subject_color,
                              }}
                            >
                              {goal.progress > 0 && (
                                <span className="text-white font-bold text-sm">
                                  {goal.progress}/{goal.target_exams}
                                </span>
                              )}
                            </div>
                            {goal.progress === 0 && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-muted-foreground font-semibold text-sm">
                                  0/{goal.target_exams}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              <Button 
                variant="outline" 
                className="w-full mt-4 border-2 hover:bg-accent transition-all rounded-xl h-12"
                onClick={() => setGoalDialogOpen(true)}
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Goal
              </Button>
            </CardContent>
          </Card>

          {/* Quick actions panel */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-2xl font-bold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Button 
                variant="outline" 
                className="w-full h-auto py-5 flex items-center gap-4 border-2 hover:bg-accent transition-all rounded-xl justify-start"
                onClick={() => navigate("/coach")}
              >
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-destructive" />
                </div>
                <span className="font-medium text-lg">Review Weak Topics</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-auto py-5 flex items-center gap-4 border-2 hover:bg-accent transition-all rounded-xl justify-start"
                onClick={() => navigate("/revision-plan")}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-lg">View Revision Plan</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Add New Revision Goal</DialogTitle>
            <DialogDescription>
              Set a goal to track your progress in a specific subject
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <SubjectSelector
              value={newGoal.subject}
              color={newGoal.subject_color}
              onValueChange={(subject) => setNewGoal({ ...newGoal, subject })}
              onColorChange={(color) => setNewGoal({ ...newGoal, subject_color: color })}
            />
            
            <div className="space-y-3">
              <Label htmlFor="target">Target Number of Exams</Label>
              <Input
                id="target"
                type="number"
                min="1"
                value={newGoal.target_exams}
                onChange={(e) => setNewGoal({ ...newGoal, target_exams: Math.max(1, parseInt(e.target.value) || 1) })}
                className="text-base"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="percentage">Target Percentage</Label>
              <Input
                id="percentage"
                type="number"
                min="0"
                max="100"
                placeholder="e.g., 85"
                value={newGoal.target_percentage || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setNewGoal({ 
                    ...newGoal, 
                    target_percentage: e.target.value ? Math.min(100, Math.max(0, val || 0)) : null 
                  });
                }}
                className="text-base"
              />
            </div>

            <div className="space-y-3">
              <Label>Deadline</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-base h-11",
                      !newGoal.deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    {newGoal.deadline ? format(newGoal.deadline, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background border-border z-[100]" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={newGoal.deadline || undefined}
                    onSelect={(date) => setNewGoal({ ...newGoal, deadline: date || null })}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={addGoal} 
              disabled={!newGoal.subject}
              style={{ backgroundColor: newGoal.subject_color }}
              className="text-white hover:opacity-90"
            >
              Add Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Dialog */}
      <Dialog open={editGoalDialogOpen} onOpenChange={setEditGoalDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Edit Revision Goal</DialogTitle>
            <DialogDescription>
              Update your goal details
            </DialogDescription>
          </DialogHeader>
          {editingGoal && (
            <div className="space-y-5 py-4">
              <SubjectSelector
                value={editingGoal.subject}
                color={editingGoal.subject_color}
                onValueChange={(subject) => setEditingGoal({ ...editingGoal, subject })}
                onColorChange={(color) => setEditingGoal({ ...editingGoal, subject_color: color })}
              />
              
              <div className="space-y-3">
                <Label htmlFor="edit-target">Target Number of Exams</Label>
                <Input
                  id="edit-target"
                  type="number"
                  min="1"
                  value={editingGoal.target_exams}
                  onChange={(e) => setEditingGoal({ ...editingGoal, target_exams: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="text-base"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="edit-percentage">Target Percentage</Label>
                <Input
                  id="edit-percentage"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g., 85"
                  value={editingGoal.target_percentage || ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setEditingGoal({ 
                      ...editingGoal, 
                      target_percentage: e.target.value ? Math.min(100, Math.max(0, val || 0)) : null 
                    });
                  }}
                  className="text-base"
                />
              </div>

              <div className="space-y-3">
                <Label>Deadline</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-base h-11",
                        !editingGoal.deadline && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-5 w-5" />
                      {editingGoal.deadline ? format(new Date(editingGoal.deadline), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background border-border z-[100]" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editingGoal.deadline ? new Date(editingGoal.deadline) : undefined}
                      onSelect={(date) => setEditingGoal({ ...editingGoal, deadline: date ? date.toISOString() : null })}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditGoalDialogOpen(false);
              setEditingGoal(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={updateGoal} 
              disabled={!editingGoal?.subject}
              style={{ backgroundColor: editingGoal?.subject_color }}
              className="text-white hover:opacity-90"
            >
              Update Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
