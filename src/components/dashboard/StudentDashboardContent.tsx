import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trophy, Users, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useExamStats } from "@/hooks/useExamStats";
import { useStatsDrilldown } from "@/hooks/useStatsDrilldown";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useUnifiedTopicPerformance } from "@/hooks/useUnifiedTopicPerformance";
import { AnnouncementsFeed } from "./AnnouncementsFeed";
import { StatsDrilldownDrawer, DrilldownType } from "./StatsDrilldownDrawer";
import { ExamRowItem, ExamWithSubmission } from "./ExamRowItem";
import { AllExamsModal } from "./AllExamsModal";
import { WeakTopicNudge } from "./WeakTopicNudge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamRowItem, ExamWithSubmission } from "./ExamRowItem";
import { AllExamsModal } from "./AllExamsModal";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardContentProps {
  userEmail: string;
}

export const StudentDashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const { studyActivityData } = useExamStats();
  const drilldown = useStatsDrilldown();
  const { getSubjectColor } = useUserSubjects();
  
  const [exams, setExams] = useState<ExamWithSubmission[]>([]);
  const [allExams, setAllExams] = useState<ExamWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showAllExamsModal, setShowAllExamsModal] = useState(false);

  const totalStudyHours = useMemo(() => {
    return studyActivityData.reduce((total, day) => {
      const dayTotal = Object.entries(day)
        .filter(([key]) => key !== 'day')
        .reduce((sum, [_, hours]) => sum + (hours as number), 0);
      return total + dayTotal;
    }, 0);
  }, [studyActivityData]);

  // Count completed exams (submitted, completed, or graded status)
  const completedExamsCount = useMemo(() => {
    return allExams.filter(e => 
      e.submission?.status === 'graded' || 
      e.submission?.status === 'submitted' || 
      e.submission?.status === 'completed'
    ).length;
  }, [allExams]);

  // Calculate average score from released/graded exams only
  const averageScore = useMemo(() => {
    const gradedExams = allExams.filter(e => e.submission?.status === 'graded' && e.submission.total_marks > 0);
    if (gradedExams.length === 0) return null;
    
    const total = gradedExams.reduce((acc, e) => {
      const score = (e.submission!.total_score / e.submission!.total_marks) * 100;
      return acc + score;
    }, 0);
    
    return Math.round(total / gradedExams.length);
  }, [allExams]);

  const stats = [
    { 
      label: "Exams Taken", 
      value: completedExamsCount.toString(), 
      emoji: "📄",
      drilldown: 'exams' as DrilldownType,
    },
    { 
      label: "Average Score", 
      value: averageScore !== null ? `${averageScore}%` : "-", 
      emoji: "📊",
      drilldown: 'scores' as DrilldownType,
    },
    { 
      label: "Study Hours", 
      value: studyActivityData.length === 0 ? "..." : (totalStudyHours > 0 ? `${totalStudyHours.toFixed(1)}h` : "0h"), 
      emoji: "⏰",
      drilldown: 'study-hours' as DrilldownType,
    },
    { 
      label: "Day Streak", 
      value: loading ? "..." : currentStreak.toString(), 
      emoji: "🔥",
      drilldown: 'streak' as DrilldownType,
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
        setCurrentStreak(hoursSince <= 48 ? streakData.current_streak : 0);
      }

      // Load user's own exams (no limit for all exams)
      const { data: ownExams } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

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
        .order("created_at", { ascending: false });

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
            .select("id, total_score, total_marks, status, last_accessed_at")
            .eq("exam_id", exam.id)
            .eq("student_id", user.id)
            .maybeSingle();

          return {
            ...exam,
            submission: submission ? {
              ...submission,
              status: submission.status as 'in_progress' | 'submitted' | 'graded' | 'completed'
            } : undefined,
          };
        })
      );

      // Sort by most recent
      const sortedExams = examsWithSubmissions
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Store all exams for the modal
      setAllExams(sortedExams);
      // Only show top 3 on dashboard
      setExams(sortedExams.slice(0, 3));
    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Loading skeleton for primary actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Skeleton className="flex-1 h-14 sm:h-16 rounded-xl" />
          <Skeleton className="flex-1 h-14 sm:h-16 rounded-xl" />
        </div>
        
        {/* Loading skeleton for stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>

        {/* Loading skeleton for recent exams */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader className="border-b border-border">
            <Skeleton className="h-8 w-40" />
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </CardContent>
        </Card>
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
          onClick={() => navigate("/create-practice-questions")}
        >
          <FileText className="w-5 h-5 mr-2 sm:mr-3" />
          Create Practice Questions
        </Button>
      </div>

      {/* Stats Grid - Now Clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card 
            key={index} 
            className="shadow-lg rounded-2xl hover:shadow-xl transition-all cursor-pointer hover:border-primary/50 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-primary"
            tabIndex={0}
            role="button"
            aria-label={`View ${stat.label} details`}
            onClick={() => drilldown.openDrawer(stat.drilldown)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                drilldown.openDrawer(stat.drilldown);
              }
            }}
          >
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-lg rounded-2xl hover:shadow-xl transition-all cursor-pointer hover:border-primary/50" onClick={() => navigate("/stats")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">My Progress</h3>
              <p className="text-sm text-muted-foreground">View your performance</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl hover:shadow-xl transition-all cursor-pointer hover:border-primary/50" onClick={() => navigate("/quizzes")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-info" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Practice Quizzes</h3>
              <p className="text-sm text-muted-foreground">Test your knowledge</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl hover:shadow-xl transition-all cursor-pointer hover:border-primary/50" onClick={() => navigate("/my-classes")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">My Classes</h3>
              <p className="text-sm text-muted-foreground">Join tutor groups</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements Feed */}
      <AnnouncementsFeed />

      {/* Recent Exams - Top 3 Only */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="flex items-center justify-between">
            <span className="text-xl font-bold">Recent Exams</span>
            {allExams.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground gap-1"
                onClick={() => setShowAllExamsModal(true)}
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {exams.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground mb-1">No exams yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create one or start a practice set to get started.</p>
              <Button onClick={() => navigate("/upload")}>
                Create Your First Exam
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <ExamRowItem 
                  key={exam.id} 
                  exam={exam}
                  subjectColor={getSubjectColor(exam.subject_id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Exams Modal */}
      <AllExamsModal
        open={showAllExamsModal}
        onOpenChange={setShowAllExamsModal}
        exams={allExams}
        loading={false}
        getSubjectColor={getSubjectColor}
      />

      {/* Stats Drilldown Drawer */}
      <StatsDrilldownDrawer
        type={drilldown.activeDrawer}
        onClose={drilldown.closeDrawer}
        loading={drilldown.loading}
        completedExams={drilldown.completedExams}
        averageScore={drilldown.averageScore}
        scoreBreakdown={drilldown.scoreBreakdown}
        excludedCount={drilldown.excludedCount}
        totalHours={drilldown.totalHours}
        studySessions={drilldown.studySessions}
        weeklyBreakdown={drilldown.weeklyBreakdown}
        streakData={drilldown.streakData}
        studyTimeRange={drilldown.studyTimeRange}
        onStudyTimeRangeChange={drilldown.handleStudyTimeRangeChange}
      />
    </div>
  );
};
