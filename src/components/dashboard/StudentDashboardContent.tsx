import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Clock, Trophy, Flame, Target, Eye, Play, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useExamStats } from "@/hooks/useExamStats";

interface DashboardContentProps {
  userEmail: string;
}

interface ExamWithSubmission {
  id: string;
  title: string;
  subject_id: string;
  status: string;
  created_at: string;
  assigned_by?: string;
  deadline?: string;
  submission?: {
    total_score: number;
    total_marks: number;
    status: 'in_progress' | 'submitted' | 'graded';
  };
}

export const StudentDashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const { studyActivityData } = useExamStats();
  
  const [exams, setExams] = useState<ExamWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);

  const totalStudyHours = useMemo(() => {
    return studyActivityData.reduce((total, day) => {
      const dayTotal = Object.entries(day)
        .filter(([key]) => key !== 'day')
        .reduce((sum, [_, hours]) => sum + (hours as number), 0);
      return total + dayTotal;
    }, 0);
  }, [studyActivityData]);

  const stats = [
    { 
      label: "Exams Taken", 
      value: exams.filter(e => e.submission?.status === 'graded').length.toString(), 
      emoji: "📄" 
    },
    { 
      label: "Average Score", 
      value: exams.filter(e => e.submission?.status === 'graded').length > 0 
        ? `${Math.round(exams.filter(e => e.submission?.status === 'graded').reduce((acc, e) => {
            const score = (e.submission!.total_score / e.submission!.total_marks) * 100;
            return acc + score;
          }, 0) / exams.filter(e => e.submission?.status === 'graded').length)}%`
        : "-", 
      emoji: "📊" 
    },
    { 
      label: "Study Hours", 
      value: studyActivityData.length === 0 ? "..." : (totalStudyHours > 0 ? `${totalStudyHours.toFixed(1)}h` : "0h"), 
      emoji: "⏰" 
    },
    { 
      label: "Day Streak", 
      value: loading ? "..." : currentStreak.toString(), 
      emoji: "🔥" 
    },
  ];

  useEffect(() => {
    loadStudentData();
  }, []);

  const loadStudentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user streak
      const { data: streakData } = await supabase
        .from('user_streaks')
        .select('current_streak, last_exam_submitted_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (streakData?.last_exam_submitted_at) {
        const hoursSince = (Date.now() - new Date(streakData.last_exam_submitted_at).getTime()) / (1000 * 60 * 60);
        setCurrentStreak(hoursSince <= 24 ? streakData.current_streak : 0);
      }

      // Load user's own exams and assigned exams
      const { data: ownExams } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);

      // Load assigned exams
      const { data: assignments } = await supabase
        .from("exam_assignments")
        .select(`
          exam_id,
          deadline,
          exams (*)
        `)
        .eq("assignment_type", "all_students")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      const assignedExams = assignments?.map(a => ({
        ...(a.exams as any),
        assigned_by: "teacher",
        deadline: a.deadline
      })) || [];

      const examsData = [...(ownExams || []), ...assignedExams];

      const examsWithSubmissions = await Promise.all(
        (examsData || []).map(async (exam) => {
          const { data: submission } = await supabase
            .from("exam_submissions")
            .select("total_score, total_marks, status")
            .eq("exam_id", exam.id)
            .eq("student_id", user.id)
            .maybeSingle();

          return {
            ...exam,
            submission: submission ? {
              ...submission,
              status: submission.status as 'in_progress' | 'submitted' | 'graded'
            } : undefined,
          };
        })
      );

      setExams(examsWithSubmissions);
    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Primary Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Button 
          size="lg" 
          variant="outline"
          className="flex-1 h-14 sm:h-16 text-base sm:text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
          onClick={() => navigate("/upload")}
        >
          <Upload className="w-5 h-5 mr-2 sm:mr-3" />
          Create Mock Exam
        </Button>
        <Button 
          size="lg" 
          variant="outline"
          className="flex-1 h-14 sm:h-16 text-base sm:text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
          onClick={() => navigate("/practice-questions/new")}
        >
          <FileText className="w-5 h-5 mr-2 sm:mr-3" />
          Create Practice Questions
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-lg rounded-2xl hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <span className="text-3xl">{stat.emoji}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-lg rounded-2xl hover:shadow-xl transition-all cursor-pointer hover:border-primary/50" onClick={() => navigate("/revision-plan")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Revision Plan</h3>
              <p className="text-sm text-muted-foreground">Manage your study schedule</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl hover:shadow-xl transition-all cursor-pointer hover:border-primary/50" onClick={() => navigate("/stats")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">My Progress</h3>
              <p className="text-sm text-muted-foreground">View your performance</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl hover:shadow-xl transition-all cursor-pointer hover:border-primary/50" onClick={() => navigate("/quizzes")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Practice Quizzes</h3>
              <p className="text-sm text-muted-foreground">Test your knowledge</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl hover:shadow-xl transition-all cursor-pointer hover:border-blue-500/50" onClick={() => navigate("/my-classes")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">My Classes</h3>
              <p className="text-sm text-muted-foreground">Join tutor groups</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Exams */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between text-2xl font-bold">
            <span>Recent Exams</span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/my-exams")}>
              View All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {exams.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No exams yet</p>
              <Button className="mt-4" onClick={() => navigate("/upload")}>
                Create Your First Exam
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => {
                const isCompleted = exam.submission?.status === 'graded';
                return (
                  <div
                    key={exam.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{exam.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{exam.subject_id}</Badge>
                        {exam.assigned_by && (
                          <Badge variant="secondary">Assigned by Teacher</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {new Date(exam.created_at).toLocaleDateString()}
                        </span>
                        {exam.deadline && (
                          <Badge variant="destructive">
                            Due: {new Date(exam.deadline).toLocaleDateString()}
                          </Badge>
                        )}
                        {isCompleted && exam.submission && (
                          <Badge variant="default">
                            Score: {Math.round((exam.submission.total_score / exam.submission.total_marks) * 100)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isCompleted ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/exam/${exam.id}/review`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/exam/${exam.id}/take`)}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          {exam.submission ? 'Continue' : 'Start'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
