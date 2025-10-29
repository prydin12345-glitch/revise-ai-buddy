import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, TrendingUp, Clock, Trophy, Flame, CheckSquare, Calendar, MessageSquare, RotateCcw, Plus, Heart, ClipboardList, MoreVertical, Play, Eye, Trash2, Edit, Filter, CheckCircle2 } from "lucide-react";
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
}

export const DashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const userName = userEmail.split("@")[0];
  
  const [exams, setExams] = useState<ExamWithSubmission[]>([]);
  const [filteredExams, setFilteredExams] = useState<ExamWithSubmission[]>([]);
  const [revisionGoals, setRevisionGoals] = useState<RevisionGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBy, setFilterBy] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    subject: "",
    target_exams: 10,
    target_percentage: null as number | null,
    deadline: "",
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
          const { count } = await supabase
            .from("exams")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("subject_id", goal.subject)
            .not("id", "in", `(SELECT exam_id FROM exam_submissions WHERE student_id = '${user.id}')`);

          const { data: submissions } = await supabase
            .from("exam_submissions")
            .select("exam_id")
            .eq("student_id", user.id)
            .in("exam_id", 
              await supabase
                .from("exams")
                .select("id")
                .eq("user_id", user.id)
                .eq("subject_id", goal.subject)
                .then(res => res.data?.map(e => e.id) || [])
            );

          return {
            ...goal,
            progress: submissions?.length || 0,
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

  const getMotivationalMessage = (exam: ExamWithSubmission) => {
    if (!exam.submission) {
      return `You're halfway through ${exam.title} — keep going!`;
    }
    
    const score = (exam.submission.total_score / exam.submission.total_marks) * 100;
    if (score >= 85) {
      return `Excellent work on ${exam.title}! Outstanding performance! 🌟`;
    } else if (score >= 70) {
      return `Nice work on ${exam.title} — you're doing great!`;
    } else if (score >= 50) {
      return `Good effort on ${exam.title} — let's aim higher next time!`;
    } else {
      return `Keep practicing ${exam.title} — you'll get there! 💪`;
    }
  };

  const getStatusConfig = (isCompleted: boolean) => {
    if (isCompleted) {
      return {
        label: "Completed",
        icon: CheckCircle2,
        cardBgClass: "bg-success/10",
        textClass: "text-white",
        dotColor: "bg-success",
        iconColor: "text-success",
      };
    }
    return {
      label: "In Progress",
      icon: Clock,
      cardBgClass: "bg-warning/10",
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
          deadline: newGoal.deadline || null,
        });

      if (error) throw error;

      toast.success("Goal added successfully");
      setGoalDialogOpen(false);
      setNewGoal({
        subject: "",
        target_exams: 10,
        target_percentage: null,
        deadline: "",
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

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        {/* Left: Main Content */}
        <div className="space-y-8">
          {/* Welcome header */}
          <div className="space-y-3">
            <h1 className="text-5xl font-bold tracking-tight text-foreground">
              Welcome back, {userName}
            </h1>
            <p className="text-xl text-muted-foreground">
              Ready to ace your exams? Let's make today count!
            </p>
          </div>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-16 text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
              onClick={() => navigate("/upload")}
            >
              <Upload className="w-5 h-5 mr-3" />
              Upload Exam Paper
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-16 text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
              onClick={() => navigate("/exams/new")}
            >
              <FileText className="w-5 h-5 mr-3" />
              Start Blank Mock Exam
            </Button>
          </div>

          {/* Recent exams section */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center justify-between text-2xl font-bold">
                <span>Recents</span>
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
                        className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 border border-border rounded-xl ${statusConfig.cardBgClass}`}
                      >
                        {/* Status Indicator at Top Center */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                          <span className={`text-[14px] font-medium ${statusConfig.textClass}`}>
                            {statusConfig.label}
                          </span>
                          <div className={`h-2.5 w-2.5 rounded-full ${statusConfig.dotColor} shadow-lg animate-pulse`} />
                        </div>

                        <CardContent className="p-6 pt-12 space-y-4">
                          {/* Header Row: Title + Actions */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-3">
                              <h3 className="text-[17px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                {exam.title}
                              </h3>
                              
                              {/* Subject Badge */}
                              <Badge 
                                variant="outline" 
                                className="border-primary/30 bg-primary/5 text-primary text-[13px] font-medium px-2.5 py-0.5"
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
                          <div className="flex items-center justify-between pt-4 border-t-2 border-border/60">
                            <div className="flex items-center gap-6 text-[13px]">
                              {score !== null && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <TrendingUp className="h-3.5 w-3.5" />
                                  <span className="text-[15px] font-semibold text-foreground">
                                    {score}%
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                {new Date(exam.created_at).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Motivational Message */}
                          {getMotivationalMessage(exam) && (
                            <p className="text-[13px] text-muted-foreground italic leading-relaxed">
                              {getMotivationalMessage(exam)}
                            </p>
                          )}
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
          <div className="flex flex-wrap items-center gap-3 justify-end">
            {stats.map((stat, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-3xl">{stat.emoji}</span>
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
              </div>
            ))}
            <Button 
              variant="ghost" 
              size="sm"
              className="text-muted-foreground hover:text-foreground hover:bg-accent transition-all text-sm"
              onClick={() => navigate("/stats")}
            >
              View More Stats
            </Button>
          </div>

          {/* Revision goals panel */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                <Trophy className="w-6 h-6 text-primary" />
                Revision Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {revisionGoals.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No goals yet. Create your first goal!</p>
                </div>
              ) : (
                revisionGoals.map((goal) => (
                  <div key={goal.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground font-medium text-lg">{goal.subject}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground font-medium">
                          {goal.progress} / {goal.target_exams}
                        </span>
                        <span className="text-4xl">
                          {goal.progress >= goal.target_exams ? "🏆" : "📦"}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => deleteGoal(goal.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Goal
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          goal.progress >= goal.target_exams 
                            ? "bg-secondary" 
                            : "bg-primary"
                        }`}
                        style={{ width: `${Math.min((goal.progress / goal.target_exams) * 100, 100)}%` }}
                      />
                    </div>
                    {goal.target_percentage && (
                      <p className="text-sm text-muted-foreground">
                        Target: {goal.target_percentage}% average
                      </p>
                    )}
                    {goal.deadline && (
                      <p className="text-sm text-muted-foreground">
                        Deadline: {new Date(goal.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))
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
                onClick={() => navigate("/goals")}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-lg">View Revision Plan</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Revision Goal</DialogTitle>
            <DialogDescription>
              Set a goal to track your progress in a specific subject
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g., Mathematics, Biology"
                value={newGoal.subject}
                onChange={(e) => setNewGoal({ ...newGoal, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Target Number of Exams</Label>
              <Input
                id="target"
                type="number"
                min="1"
                value={newGoal.target_exams}
                onChange={(e) => setNewGoal({ ...newGoal, target_exams: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="percentage">Target Percentage (Optional)</Label>
              <Input
                id="percentage"
                type="number"
                min="0"
                max="100"
                placeholder="e.g., 85"
                value={newGoal.target_percentage || ""}
                onChange={(e) => setNewGoal({ ...newGoal, target_percentage: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (Optional)</Label>
              <Input
                id="deadline"
                type="date"
                value={newGoal.deadline}
                onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addGoal} disabled={!newGoal.subject}>
              Add Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
