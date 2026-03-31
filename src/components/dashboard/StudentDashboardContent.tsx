import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, ChevronRight, Plus, Users, Megaphone, TrendingUp, AlertTriangle, CheckCircle2, Zap, BarChart2, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { ALL_LEVELS, detectRegionKey } from "@/lib/educational-levels";

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
  groupId: string;
  timeAgo: string;
  color: string;
}

const getGreetingByTime = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const StudentDashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const { studyActivityData } = useExamStats();
  const drilldown = useStatsDrilldown();
  const { subjects, getSubjectColor } = useUserSubjects();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userFirstName, setUserFirstName] = useState("");
  const [userInitials, setUserInitials] = useState("U");
  const [userLevelLabel, setUserLevelLabel] = useState<string | null>(null);
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
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      setUserId(uid ?? null);
      if (!uid) return;

      // Fetch profile for first/last name
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, display_name')
        .eq('id', uid)
        .maybeSingle();

      const firstName = profile?.first_name || '';
      const lastName = profile?.last_name || '';
      const fullName = firstName && lastName
        ? `${firstName} ${lastName}`
        : profile?.display_name || data.user?.user_metadata?.full_name || data.user?.email?.split('@')[0] || 'User';

      setUserName(fullName);
      const parts = fullName.split(' ');
      setUserFirstName(parts[0] || 'User');
      setUserInitials(
        parts.length >= 2
          ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
          : fullName.slice(0, 2).toUpperCase()
      );

      // Fetch curriculum region + derive educational level label
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('curriculum_region')
        .eq('user_id', uid)
        .maybeSingle();

      if (prefs?.curriculum_region) {
        const regionKey = detectRegionKey(prefs.curriculum_region);
        // Try to find an educational_tier from user's practice sets or exams
        const { data: setTiers } = await supabase
          .from('practice_question_sets')
          .select('educational_tier')
          .eq('user_id', uid)
          .not('educational_tier', 'is', null)
          .limit(1);

        const tierId = (setTiers?.[0]?.educational_tier) as string | undefined;
        const level = tierId ? ALL_LEVELS.find(l => l.id === tierId) : null;

        if (level && regionKey && level.aliases[regionKey]) {
          setUserLevelLabel(`${prefs.curriculum_region} · ${level.aliases[regionKey]}`);
        } else if (level) {
          setUserLevelLabel(`${prefs.curriculum_region} · ${level.label}`);
        } else {
          setUserLevelLabel(prefs.curriculum_region);
        }
      }
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

  const inProgressExams = useMemo(() => {
    return allExams.filter(e => e.submission?.status === 'in_progress' || (!e.submission && e.status === 'published'));
  }, [allExams]);

  const recentCompletedExams = useMemo(() => {
    return allExams
      .filter(e => 
        e.submission?.status === 'graded' || 
        e.submission?.status === 'submitted' || 
        e.submission?.status === 'completed'
      )
      .slice(0, 2)
      .map(e => ({
        ...e,
        score: e.submission && e.submission.total_marks > 0
          ? Math.round((e.submission.total_score / e.submission.total_marks) * 100)
          : null,
      }));
  }, [allExams]);

  const streakDisplay = currentStreak > 0 ? currentStreak.toString() : '—';

  const stats = [
    { label: "Exams", value: completedExamsCount.toString(), emoji: "📝", drilldown: 'exams' as DrilldownType },
    { label: "Avg Score", value: averageScore !== null ? `${averageScore}%` : "-", emoji: "🏆", drilldown: 'scores' as DrilldownType },
    { label: "Hours", value: totalStudyHours > 0 ? `${totalStudyHours.toFixed(0)}` : "0", emoji: "⏱", drilldown: 'study-hours' as DrilldownType },
    { label: "Streak", value: loading ? "..." : streakDisplay, emoji: "🔥", drilldown: 'streak' as DrilldownType },
  ];

  const scoreHistory = useMemo(() => {
    const gradedExams = allExams.filter(e => 
      e.submission?.status === 'graded' && e.submission.total_marks > 0
    );
    if (gradedExams.length === 0) return [];
    const byMonth: Record<string, { scores: number[]; color: string }> = {};
    gradedExams.forEach(e => {
      const month = new Date(e.created_at).toLocaleDateString('en-GB', { month: 'short' });
      const score = Math.round((e.submission!.total_score / e.submission!.total_marks) * 100);
      if (!byMonth[month]) byMonth[month] = { scores: [], color: getSubjectColor(e.subject_id) };
      byMonth[month].scores.push(score);
    });
    return Object.entries(byMonth).map(([month, data]) => ({
      month,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
      color: data.color,
    }));
  }, [allExams, getSubjectColor]);

  useEffect(() => {
    loadStudentData();
  }, []);

  const loadStudentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { data: streakData } = await supabase
          .from('user_streaks')
          .select('current_streak, last_exam_submitted_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (streakData?.last_exam_submitted_at) {
          const hoursSince = (Date.now() - new Date(streakData.last_exam_submitted_at).getTime()) / (1000 * 60 * 60);
          setCurrentStreak(hoursSince <= 48 ? streakData.current_streak : 0);
        }
      } catch {
        // user_streaks table may not exist — default to 0
        setCurrentStreak(0);
      }

      const { data: ownExams } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data: assignments } = await supabase
        .from("exam_assignments")
        .select(`exam_id, deadline, exams (*)`)
        .in("assignment_type", ["individual", "group", "class", "student", "all_students"])
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

      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, student_groups(id, name, tutor_id, subjects_covered)")
        .eq("student_id", user.id)
        .eq("is_active", true);

      if (memberships && memberships.length > 0) {
        const classInfos: ClassInfo[] = [];
        for (const m of memberships) {
          const group = m.student_groups as any;
          if (!group) continue;
          
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: 'exact', head: true })
            .eq("group_id", group.id)
            .eq("is_active", true);

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
            color: getSubjectColor(
              (Array.isArray(group.subjects_covered) && group.subjects_covered[0]?.name) || group.name
            ),
          });
        }
        setClasses(classInfos);

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
                groupId: a.group_id,
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
    if (exam.submission?.status === 'graded' || exam.submission?.status === 'completed' || exam.submission?.status === 'submitted') return 100;
    if (exam.submission?.status === 'in_progress') return 50;
    return 0;
  };

  const getPracticeStatus = (set: PracticeSetWithProgress) => {
    if (set.progress?.completed_at) return 'complete';
    if (set.progress?.questions_attempted && set.progress.questions_attempted > 0) return 'in_progress';
    return 'not_started';
  };

  // Mobile swipeable screens state (hooks must be before early returns)
  const [activeScreen, setActiveScreen] = useState(0);
  const SCREENS = ['Overview', 'My Work', 'Progress'];
  const swipeStartX = useRef(0);
  const handleSwipeStart = (e: React.TouchEvent) => { swipeStartX.current = e.touches[0].clientX; };
  const handleSwipeEnd = (e: React.TouchEvent) => {
    const delta = swipeStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 60) {
      if (delta > 0) setActiveScreen(prev => Math.min(prev + 1, 2));
      else setActiveScreen(prev => Math.max(prev - 1, 0));
    }
  };

  const [showSwipeHint, setShowSwipeHint] = useState(() => !localStorage.getItem('dashboardSwipeHintSeen'));
  useEffect(() => {
    if (showSwipeHint) {
      const timer = setTimeout(() => { setShowSwipeHint(false); localStorage.setItem('dashboardSwipeHintSeen', 'true'); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSwipeHint]);

  const greeting = getGreetingByTime();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ gridTemplateColumns: '1fr 1fr 320px' }}>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Shared modals
  const modals = (
    <>
      <AllExamsModal open={showAllExamsModal} onOpenChange={setShowAllExamsModal} exams={allExams} loading={false} getSubjectColor={getSubjectColor} />
      <JoinClassModal open={showJoinClassModal} onOpenChange={setShowJoinClassModal} onSuccess={() => loadStudentData()} />
      <StatsDrilldownDrawer
        type={drilldown.activeDrawer} onClose={drilldown.closeDrawer} loading={drilldown.loading}
        completedExams={drilldown.completedExams} averageScore={drilldown.averageScore}
        scoreBreakdown={drilldown.scoreBreakdown} excludedCount={drilldown.excludedCount}
        totalHours={drilldown.totalHours} studySessions={drilldown.studySessions}
        weeklyBreakdown={drilldown.weeklyBreakdown} streakData={drilldown.streakData}
        studyTimeRange={drilldown.studyTimeRange} onStudyTimeRangeChange={drilldown.handleStudyTimeRangeChange}
      />
    </>
  );

  return (
    <>
      {/* ========== MOBILE LAYOUT (below xl) ========== */}
      <div className="xl:hidden" style={{ minHeight: 'calc(100vh - 56px)' }}>
        {/* Screen indicator dots */}
        <div className="flex items-center justify-center gap-2 py-3">
          {SCREENS.map((screen, i) => (
            <button
              key={screen}
              onClick={() => setActiveScreen(i)}
              className="border-none p-0 cursor-pointer transition-all duration-300"
              style={{
                width: activeScreen === i ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: activeScreen === i ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              }}
              aria-label={screen}
            />
          ))}
        </div>

        {/* Swipeable container */}
        <div
          onTouchStart={handleSwipeStart}
          onTouchEnd={handleSwipeEnd}
          className="overflow-hidden"
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeScreen * 100}%)` }}
          >
            {/* SCREEN 0: Overview */}
            <div className="w-full flex-shrink-0 px-1 space-y-3">
              {/* Welcome + streak */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-lg font-bold text-foreground">{greeting}, {userFirstName}</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                {currentStreak > 0 && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <span className="text-sm">🔥</span>
                    <span className="text-xs font-bold text-primary">{currentStreak}</span>
                  </div>
                )}
              </div>

              {/* Stat chips */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Exams', value: completedExamsCount.toString() },
                  { label: 'Avg Score', value: averageScore !== null ? `${averageScore}%` : '—' },
                  { label: 'Hours', value: `${totalStudyHours > 0 ? totalStudyHours.toFixed(0) : '0'}h` },
                ].map(stat => (
                  <div key={stat.label} className="text-center py-3 rounded-xl bg-card border border-border/50">
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/upload')}
                  className="flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer"
                >
                  <Plus size={15} /> New Exam
                </button>
                <button
                  onClick={() => navigate('/create-practice-questions')}
                  className="flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-card border border-border text-foreground text-sm font-medium cursor-pointer"
                >
                  <Zap size={15} /> Practice
                </button>
              </div>

              {/* Weak topic nudge */}
              {weakTopics.length > 0 && (
                <button
                  onClick={() => navigate('/stats?tab=weak-topics')}
                  className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl bg-destructive/8 border border-destructive/20 cursor-pointer text-left"
                >
                  <span className="text-xs text-destructive font-medium">
                    ⚠ {weakTopics.length} weak topic{weakTopics.length > 1 ? 's' : ''} need attention
                  </span>
                  <ChevronRight size={14} className="text-destructive" />
                </button>
              )}

              {/* Recent announcements */}
              {announcements.length > 0 && (
                <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-border/50">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Announcements</span>
                  </div>
                  {announcements.slice(0, 2).map(ann => (
                    <div
                      key={ann.id}
                      onClick={() => navigate(`/my-classes?classId=${ann.groupId}`)}
                      className="px-3.5 py-2.5 border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <p className="text-xs font-medium text-foreground">{ann.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{ann.className}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SCREEN 1: My Work */}
            <div className="w-full flex-shrink-0 px-1 space-y-3">
              <h2 className="text-lg font-bold text-foreground px-0.5">My Work</h2>

              {/* In-progress exams */}
              <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/50">
                  <span className="text-sm font-semibold text-foreground">Mock Exams</span>
                  <button onClick={() => navigate('/my-exams')} className="text-xs text-primary bg-transparent border-none cursor-pointer">View all →</button>
                </div>
                {inProgressExams.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No exams in progress</p>
                ) : (
                  inProgressExams.slice(0, 4).map(exam => {
                    const progress = getExamProgress(exam);
                    return (
                      <div
                        key={exam.id}
                        onClick={() => navigate(exam.submission?.id ? `/exam/${exam.id}/in-progress` : `/exam/${exam.id}/preview`)}
                        className="px-3.5 py-3 border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-foreground truncate flex-1 mr-2">{exam.title}</span>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1" />
                      </div>
                    );
                  })
                )}
                {recentCompletedExams.length > 0 && (
                  <div className="px-3.5 py-2.5 bg-muted/20 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Recently completed</p>
                    {recentCompletedExams.map(exam => (
                      <div key={exam.id} onClick={() => navigate(`/exam/${exam.id}/review`)} className="flex justify-between items-center py-1 cursor-pointer">
                        <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{exam.title}</span>
                        {exam.score !== null && (
                          <span className={`text-[11px] font-semibold ${exam.score >= 70 ? 'text-success' : exam.score >= 50 ? 'text-warning' : 'text-destructive'}`}>
                            {exam.score}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Practice quizzes */}
              <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/50">
                  <span className="text-sm font-semibold text-foreground">Practice Quizzes</span>
                  <button onClick={() => navigate('/quizzes')} className="text-xs text-primary bg-transparent border-none cursor-pointer">View all →</button>
                </div>
                {practiceSets.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No practice quizzes yet</p>
                ) : (
                  practiceSets.slice(0, 4).map(set => {
                    const status = getPracticeStatus(set);
                    const attempted = set.progress?.questions_attempted || 0;
                    const progress = set.question_count > 0 ? Math.round((attempted / set.question_count) * 100) : 0;
                    return (
                      <div
                        key={set.id}
                        onClick={() => navigate(`/practice-set/${set.id}/preview`)}
                        className="px-3.5 py-3 border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-foreground truncate flex-1 mr-2">{set.set_name}</span>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {status === 'complete' ? '✓ Done' : `${progress}%`}
                          </span>
                        </div>
                        {status !== 'complete' && <Progress value={progress} className="h-1" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* SCREEN 2: Progress */}
            <div className="w-full flex-shrink-0 px-1 space-y-3">
              <h2 className="text-lg font-bold text-foreground px-0.5">My Progress</h2>

              {/* Progress carousel */}
              <ProgressCarousel
                weakTopics={weakTopics}
                subjects={subjects}
                getSubjectColor={getSubjectColor}
                studyActivityData={studyActivityData}
                scoreHistory={scoreHistory}
              />

              {/* My classes compact */}
              {classes.length > 0 && (
                <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-border/50">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">My Classes</span>
                  </div>
                  {classes.map(cls => (
                    <div
                      key={cls.id}
                      onClick={() => navigate(`/my-classes?classId=${cls.id}`)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{cls.name}</p>
                        <p className="text-[10px] text-muted-foreground">{cls.tutorName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Profile stats */}
              <div className="rounded-xl bg-card border border-border/50 p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-bold mx-auto mb-2">
                  {userInitials}
                </div>
                <p className="text-sm font-semibold text-foreground">{userName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{userLevelLabel || 'Set curriculum in Settings'}</p>
                <div className="grid grid-cols-4 gap-1.5 mt-3">
                  {stats.map((stat, i) => (
                    <button
                      key={i}
                      className="flex flex-col items-center p-1.5 rounded-lg bg-background/50 hover:bg-muted/50 transition-colors border-none cursor-pointer"
                      onClick={() => drilldown.openDrawer(stat.drilldown)}
                    >
                      <span className="text-sm">{stat.emoji}</span>
                      <span className="text-xs font-bold mt-0.5">{stat.value}</span>
                      <span className="text-[8px] text-muted-foreground">{stat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Swipe hint */}
        {showSwipeHint && (
          <p className="text-center text-[11px] text-muted-foreground/60 py-2 animate-pulse">
            Swipe left or right to navigate
          </p>
        )}

        {modals}
      </div>

      {/* ========== DESKTOP LAYOUT (xl and above) ========== */}
      <div className="hidden xl:block space-y-3 overflow-y-auto pb-10" style={{ minHeight: 'calc(100vh - 56px)' }}>
        {/* Welcome Banner */}
        <div className="px-1 py-1">
          <h1 className="text-xl font-bold text-foreground">
            Welcome back, {userName}!
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {greeting} — here's your study overview.
          </p>
        </div>

        {/* Quick-Start CTAs */}
        <div className="flex gap-2 flex-wrap px-1">
          {[
            { label: 'New Exam', icon: Plus, onClick: () => navigate('/upload'), primary: true },
            { label: 'Practice Quiz', icon: Zap, onClick: () => navigate('/create-practice-questions'), primary: false },
            { label: 'My Progress', icon: BarChart2, onClick: () => navigate('/stats'), primary: false },
          ].map(action => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                action.primary
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}
            >
              <action.icon size={13} />
              {action.label}
            </button>
          ))}
        </div>

        {/* 3-Column Dashboard Grid */}
        <div className="grid grid-cols-[1fr_1fr_300px] gap-3">
          
          {/* Column 1: Mock Exams */}
          <Card className="rounded-2xl border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle
                className="text-lg font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate("/my-exams")}
              >
                Mock Exams
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="link" size="sm" className="text-primary text-xs p-0 h-auto" onClick={() => navigate("/my-exams")}>View all</Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-dashed" onClick={() => navigate("/upload")}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {inProgressExams.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No exams in progress</p>
                  <Button variant="link" size="sm" onClick={() => navigate("/upload")} className="mt-1 text-primary">Create one →</Button>
                </div>
              ) : (
                inProgressExams.slice(0, 3).map(exam => {
                  const progress = getExamProgress(exam);
                  const color = getSubjectColor(exam.subject_id);
                  return (
                    <div key={exam.id} className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer bg-card/50 hover:bg-card"
                      onClick={() => navigate(exam.submission?.id ? `/exam/${exam.id}/in-progress` : `/exam/${exam.id}/preview`)}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{exam.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{exam.subject_id} · Started {getTimeAgo(exam.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={progress} className="h-1.5 flex-1" style={{ ['--progress-color' as any]: color }} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{progress}% done</span>
                      </div>
                    </div>
                  );
                })
              )}
              {recentCompletedExams.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Recently completed</p>
                  {recentCompletedExams.map(exam => (
                    <div key={exam.id} onClick={() => navigate(`/exam/${exam.id}/review`)} className="flex justify-between items-center py-1.5 cursor-pointer hover:text-foreground transition-colors">
                      <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{exam.title}</span>
                      {exam.score !== null && (
                        <span className={`text-[11px] font-semibold ${exam.score >= 70 ? 'text-success' : exam.score >= 50 ? 'text-warning' : 'text-destructive'}`}>{exam.score}%</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column 2: Practice Quizzes */}
          <Card className="rounded-2xl border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold cursor-pointer hover:text-primary transition-colors" onClick={() => navigate("/quizzes")}>Practice Quizzes</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="link" size="sm" className="text-primary text-xs p-0 h-auto" onClick={() => navigate("/quizzes")}>View all</Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-dashed" onClick={() => navigate("/create-practice-questions")}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {practiceSets.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No practice quizzes yet</p>
                  <Button variant="link" size="sm" onClick={() => navigate("/create-practice-questions")} className="mt-1 text-primary">Create one →</Button>
                </div>
              ) : (
                practiceSets.slice(0, 3).map(set => {
                  const status = getPracticeStatus(set);
                  const attempted = set.progress?.questions_attempted || 0;
                  const progress = set.question_count > 0 ? Math.round((attempted / set.question_count) * 100) : 0;
                  const color = getSubjectColor(set.subject_id);
                  return (
                    <div key={set.id} className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer bg-card/50 hover:bg-card"
                      onClick={() => navigate(`/practice-set/${set.id}/preview`)}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{set.set_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{set.question_count} questions · {set.subject_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {status === 'complete' ? (
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-success/20 text-success border-success/30 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Complete</Badge>
                            {set.progress?.questions_correct !== null && (
                              <span className="text-xs text-muted-foreground">✓ {set.progress?.questions_correct}/{set.question_count}</span>
                            )}
                          </div>
                        ) : status === 'in_progress' ? (
                          <div className="flex items-center gap-3 w-full">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{progress}% done</span>
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

          {/* Column 3: Unified Right Sidebar */}
          <div className="row-span-2 flex">
            <Card className="rounded-2xl border-border/50 overflow-hidden flex flex-col w-full">
              <div className="p-5 border-b border-border/50 text-center">
                <div className="relative inline-block mb-3">
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">{userInitials}</div>
                  <div className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-card" />
                </div>
                <p className="font-semibold text-sm">{userName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{userLevelLabel || 'Set your curriculum in Settings'}</p>
                <div className="grid grid-cols-4 gap-1.5 mt-4">
                  {stats.map((stat, i) => (
                    <button key={i} className="flex flex-col items-center p-2 rounded-lg bg-background/50 hover:bg-muted/50 transition-colors border-none cursor-pointer" onClick={() => drilldown.openDrawer(stat.drilldown)}>
                      <span className="text-base">{stat.emoji}</span>
                      <span className="text-sm font-bold mt-0.5">{stat.value}</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 border-b border-border/50">
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-3 font-semibold">My Classes</p>
                {classes.length === 0 ? (
                  <div className="text-center py-2">
                    <p className="text-xs text-muted-foreground mb-2 italic">No classes yet</p>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowJoinClassModal(true)}><Users className="w-3 h-3 mr-1" /> Join a Class</Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {classes.map(cls => (
                      <div key={cls.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/my-classes?classId=${cls.id}`)}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{cls.name}</p>
                          <p className="text-[10px] text-muted-foreground">{cls.tutorName} · {cls.studentCount} students</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 flex-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-3 font-semibold">Recent Announcements</p>
                {announcements.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No announcements</p>
                ) : (
                  <div className="space-y-1.5">
                    {announcements.slice(0, 3).map(ann => (
                      <div key={ann.id} className="p-2.5 rounded-lg bg-background/50 cursor-pointer border-l-2 border-primary/40 hover:border-primary hover:bg-muted/50 transition-all" onClick={() => navigate(`/my-classes?classId=${ann.groupId}`)}>
                        <p className="text-xs font-medium">{ann.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{ann.className} · {ann.timeAgo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Row 2: Progress Carousel */}
          <div className="xl:col-span-2">
            <ProgressCarousel weakTopics={weakTopics} subjects={subjects} getSubjectColor={getSubjectColor} studyActivityData={studyActivityData} scoreHistory={scoreHistory} />
          </div>
        </div>

        {modals}
      </div>
    </>
  );
};
