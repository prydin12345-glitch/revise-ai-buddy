import { supabase } from "@/integrations/supabase/exam-metadata-client";
import type { WorkspaceStore } from "@/hooks/use-workspace-session";
import { boundedQuery, workspaceUser } from "./workspace-query-client";
import type { StudentGroup, GroupAssignment, GroupAnnouncement, TutorInfo, SubmissionData, FeedbackThread } from "@/pages/MyClasses";

/** Only the class information already displayed to this signed-in student. */
export const classesQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["workspace-classes"],
  queryFn: async () => {
    const user = await workspaceUser(store);
    if (!user) throw new Error("Sign in to view your classes.");
    const [
      { data: profile, error: profileError },
      { data: memberships, error: membershipError },
    ] = await Promise.all([
      supabase.from("user_profiles")
        .select("first_name, display_name")
        .eq("id", user.id)
        .single(),
      supabase.from("group_members")
        .select(`
          group_id,
          joined_at,
          student_groups!inner (
            id, name, description, tutor_id, subjects_covered, is_active
          )
        `)
        .eq("student_id", user.id)
        .eq("is_active", true),
    ]);

    if (profileError || membershipError) throw profileError || membershipError;
    const firstName = profile?.first_name || profile?.display_name?.split(" ")[0] || "";
    if (!memberships || memberships.length === 0) {
      return { firstName, groups: [] as StudentGroup[], tutors: new Map<string, TutorInfo>(), assignments: [] as GroupAssignment[], submissions: new Map<string, SubmissionData>(), feedbackThreads: [] as FeedbackThread[], announcements: [] as GroupAnnouncement[] };
    }

    const activeGroups: StudentGroup[] = memberships
      .filter((m: any) => m.student_groups?.is_active)
      .map((m: any) => ({
        id: m.student_groups.id,
        name: m.student_groups.name,
        description: m.student_groups.description,
        tutor_id: m.student_groups.tutor_id,
        subjects_covered: m.student_groups.subjects_covered || [],
        joined_at: m.joined_at,
      }));

    if (!activeGroups.length) return { firstName, groups: activeGroups, tutors: new Map<string, TutorInfo>(), assignments: [] as GroupAssignment[], submissions: new Map<string, SubmissionData>(), feedbackThreads: [] as FeedbackThread[], announcements: [] as GroupAnnouncement[] };

    // These reads share only the resolved group IDs and can load together.
    const tutorIds = [...new Set(activeGroups.map(g => g.tutor_id))];
    const groupIds = activeGroups.map(g => g.id);
    const [
      { data: tutorProfiles, error: tutorError },
      { data: tutorUserProfiles, error: tutorUserError },
      { data: examAssignments, error: assignmentError },
      { data: groupAnnouncements, error: announcementError },
    ] = await Promise.all([
      supabase.from("tutor_profiles")
        .select("user_id, bio, subjects_taught")
        .in("user_id", tutorIds),
      supabase.from("user_profiles")
        .select("id, display_name, first_name, last_name")
        .in("id", tutorIds),
      supabase.from("exam_assignments")
        .select(`
          id, exam_id, deadline, release_date, target_id,
          exams!inner (id, title, type, status)
        `)
        .eq("assignment_type", "group")
        .eq("is_active", true)
        .in("target_id", groupIds),
      supabase.from("group_announcements")
        .select("id, title, message, created_at, attachment_url, group_id")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (tutorError || tutorUserError || assignmentError || announcementError) {
      throw tutorError || tutorUserError || assignmentError || announcementError;
    }
    const tutorMap = new Map<string, TutorInfo>();
    tutorIds.forEach(id => {
      const profile = tutorUserProfiles?.find(p => p.id === id);
      const tutorProfile = tutorProfiles?.find(p => p.user_id === id);
      const name = profile?.display_name ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        "Tutor";
      tutorMap.set(id, {
        name,
        bio: tutorProfile?.bio || undefined,
        subjects_taught: (tutorProfile?.subjects_taught as string[]) || [],
      });
    });

    const allAssignments: GroupAssignment[] = (examAssignments || [])
      .filter((a: any) => a.exams?.status === "published")
      .map((a: any) => {
        const group = activeGroups.find(g => g.id === a.target_id);
        return {
          id: a.id,
          exam_id: a.exam_id,
          exam_title: a.exams?.title || "Untitled",
          exam_type: a.exams?.type || "uploaded",
          deadline: a.deadline,
          release_date: a.release_date,
          group_id: a.target_id,
          group_name: group?.name || "",
        };
      });

    let submissions = new Map<string, SubmissionData>();
    let feedbackThreads: FeedbackThread[] = [];
    // Get student submissions
    const examIds = allAssignments.map(a => a.exam_id);
    if (examIds.length > 0) {
      const [
        { data: studentSubmissions, error: submissionError },
        { data: threads, error: threadError },
      ] = await Promise.all([
        supabase.from("exam_submission_metadata")
          .select("exam_id, status, total_score, total_marks, submitted_at")
          .eq("student_id", user.id)
          .in("exam_id", examIds),
        supabase.from("question_feedback_threads")
          .select("*")
          .eq("student_id", user.id)
          .in("exam_id", examIds)
          .order("created_at", { ascending: false }),
      ]);

      if (submissionError || threadError) throw submissionError || threadError;
      const submissionMap = new Map();
      studentSubmissions?.forEach(s => {
        submissionMap.set(s.exam_id, {
          status: s.status,
          total_score: s.total_score,
          total_marks: s.total_marks,
          submitted_at: s.submitted_at,
        });
      });
      submissions = submissionMap;

      feedbackThreads = (threads || []) as FeedbackThread[];
    }

    const allAnnouncements: GroupAnnouncement[] = (groupAnnouncements || []).map(a => {
      const group = activeGroups.find(g => g.id === a.group_id);
      return { ...a, group_name: group?.name || "" };
    });

    return { firstName, groups: activeGroups, tutors: tutorMap, assignments: allAssignments, submissions, feedbackThreads, announcements: allAnnouncements };
  },
});
