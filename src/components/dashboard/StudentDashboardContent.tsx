import { useWorkspaceSession } from "@/hooks/use-workspace-session";
import { RefreshableList } from "@/components/shared/RefreshableList";
import { LoadError } from "@/components/shared/ListFeedback";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { studentDashboardQuery, type PracticeSetWithProgress } from "@/lib/student-dashboard-query";
import { TrendingUp, ListChecks, Target } from "lucide-react";
import { ExamsCompletedIcon, AverageScoreIcon, StudyHoursIcon, DayStreakIcon } from "./DashboardStatIcons";
import { useExamStats } from "@/hooks/useExamStats";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useStatsDrilldown } from "@/hooks/useStatsDrilldown";
import { useIsMobile, useIsLaptop } from "@/hooks/use-mobile";
import { ExamWithSubmission } from "./ExamRowItem";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";
import { DashboardSkeleton } from "./DashboardSkeleton";
import MobileDashboard from "./mobile/MobileDashboard";


import ActivityPanel from "./ActivityPanel";
import ActivityAllModal from "./ActivityAllModal";
import SubjectDonut from "./SubjectDonut";
import StudentHomeLayout from "./StudentHomeLayout";
import { StatsDrilldownDrawer, type DrilldownType } from "./StatsDrilldownDrawer";
import type {
  ClassItem,
  MockExam,
  ProfileStat,
  Quiz,
  StudentProfile,
  Subject,
} from "./types";

interface DashboardContentProps {
  userEmail: string;
}

const MOTIFS: ClassItem["motif"][] = ["grid", "dots", "wave"];
const GLYPHS = [TrendingUp, ListChecks, Target];

