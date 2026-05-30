import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Trophy, Clock, Flame, TrendingUp, ListChecks, Target } from "lucide-react";
import { useExamStats } from "@/hooks/useExamStats";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useStatsDrilldown } from "@/hooks/useStatsDrilldown";
import { ExamWithSubmission } from "./ExamRowItem";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";
import { DashboardSkeleton } from "./DashboardSkeleton";


import CreateBanner from "./CreateBanner";
import Announcements from "./Announcements";
import ClassesGrid from "./ClassesGrid";
import ActivityPanel from "./ActivityPanel";
import ActivityAllModal from "./ActivityAllModal";
import ProfileCard from "./ProfileCard";
import SubjectDonut from "./SubjectDonut";
import { StatsDrilldownDrawer, type DrilldownType } from "./StatsDrilldownDrawer";
import type {
  Announcement,
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
  const { studyActivityData } = useExamStats();
  const { subjects: userSubjects, getSubjectColor } = useUserSubjects();
  const drilldown = useStatsDrilldown();

  const [showJoinClass, setShowJoinClass] = useState(false);
  const [activityModal, setActivityModal] = useState<{ open: boolean; tab: "exams" | "quizzes" }>({
    open: false,
    tab: "exams",
  });

  const { data: dash, isLoading: dashLoading, isError } = useQuery({
    queryKey: ["student-dashboard"],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("no auth user");

      // ── Batch 1: independent top-level queries ────────────────────────────
      const [
        profileRes,
        prefsRes,
        streakRes,
        ownExamsRes,
        assignmentsRes,
        practiceSetsRes,
        membershipsRes,
      ] = await Promise.all([
        supabase.from("user_profiles").select("first_name, last_name, display_name").eq("id", uid).maybeSingle(),
        supabase.from("user_preferences").select("curriculum_region").eq("user_id", uid).maybeSingle(),
        supabase.from("user_streaks").select("current_streak, last_exam_submitted_at").eq("user_id", uid).maybeSingle(),
        supabase.from("exams").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase
          .from("exam_assignments")
          .select("exam_id, deadline, exams(*)")
          .in("assignment_type", ["individual", "group", "class", "student", "all_students"])
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("practice_question_sets")
          .select("id, set_name, subject_id, question_count, status")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("group_members")
          .select("group_id, student_groups(id, name, tutor_id, subjects_covered)")
          .eq("student_id", uid)
          .eq("is_active", true),
      ]);

      const ownExams = ownExamsRes.data || [];
      const assignedExams =
        assignmentsRes.data?.map((a) => ({
          ...(a.exams as any),
          assigned_by: "teacher",
          deadline: a.deadline,
        })) || [];
      const examsData = [...ownExams, ...assignedExams];
      const examIds = examsData.map((e) => e.id).filter(Boolean);

      const practiceSetsRaw = practiceSetsRes.data || [];
      const setIds = practiceSetsRaw.map((s) => s.id);

      const groups = (membershipsRes.data || [])
        .map((m) => (m.student_groups as any) || null)
        .filter(Boolean);
      const groupIds = groups.map((g) => g.id);
      const tutorIds = Array.from(new Set(groups.map((g) => g.tutor_id).filter(Boolean)));

      // ── Batch 2: fan-out lookups, all in one round-trip ───────────────────
      const [submissionsRes, progressRes, groupMembersRes, tutorsRes, annsRes] = await Promise.all([
        examIds.length
          ? supabase
              .from("exam_submissions")
              .select("id, exam_id, total_score, total_marks, status, last_accessed_at")
              .in("exam_id", examIds)
              .eq("student_id", uid)
          : Promise.resolve({ data: [] as any[] }),
        setIds.length
          ? supabase
              .from("practice_set_progress")
              .select("set_id, questions_attempted, completed_at, questions_correct")
              .in("set_id", setIds)
              .eq("user_id", uid)
          : Promise.resolve({ data: [] as any[] }),
        groupIds.length
          ? supabase.from("group_members").select("group_id").in("group_id", groupIds).eq("is_active", true)
          : Promise.resolve({ data: [] as any[] }),
        tutorIds.length
          ? supabase.from("user_profiles").select("id, display_name").in("id", tutorIds)
          : Promise.resolve({ data: [] as any[] }),
        groupIds.length
          ? supabase
              .from("group_announcements")
              .select("id, title, created_at, group_id, student_groups(name)")
              .in("group_id", groupIds)
              .order("created_at", { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const subByExam = new Map<string, any>();
      (submissionsRes.data || []).forEach((s: any) => subByExam.set(s.exam_id, s));
      const allExams: ExamWithSubmission[] = examsData.map((exam) => {
        const submission = subByExam.get(exam.id);
        return {
          ...exam,
          submission: submission ? { ...submission, status: submission.status as any } : undefined,
        };
      });
      allExams.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const progByset = new Map<string, any>();
      (progressRes.data || []).forEach((p: any) => progByset.set(p.set_id, p));
      const practiceSets: PracticeSetWithProgress[] = practiceSetsRaw.map((s) => ({
        ...s,
        progress: progByset.get(s.id) || undefined,
      }));

      const countByGroup = new Map<string, number>();
      (groupMembersRes.data || []).forEach((m: any) => {
        countByGroup.set(m.group_id, (countByGroup.get(m.group_id) || 0) + 1);
      });

      const tutorById = new Map<string, string>();
      (tutorsRes.data || []).forEach((t: any) => tutorById.set(t.id, t.display_name));

      // ── Profile/name derivation ───────────────────────────────────────────
      const first = profileRes.data?.first_name || "";
      const last = profileRes.data?.last_name || "";
      const full =
        first && last
          ? `${first} ${last}`
          : profileRes.data?.display_name ||
            auth.user?.user_metadata?.full_name ||
            auth.user?.email?.split("@")[0] ||
            "User";
      const parts = full.split(" ");
      const initials =
        parts.length >= 2
          ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
          : full.slice(0, 2).toUpperCase();

      let currentStreak = 0;
      const streak = streakRes.data;
      if (streak?.last_exam_submitted_at) {
        const hours = (Date.now() - new Date(streak.last_exam_submitted_at).getTime()) / 3600000;
        currentStreak = hours <= 48 ? streak.current_streak : 0;
      }

      const classesRaw = groups.map((g: any, i: number) => ({
        id: g.id,
        name: g.name,
        tutorId: g.tutor_id,
        subjects_covered: g.subjects_covered,
        students: countByGroup.get(g.id) || 0,
        index: i,
      }));

      const announcements: Announcement[] = (annsRes.data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        from: (a.student_groups as any)?.name || "Class",
        when: timeAgo(a.created_at),
      }));

      return {
        userName: full,
        initials,
        program: prefsRes.data?.curriculum_region || "",
        currentStreak,
        allExams,
        practiceSets,
        classesRaw,
        tutorById,
        announcements,
      };
    },
  });

  if (isError) toast.error("Failed to load dashboard data");

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

  if (dashLoading && !dash) return <DashboardSkeleton />;

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
        name: subjectName(id),
        color: getSubjectColor(id),
        pct: Math.round((n / sum) * 100),
      }));
    }
    return Array.from(hoursBySubject.entries()).map(([name, hrs]) => ({
      key: name,
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
      icon: FileText,
      value: completedExams.length.toString(),
      label: "Exams Completed",
      iconClass: "text-primary",
      onClick: () => drilldown.openDrawer("exams"),
    },
    {
      key: "avg",
      icon: Trophy,
      value: averageScore !== null ? `${averageScore}%` : "—",
      label: "Average Score",
      iconClass: "text-warning",
      onClick: () => drilldown.openDrawer("scores"),
    },
    {
      key: "hours",
      icon: Clock,
      value: totalStudyHours > 0 ? `${totalStudyHours.toFixed(0)}h` : "0h",
      label: "Total Study Hours",
      iconClass: "text-[#a78bfa]",
      onClick: () => drilldown.openDrawer("study-hours"),
    },
    {
      key: "streak",
      icon: Flame,
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="font-sans">
      <main className="mx-auto max-w-[1480px] px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_332px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <header className="mb-1">
              <h1 className="text-[25px] font-extrabold tracking-tight">
                Welcome back, {profile.name.split(" ")[0]}!
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Here's your study overview.
              </p>
            </header>

            <CreateBanner
              onCreateExam={() => navigate("/upload")}
              onCreateQuiz={() => navigate("/create-practice-questions")}
            />
            {announcements.length > 0 && (
              <Announcements
                items={announcements}
                onOpen={() => navigate("/my-classes")}
              />
            )}
            {classes.length === 0 ? (
              <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-2 text-base font-bold">My Classes</h2>
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    You haven't joined any classes yet.
                  </p>
                  <button
                    onClick={() => setShowJoinClass(true)}
                    className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    Join a class
                  </button>
                </div>
              </section>
            ) : (
              <ClassesGrid
                classes={classes}
                onContinue={(id) => navigate(`/my-classes?classId=${id}`)}
              />
            )}
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
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-[88px]">
            <ProfileCard profile={profile} stats={profileStats} />
            <SubjectDonut
              subjects={subjectsForDonut}
              centerValue={averageScore !== null ? `${averageScore}%` : "—"}
            />
          </aside>
        </div>
      </main>

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
