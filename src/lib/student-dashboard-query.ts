import { supabase } from "@/integrations/supabase/client";
import type { ExamWithSubmission } from "@/components/dashboard/ExamRowItem";
import type { Announcement } from "@/components/dashboard/types";
import { boundedQuery } from "./workspace-query-client";

export interface PracticeSetWithProgress {
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

/** Existing Home summary reads, shared with clicked-route preparation. No writes or draft recovery. */
export const studentDashboardQuery = (ownerId: string | null, generation = 0) => {
  const options = {
    queryKey: ["student-dashboard", ownerId, generation],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || (ownerId && uid !== ownerId)) throw new Error("Your account changed. Reopen Home.");

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

      const failure = [profileRes, ownExamsRes, assignmentsRes, practiceSetsRes, membershipsRes].find(result => result.error)?.error;
      if (failure) throw failure;

      // Hide hard-deleted, archived, or otherwise tombstoned exams from Recent Activity
      const isLiveExam = (e: any) =>
        !!e && !!e.id && e.status !== "archived" && e.status !== "deleted";

      const ownExams = (ownExamsRes.data || []).filter(isLiveExam);
      // Filter out assignments whose underlying exam has been deleted/archived
      // (Supabase returns exams: null when the joined row no longer exists)
      const assignedExams =
        (assignmentsRes.data || [])
          .filter((a: any) => a && a.exams && isLiveExam(a.exams))
          .map((a: any) => ({
            ...(a.exams as any),
            assigned_by: "teacher",
            deadline: a.deadline,
          })) || [];
      const examsData = [...ownExams, ...assignedExams].filter(isLiveExam);
      const examIds = examsData.map((e) => e.id).filter(Boolean);

      // Practice sets: hide deleted (defensive filter on id) and tombstoned/archived statuses
      const practiceSetsRaw = (practiceSetsRes.data || []).filter(
        (s: any) => s && s.id && s.status !== "deleted" && s.status !== "archived"
      );
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
  };
  return { ...options, ...boundedQuery(options) };
};