const timeAgo = (dateStr: string): string => {
  const now = Date.now();
  const diffDays = Math.floor((now - new Date(dateStr).getTime()) / 86400000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  const w = Math.floor(diffDays / 7);
  if (w === 1) return "1 week ago";
  if (w < 5) return `${w} weeks ago`;
  const m = Math.floor(diffDays / 30);
  return m <= 1 ? "1 month ago" : `${m} months ago`;
};

export const StudentDashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const { ownerId, store } = useWorkspaceSession();
  const { studyActivityData, loading: studyLoading, error: studyError, refetch: retryStudy } = useExamStats();
  const { subjects: userSubjects, getSubjectColor } = useUserSubjects();
  const drilldown = useStatsDrilldown();
  const isMobile = useIsMobile();
  const isLaptop = useIsLaptop();

  const [showJoinClass, setShowJoinClass] = useState(false);
  const [activityModal, setActivityModal] = useState<{ open: boolean; tab: "exams" | "quizzes" }>({
    open: false,
    tab: "exams",
  });

  const { data: dash, isLoading: dashLoading, isError, refetch } = useQuery(studentDashboardQuery(ownerId, store?.generation));



  const userName = dash?.userName || "";
  const initials = dash?.initials || "U";
  const program = dash?.program || "";
  const currentStreak = dash?.currentStreak || 0;
  const allExams: ExamWithSubmission[] = useMemo(() => dash?.allExams || [], [dash]);
  const practiceSets: PracticeSetWithProgress[] = useMemo(() => dash?.practiceSets || [], [dash]);
  const announcements = dash?.announcements || [];

  const classes: ClassItem[] = useMemo(() => {
    if (!dash?.classesRaw) return [];
    return dash.classesRaw.map((g) => {
      const subjectTag =
        (Array.isArray(g.subjects_covered) && (g.subjects_covered as any)[0]?.name) || g.name;
      return {
        id: g.id,
        title: g.name,
        teacher: dash.tutorById.get(g.tutorId) || "Tutor",
        students: g.students,
        progress: 0,
        next: "No upcoming work",
        subjectTag,
        accentColor: getSubjectColor(subjectTag),
        motif: MOTIFS[g.index % MOTIFS.length],
        glyph: GLYPHS[g.index % GLYPHS.length],
      };
    });
  }, [dash, getSubjectColor]);

  

  // ── Derived data ──────────────────────────────────────────────────────────
  const totalStudyHours = useMemo(
    () =>
      studyActivityData.reduce((total, day) => {
        const dayTotal = Object.entries(day)
          .filter(([key]) => key !== "day")
          .reduce((sum, [, hrs]) => sum + (hrs as number), 0);
        return total + dayTotal;
      }, 0),
    [studyActivityData]
  );

  const completedExams = useMemo(
    () =>
      allExams.filter(
        (e) =>
          e.submission?.status === "graded" ||
          e.submission?.status === "submitted" ||
          e.submission?.status === "completed"
      ),
    [allExams]
  );

  const averageScore = useMemo(() => {
    const graded = allExams.filter(
      (e) => e.submission?.status === "graded" && e.submission.total_marks > 0
    );
    if (!graded.length) return null;
    const sum = graded.reduce(
      (a, e) => a + (e.submission!.total_score / e.submission!.total_marks) * 100,
      0
    );
    return Math.round(sum / graded.length);
  }, [allExams]);

  // exams.subject_id stores the subject NAME string in this app's schema.
  // Match against user_subjects.subject_name case-insensitively; fall back to the raw value.
  const subjectName = (idOrName: string) => {
    if (!idOrName) return "Subject";
    const found = userSubjects.find(
      (s) =>
        s.subject_name.toLowerCase() === idOrName.toLowerCase() ||
        s.id === idOrName ||
        (s.subject_id && s.subject_id === idOrName)
    );
    return found?.subject_name ?? idOrName;
  };

  const subjectIdentifiers = (idOrName: string): string[] => {
    const saved = userSubjects.find(subject => subject.subject_name.toLowerCase() === idOrName.toLowerCase() || subject.id === idOrName || subject.subject_id === idOrName);
    return [idOrName, saved?.subject_name, saved?.id, saved?.subject_id].filter((value): value is string => Boolean(value));
  };

  // Subject share of study time (from studyActivityData)
  const subjectsForDonut = useMemo<Subject[]>(() => {
    const hoursBySubject = new Map<string, number>();
    studyActivityData.forEach((day) => {
      Object.entries(day).forEach(([k, v]) => {
        if (k === "day") return;
        hoursBySubject.set(k, (hoursBySubject.get(k) || 0) + (v as number));
      });
    });
    const total = Array.from(hoursBySubject.values()).reduce((a, b) => a + b, 0);
    if (total === 0) {
      // Fallback: count exams per subject
      const byId = new Map<string, number>();
      allExams.forEach((e) => byId.set(e.subject_id, (byId.get(e.subject_id) || 0) + 1));
      const sum = Array.from(byId.values()).reduce((a, b) => a + b, 0);
      if (sum === 0) return [];
      return Array.from(byId.entries()).map(([id, n]) => ({
        key: id,
        identifiers: subjectIdentifiers(id),
        name: subjectName(id),
        color: getSubjectColor(id),
        pct: Math.round((n / sum) * 100),
      }));
    }
    return Array.from(hoursBySubject.entries()).map(([name, hrs]) => ({
      key: name,
      identifiers: subjectIdentifiers(name),
      name,
      color: getSubjectColor(name),
      pct: Math.round((hrs / total) * 100),
    }));
  }, [studyActivityData, allExams, getSubjectColor, userSubjects]);

  const profile: StudentProfile = {
    name: userName || userEmail.split("@")[0],
    initials,
    program: program || "Student",
  };

  const profileStats: ProfileStat[] = [
    {
      key: "exams",
      icon: ExamsCompletedIcon,
      value: completedExams.length.toString(),
      label: "Exams Completed",
      iconClass: "text-primary",
      onClick: () => drilldown.openDrawer("exams"),
    },
    {
      key: "avg",
      icon: AverageScoreIcon,
      value: averageScore !== null ? `${averageScore}%` : "—",
      label: "Average Score",
      iconClass: "text-warning",
      onClick: () => drilldown.openDrawer("scores"),
    },
    {
      key: "hours",
      icon: StudyHoursIcon,
      value: totalStudyHours > 0 ? `${totalStudyHours.toFixed(0)}h` : "0h",
      label: "Total Study Hours",
      iconClass: "text-info",
      onClick: () => drilldown.openDrawer("study-hours"),
    },
    {
      key: "streak",
      icon: DayStreakIcon,
      value: currentStreak > 0 ? currentStreak.toString() : "—",
      label: "Day Streak",
      iconClass: "text-danger",
      onClick: () => drilldown.openDrawer("streak"),
    },
  ];

  const mockExams: MockExam[] = useMemo(() => {
    return allExams.slice(0, 10).map((e) => {
      const subId = e.subject_id;
      const sName = subjectName(subId);
      const color = getSubjectColor(subId);
      let status: MockExam["status"] = "not-started";
      let score = 0;
      const s = e.submission;
      if (s?.status === "graded" && s.total_marks > 0) {
        status = "done";
        score = Math.round((s.total_score / s.total_marks) * 100);
      } else if (s?.status === "in_progress") {
        status = "in-progress";
        score = s.total_marks > 0 ? Math.round((s.total_score / s.total_marks) * 100) : 0;
      } else if (
        s?.status === "submitted" ||
        s?.status === "completed"
      ) {
        status = "done";
        score = s.total_marks > 0 ? Math.round((s.total_score / s.total_marks) * 100) : 0;
      }
      return {
        id: e.id,
        title: (e as any).title || "Exam",
        subject: sName,
        color,
        score,
        status,
        when: timeAgo(e.created_at),
      };
    });
  }, [allExams, userSubjects, getSubjectColor]);

  const quizzes: Quiz[] = useMemo(
    () =>
      practiceSets.map((s) => {
        const correct = s.progress?.questions_correct ?? 0;
        const attempted = s.progress?.questions_attempted ?? 0;
        const best = attempted > 0 ? Math.round((correct / attempted) * 100) : null;
        return {
          id: s.id,
          title: s.set_name,
          subject: subjectName(s.subject_id),
          color: getSubjectColor(s.subject_id),
          questions: s.question_count,
          best,
          when: s.progress?.completed_at ? timeAgo(s.progress.completed_at) : "new",
        };
      }),
    [practiceSets, userSubjects, getSubjectColor]
  );

  if (dashLoading && !dash) return <DashboardSkeleton />;

  const handleOpenExam = (id: string) => {
    const ex = allExams.find((e) => e.id === id);
    const s = ex?.submission?.status;
    if (s === "graded" || s === "submitted" || s === "completed") {
      navigate(`/exam/${id}/review`);
    } else {
      navigate(`/exam/${id}/in-progress`);
    }
  };
  const handleStartQuiz = (id: string) => {
    const set = practiceSets.find((p) => p.id === id);
    if (set?.progress?.completed_at) {
      navigate(`/practice-questions/${id}/preview`);
    } else {
      navigate(`/practice-questions/${id}/take`);
    }
  };

  const statsDrawer = <StatsDrilldownDrawer
    type={drilldown.activeDrawer}
    onClose={drilldown.closeDrawer}
    onNavigate={drilldown.openDrawer}
    error={drilldown.error}
    onRetry={drilldown.retry}
    loading={drilldown.loading}
    completedExams={drilldown.completedExams}
    scoreBreakdown={drilldown.scoreBreakdown}
    scores={drilldown.scores}
    scorePeriod={drilldown.scorePeriod}
    onScorePeriodChange={drilldown.setScorePeriod}
    excludedCount={drilldown.excludedCount}
    studySessions={drilldown.studySessions}
    streakData={drilldown.streakData}
    studyPeriod={drilldown.studyPeriod}
    onStudyPeriodChange={drilldown.setStudyPeriod}
    streakMonth={drilldown.streakMonth}
    onStreakMonthChange={drilldown.setStreakMonth}
  />;

  if (isMobile) {
    return (
      <>
      <RefreshableList onRefresh={() => refetch()}>
      {isError && <LoadError message="Couldn’t load your dashboard. Your existing content is kept below." onRetry={() => void refetch()} />}
      <MobileDashboard
        profile={profile}
        profileStats={profileStats}
        subjects={subjectsForDonut}
        averageScore={averageScore !== null ? `${averageScore}%` : "—"}
        classes={classes}
        mockExams={mockExams}
        quizzes={quizzes}
        announcements={announcements}
        homeSubjects={userSubjects.map(subject => ({ key: subject.id, name: subject.subject_name, color: subject.subject_color, board: subject.exam_board }))}
        onCreateExam={() => navigate("/upload")}
        onCreateQuiz={() => navigate("/create-practice-questions")}
        onJoinClass={() => setShowJoinClass(true)}
        onContinue={(id) => navigate(`/my-classes?classId=${id}`)}
        onOpenExam={handleOpenExam}
        onStartQuiz={handleStartQuiz}
        onOpenAnnouncement={() => navigate("/my-classes")}
        onViewSubjects={() => navigate('/my-subjects')}
        onOpenSubject={name => navigate(`/my-subjects/${encodeURIComponent(name)}`)}
        onViewClasses={() => navigate('/my-classes')}
        onViewPractice={kind => navigate(kind === 'quizzes' ? '/quizzes' : '/my-exams')}
      />
      </RefreshableList>
      {statsDrawer}
      </>
    );
  }

  const activityPanel = (
    <ActivityPanel
      mockExams={mockExams}
      quizzes={quizzes}
      onOpenExam={(id) => {
        const ex = allExams.find((e) => e.id === id);
        const s = ex?.submission?.status;
        if (s === "graded" || s === "submitted" || s === "completed") {
          navigate(`/exam/${id}/review`);
        } else {
          navigate(`/exam/${id}/in-progress`);
        }
      }}
      onStartQuiz={(id) => {
        const set = practiceSets.find((p) => p.id === id);
        if (set?.progress?.completed_at) {
          navigate(`/practice-questions/${id}/preview`);
        } else {
          navigate(`/practice-questions/${id}/take`);
        }
      }}
      onViewAll={(tab) => setActivityModal({ open: true, tab })}
    />
  );
  const statisticsPanel = (
    <SubjectDonut
      subjects={subjectsForDonut}
      loading={studyLoading}
      error={studyError ? "Couldn’t load your study statistics. Try again." : null}
      onRetry={() => { void retryStudy(); }}
      shareBasis={totalStudyHours > 0 ? "study_time" : "exam_count"}
      centerValue={averageScore !== null ? `${averageScore}%` : "—"}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <RefreshableList onRefresh={() => refetch()}>
    {isError && <LoadError message="Couldn’t load your dashboard. Your existing content is kept below." onRetry={() => void refetch()} />}
    <div className="font-sans">
      <StudentHomeLayout isLaptop={isLaptop} profile={profile} profileStats={profileStats}
        classes={classes} announcements={announcements} statistics={statisticsPanel} activity={activityPanel}
        onCreateExam={() => navigate("/upload")}
        onCreateQuiz={() => navigate("/create-practice-questions")}
        onContinue={(id) => navigate(`/my-classes?classId=${id}`)}
        onOpenAnnouncement={() => navigate("/my-classes")}
        onViewClasses={() => navigate("/my-classes")}
        onJoinClass={() => setShowJoinClass(true)} />

      <JoinClassModal
        open={showJoinClass}
        onOpenChange={setShowJoinClass}
        onSuccess={() => window.location.reload()}
      />

      <ActivityAllModal
        open={activityModal.open}
        onOpenChange={(open) => setActivityModal((s) => ({ ...s, open }))}
        initialTab={activityModal.tab}
        mockExams={mockExams}
        quizzes={quizzes}
        onOpenExam={(id) => {
          const ex = allExams.find((e) => e.id === id);
          const s = ex?.submission?.status;
          if (s === "graded" || s === "submitted" || s === "completed") {
            navigate(`/exam/${id}/review`);
          } else {
            navigate(`/exam/${id}/in-progress`);
          }
        }}
        onStartQuiz={(id) => {
          const set = practiceSets.find((p) => p.id === id);
          if (set?.progress?.completed_at) {
            navigate(`/practice-questions/${id}/preview`);
          } else {
            navigate(`/practice-questions/${id}/take`);
          }
        }}
      />

      {statsDrawer}
    </div>
    </RefreshableList>
  );
};
