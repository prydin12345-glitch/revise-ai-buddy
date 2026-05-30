import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Trophy, Clock, Flame, TrendingUp, ListChecks, Target } from "lucide-react";
import { useExamStats } from "@/hooks/useExamStats";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useStatsDrilldown } from "@/hooks/useStatsDrilldown";
import { ExamWithSubmission } from "./ExamRowItem";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";

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

  const [userName, setUserName] = useState("");
  const [initials, setInitials] = useState("U");
  const [program, setProgram] = useState("");
  const [allExams, setAllExams] = useState<ExamWithSubmission[]>([]);
  const [practiceSets, setPracticeSets] = useState<PracticeSetWithProgress[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [activityModal, setActivityModal] = useState<{ open: boolean; tab: "exams" | "quizzes" }>({
    open: false,
    tab: "exams",
  });

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name, last_name, display_name")
        .eq("id", uid)
        .maybeSingle();

      const first = profile?.first_name || "";
      const last = profile?.last_name || "";
      const full =
        first && last
          ? `${first} ${last}`
          : profile?.display_name ||
            auth.user?.user_metadata?.full_name ||
            auth.user?.email?.split("@")[0] ||
            "User";
      setUserName(full);
      const parts = full.split(" ");
      setInitials(
        parts.length >= 2
          ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
          : full.slice(0, 2).toUpperCase()
      );

      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("curriculum_region")
        .eq("user_id", uid)
        .maybeSingle();
      if (prefs?.curriculum_region) setProgram(prefs.curriculum_region);

      try {
        const { data: streak } = await supabase
          .from("user_streaks")
          .select("current_streak, last_exam_submitted_at")
          .eq("user_id", uid)
          .maybeSingle();
        if (streak?.last_exam_submitted_at) {
          const hours =
            (Date.now() - new Date(streak.last_exam_submitted_at).getTime()) / 3600000;
          setCurrentStreak(hours <= 48 ? streak.current_streak : 0);
        }
      } catch {
        /* ignore */
      }

      // Exams (own + assigned)
      const { data: ownExams } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      const { data: assignments } = await supabase
        .from("exam_assignments")
        .select("exam_id, deadline, exams(*)")
        .in("assignment_type", [
          "individual",
          "group",
          "class",
          "student",
          "all_students",
        ])
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const assignedExams =
        assignments?.map((a) => ({
          ...(a.exams as any),
          assigned_by: "teacher",
          deadline: a.deadline,
        })) || [];

      const examsData = [...(ownExams || []), ...assignedExams];
      const withSubs = await Promise.all(
        examsData.map(async (exam) => {
          const { data: submission } = await supabase
            .from("exam_submissions")
            .select("id, total_score, total_marks, status, last_accessed_at")
            .eq("exam_id", exam.id)
            .eq("student_id", uid)
            .maybeSingle();
          return {
            ...exam,
            submission: submission
              ? { ...submission, status: submission.status as any }
              : undefined,
          };
        })
      );
      withSubs.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setAllExams(withSubs);

      // Practice sets
      const { data: sets } = await supabase
        .from("practice_question_sets")
        .select("id, set_name, subject_id, question_count, status")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(10);
      if (sets) {
        const withProgress = await Promise.all(
          sets.map(async (s) => {
            const { data: progress } = await supabase
              .from("practice_set_progress")
              .select("questions_attempted, completed_at, questions_correct")
              .eq("set_id", s.id)
              .eq("user_id", uid)
              .maybeSingle();
            return { ...s, progress: progress || undefined };
          })
        );
        setPracticeSets(withProgress);
      }

      // Classes
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, student_groups(id, name, tutor_id, subjects_covered)")
        .eq("student_id", uid)
        .eq("is_active", true);

      if (memberships?.length) {
        const list: ClassItem[] = [];
        for (let i = 0; i < memberships.length; i++) {
          const g = (memberships[i].student_groups as any) || null;
          if (!g) continue;
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", g.id)
            .eq("is_active", true);
          const { data: tutor } = await supabase
            .from("user_profiles")
            .select("display_name")
            .eq("id", g.tutor_id)
            .maybeSingle();
          const subjectTag =
            (Array.isArray(g.subjects_covered) && g.subjects_covered[0]?.name) ||
            g.name;
          list.push({
            id: g.id,
            title: g.name,
            teacher: tutor?.display_name || "Tutor",
            students: count || 0,
            progress: 0,
            next: "No upcoming work",
            subjectTag,
            accentColor: getSubjectColor(subjectTag),
            motif: MOTIFS[i % MOTIFS.length],
            glyph: GLYPHS[i % GLYPHS.length],
          });
        }
        setClasses(list);

        const groupIds = memberships
          .map((m) => (m.student_groups as any)?.id)
          .filter(Boolean);
        if (groupIds.length) {
          const { data: anns } = await supabase
            .from("group_announcements")
            .select("id, title, created_at, group_id, student_groups(name)")
            .in("group_id", groupIds)
            .order("created_at", { ascending: false })
            .limit(3);
          if (anns) {
            setAnnouncements(
              anns.map((a) => ({
                id: a.id,
                title: a.title,
                from: (a.student_groups as any)?.name || "Class",
                when: timeAgo(a.created_at),
              }))
            );
          }
        }
      }
    })().catch((err) => {
      console.error(err);
      toast.error("Failed to load dashboard data");
    });
  }, [getSubjectColor]);

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
    },
    {
      key: "avg",
      icon: Trophy,
      value: averageScore !== null ? `${averageScore}%` : "—",
      label: "Average Score",
      iconClass: "text-warning",
    },
    {
      key: "hours",
      icon: Clock,
      value: totalStudyHours > 0 ? `${totalStudyHours.toFixed(0)}h` : "0h",
      label: "Total Study Hours",
      iconClass: "text-[#a78bfa]",
    },
    {
      key: "streak",
      icon: Flame,
      value: currentStreak > 0 ? currentStreak.toString() : "—",
      label: "Day Streak",
      iconClass: "text-danger",
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
              onCreateExam={() => navigate("/upload-exam")}
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
                if (
                  ex?.submission?.status === "graded" ||
                  ex?.submission?.status === "submitted" ||
                  ex?.submission?.status === "completed"
                ) {
                  navigate(`/exam/${id}/review`);
                } else {
                  navigate(`/exam/${id}`);
                }
              }}
              onStartQuiz={(id) => navigate(`/practice-questions/${id}/preview`)}
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
    </div>
  );
};
