import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, ChevronRight, Plus, Users, Megaphone, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useExamStats } from "@/hooks/useExamStats";
import { useStatsDrilldown } from "@/hooks/useStatsDrilldown";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useUnifiedTopicPerformance } from "@/hooks/useUnifiedTopicPerformance";
import { StatsDrilldownDrawer, DrilldownType } from "./StatsDrilldownDrawer";
import { ExamWithSubmission } from "./ExamRowItem";
import { AllExamsModal } from "./AllExamsModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";
import { ProgressCarousel } from "./ProgressCarousel";

interface DashboardContentProps {
  userEmail: string;
}

interface PracticeSetWithProgress {
  id: string;
  set_name: string;
  subject_id: string;
  question_count: number;
  status: string | null;
  progress?: {
    questions_attempted: number | null;
    completed_at: string | null;
    questions_correct: number | null;
  };
}

interface ClassInfo {
  id: string;
  name: string;
  tutorName: string;
  studentCount: number;
  color: string;
}

interface AnnouncementInfo {
  id: string;
  title: string;
  className: string;
  timeAgo: string;
  color: string;
}

export const StudentDashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const { studyActivityData } = useExamStats();
  const drilldown = useStatsDrilldown();
  const { subjects, getSubjectColor } = useUserSubjects();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("U");
  const [exams, setExams] = useState<ExamWithSubmission[]>([]);
  const [allExams, setAllExams] = useState<ExamWithSubmission[]>([]);
  const [practiceSets, setPracticeSets] = useState<PracticeSetWithProgress[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showAllExamsModal, setShowAllExamsModal] = useState(false);
  const [showJoinClassModal, setShowJoinClassModal] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      const email = data.user?.email || "";
      const meta = data.user?.user_metadata;
      const name = meta?.full_name || meta?.name || email.split("@")[0] || "User";
      setUserName(name);
      const parts = name.split(" ");
      setUserInitials(parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase());
    });
  }, []);

  const { weakTopics } = useUnifiedTopicPerformance(userId);

  const totalStudyHours = useMemo(() => {
    return studyActivityData.reduce((total, day) => {
      const dayTotal = Object.entries(day)
        .filter(([key]) => key !== 'day')
        .reduce((sum, [_, hours]) => sum + (hours as number), 0);
      return total + dayTotal;
    }, 0);
  }, [studyActivityData]);

  const completedExamsCount = useMemo(() => {
    return allExams.filter(e => 
      e.submission?.status === 'graded' || 
      e.submission?.status === 'submitted' || 
      e.submission?.status === 'completed'
    ).length;
  }, [allExams]);

  const averageScore = useMemo(() => {
    const gradedExams = allExams.filter(e => e.submission?.status === 'graded' && e.submission.total_marks > 0);
    if (gradedExams.length === 0) return null;
    const total = gradedExams.reduce((acc, e) => {
      const score = (e.submission!.total_score / e.submission!.total_marks) * 100;
      return acc + score;
    }, 0);
    return Math.round(total / gradedExams.length);
  }, [allExams]);

  // In-progress exams for the Mock Exams column
  const inProgressExams = useMemo(() => {
    return allExams.filter(e => e.submission?.status === 'in_progress' || (!e.submission && e.status === 'published'));
  }, [allExams]);

  // Recently completed/graded exams for the Recent Exams sidebar
  const recentCompletedExams = useMemo(() => {
    return allExams
      .filter(e => e.submission?.status === 'graded' || e.submission?.status === 'submitted' || e.submission?.status === 'completed')
      .slice(0, 4);
  }, [allExams]);

  const stats = [
    { label: "Exams", value: completedExamsCount.toString(), emoji: "📝", drilldown: 'exams' as DrilldownType },
    { label: "Avg Score", value: averageScore !== null ? `${averageScore}%` : "-", emoji: "🏆", drilldown: 'scores' as DrilldownType },
    { label: "Hours", value: totalStudyHours > 0 ? `${totalStudyHours.toFixed(0)}` : "0", emoji: "⏱", drilldown: 'study-hours' as DrilldownType },
    { label: "Streak", value: loading ? "..." : currentStreak.toString(), emoji: "🔥", drilldown: 'streak' as DrilldownType },
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

      // Load user's own exams
      const { data: ownExams } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Load assigned exams
      const { data: assignments } = await supabase
        .from("exam_assignments")
        .select(`exam_id, deadline, exams (*)`)
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

      const sortedExams = examsWithSubmissions
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAllExams(sortedExams);
      setExams(sortedExams.slice(0, 3));

      // Load practice sets with progress
      const { data: sets } = await supabase
        .from("practice_question_sets")
        .select("id, set_name, subject_id, question_count, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (sets && sets.length > 0) {
        const setsWithProgress = await Promise.all(
          sets.map(async (set) => {
            const { data: progress } = await supabase
              .from("practice_set_progress")
              .select("questions_attempted, completed_at, questions_correct")
              .eq("set_id", set.id)
              .eq("user_id", user.id)
              .maybeSingle();
            return { ...set, progress: progress || undefined };
          })
        );
        setPracticeSets(setsWithProgress);
      }

      // Load classes
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, student_groups(id, name, tutor_id, subject)")
        .eq("student_id", user.id)
        .eq("is_active", true);

      if (memberships && memberships.length > 0) {
        const classInfos: ClassInfo[] = [];
        for (const m of memberships) {
          const group = m.student_groups as any;
          if (!group) continue;
          
          // Get member count
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: 'exact', head: true })
            .eq("group_id", group.id)
            .eq("is_active", true);

          // Get tutor name
          const { data: tutorProfile } = await supabase
            .from("user_profiles")
            .select("display_name")
            .eq("id", group.tutor_id)
            .maybeSingle();

          classInfos.push({
            id: group.id,
            name: group.name,
            tutorName: tutorProfile?.display_name || "Tutor",
            studentCount: count || 0,
            color: getSubjectColor(group.subject || group.name),
          });
        }
        setClasses(classInfos);

        // Load announcements
        const groupIds = memberships.map(m => (m.student_groups as any)?.id).filter(Boolean);
        if (groupIds.length > 0) {
          const { data: anns } = await supabase
            .from("group_announcements")
            .select("id, title, created_at, group_id, student_groups(name)")
            .in("group_id", groupIds)
            .order("created_at", { ascending: false })
            .limit(3);

          if (anns) {
            setAnnouncements(anns.map(a => {
              const now = new Date();
              const created = new Date(a.created_at);
              const diffMs = now.getTime() - created.getTime();
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              const timeAgo = diffDays > 0 ? `${diffDays} day${diffDays > 1 ? 's' : ''} ago` 
                : diffHours > 0 ? `${diffHours} hour${diffHours > 1 ? 's' : ''} ago` 
                : 'Just now';

              return {
                id: a.id,
                title: a.title,
                className: (a.student_groups as any)?.name || "Class",
                timeAgo,
                color: getSubjectColor((a.student_groups as any)?.name || ""),
              };
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks === 1) return "1 week ago";
    return `${diffWeeks} weeks ago`;
  };

  const getExamProgress = (exam: ExamWithSubmission) => {
    // Simplified: if in progress, show partial; if completed, 100%
    if (exam.submission?.status === 'graded' || exam.submission?.status === 'completed' || exam.submission?.status === 'submitted') return 100;
    if (exam.submission?.status === 'in_progress') return 50; // placeholder
    return 0;
  };

  const getPracticeStatus = (set: PracticeSetWithProgress) => {
    if (set.progress?.completed_at) return 'complete';
    if (set.progress?.questions_attempted && set.progress.questions_attempted > 0) return 'in_progress';
    return 'not_started';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ gridTemplateColumns: '1fr 1fr 320px' }}>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 3-Column Dashboard Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_320px] gap-4">
        
        {/* Column 1: Mock Exams */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">Mock Exams</CardTitle>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-dashed"
              onClick={() => navigate("/upload")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {inProgressExams.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No exams in progress</p>
                <Button variant="link" size="sm" onClick={() => navigate("/upload")} className="mt-1 text-primary">
                  Create one →
                </Button>
              </div>
            ) : (
              inProgressExams.slice(0, 3).map(exam => {
                const progress = getExamProgress(exam);
                const color = getSubjectColor(exam.subject_id);
                return (
                  <div
                    key={exam.id}
                    className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer bg-card/50 hover:bg-card"
                    onClick={() => navigate(exam.submission?.id ? `/exam/${exam.id}/in-progress` : `/exam/${exam.id}/preview`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{exam.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {exam.subject_id} · Started {getTimeAgo(exam.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={progress} className="h-1.5 flex-1" style={{ ['--progress-color' as any]: color }} />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {progress}% done
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Column 2: Practice Quizzes */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">Practice Quizzes</CardTitle>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-dashed"
              onClick={() => navigate("/create-practice-questions")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {practiceSets.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No practice quizzes yet</p>
                <Button variant="link" size="sm" onClick={() => navigate("/create-practice-questions")} className="mt-1 text-primary">
                  Create one →
                </Button>
              </div>
            ) : (
              practiceSets.slice(0, 3).map(set => {
                const status = getPracticeStatus(set);
                const attempted = set.progress?.questions_attempted || 0;
                const progress = set.question_count > 0 ? Math.round((attempted / set.question_count) * 100) : 0;
                const color = getSubjectColor(set.subject_id);
                
                return (
                  <div
                    key={set.id}
                    className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer bg-card/50 hover:bg-card"
                    onClick={() => navigate(`/practice-set/${set.id}/preview`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{set.set_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {set.question_count} questions · {set.subject_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      {status === 'complete' ? (
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-success/20 text-success border-success/30 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Complete
                          </Badge>
                          {set.progress?.questions_correct !== null && (
                            <span className="text-xs text-muted-foreground">
                              ✓ {set.progress?.questions_correct}/{set.question_count}
                            </span>
                          )}
                        </div>
                      ) : status === 'in_progress' ? (
                        <div className="flex items-center gap-3 w-full">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {progress}% done
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not started</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Column 3: Right Sidebar (spans 2 rows) */}
        <div className="row-span-2 space-y-4">
          {/* Recent Exams */}
          <Card className="rounded-2xl border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold">Recent Exams</CardTitle>
              {allExams.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-primary text-xs p-0 h-auto"
                  onClick={() => setShowAllExamsModal(true)}
                >
                  View all →
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {recentCompletedExams.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No completed exams yet</p>
              ) : (
                recentCompletedExams.map(exam => {
                  const score = exam.submission && exam.submission.total_marks > 0
                    ? Math.round((exam.submission.total_score / exam.submission.total_marks) * 100)
                    : null;
                  const color = getSubjectColor(exam.subject_id);
                  return (
                    <div
                      key={exam.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/exam/${exam.id}/review`)}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <FileText className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{exam.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted · {getTimeAgo(exam.submission?.last_accessed_at || exam.created_at)}
                        </p>
                      </div>
                      {score !== null && (
                        <Badge
                          className="text-xs font-bold shrink-0"
                          style={{
                            backgroundColor: score >= 70 ? 'hsl(var(--success) / 0.15)' : score >= 50 ? 'hsl(var(--warning) / 0.15)' : 'hsl(var(--destructive) / 0.15)',
                            color: score >= 70 ? 'hsl(var(--success))' : score >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
                            border: 'none',
                          }}
                        >
                          {score}%
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Profile Card */}
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="relative mb-2">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                    {userInitials}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success border-2 border-card" />
                </div>
                <p className="font-bold text-base">{userName}</p>
                <p className="text-xs text-muted-foreground">UK A-Level / GCSE</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {stats.map((stat, i) => (
                  <button
                    key={i}
                    className="flex flex-col items-center p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    onClick={() => drilldown.openDrawer(stat.drilldown)}
                  >
                    <span className="text-lg">{stat.emoji}</span>
                    <span className="text-sm font-bold">{stat.value}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* My Classes */}
          <Card className="rounded-2xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">My Classes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {classes.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-xs text-muted-foreground mb-2">No classes yet</p>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowJoinClassModal(true)}>
                    <Users className="w-3 h-3 mr-1" /> Join a Class
                  </Button>
                </div>
              ) : (
                classes.map(cls => (
                  <div
                    key={cls.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate("/my-classes")}
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{cls.name}</p>
                      <p className="text-xs text-muted-foreground">{cls.tutorName} · {cls.studentCount} students</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Announcements */}
          {announcements.length > 0 && (
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Announcements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {announcements.map(ann => (
                  <div
                    key={ann.id}
                    className="p-2.5 rounded-lg border-l-3 hover:bg-muted/50 transition-colors"
                    style={{ borderLeftColor: ann.color, borderLeftWidth: 3 }}
                  >
                    <p className="text-sm font-medium text-primary">{ann.title}</p>
                    <p className="text-xs text-muted-foreground">{ann.className} · {ann.timeAgo}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Row 2: Progress Carousel — spans first 2 columns */}
        <div className="xl:col-span-2">
          <ProgressCarousel
            weakTopics={weakTopics}
            subjects={subjects}
            getSubjectColor={getSubjectColor}
            studyActivityData={studyActivityData}
          />
        </div>
      </div>

      {/* Modals */}
      <AllExamsModal
        open={showAllExamsModal}
        onOpenChange={setShowAllExamsModal}
        exams={allExams}
        loading={false}
        getSubjectColor={getSubjectColor}
      />

      <JoinClassModal
        open={showJoinClassModal}
        onOpenChange={setShowJoinClassModal}
        onSuccess={() => loadStudentData()}
      />

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
