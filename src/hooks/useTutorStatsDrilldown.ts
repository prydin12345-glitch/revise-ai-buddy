import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TutorDrilldownType = 'studentGroups' | 'totalStudents' | 'examsCreated' | 'activeAssignments' | null;

export interface StudentGroup {
  id: string;
  name: string;
  member_count: number;
  created_at: string;
  invite_code: string | null;
}

export interface StudentItem {
  id: string;
  student_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  student_code: string | null;
  group_id: string;
  group_name: string;
  joined_at: string;
}

export interface ExamItem {
  id: string;
  title: string;
  subject_id: string;
  status: string;
  created_at: string;
  assigned_count: number;
}

export interface AssignmentItem {
  id: string;
  exam_id: string;
  exam_title: string;
  target_id: string | null;
  group_name: string | null;
  deadline: string | null;
  created_at: string;
  is_active: boolean;
}

export const useTutorStatsDrilldown = () => {
  const [activeDrawer, setActiveDrawer] = useState<TutorDrilldownType>(null);
  const [loading, setLoading] = useState(false);
  
  // Groups data
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  
  // Students data
  const [students, setStudents] = useState<StudentItem[]>([]);
  
  // Exams data
  const [exams, setExams] = useState<ExamItem[]>([]);
  
  // Assignments data
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);

  const fetchGroupsData = useCallback(async (userId: string) => {
    const { data: groupsData, error } = await supabase
      .from("student_groups")
      .select("id, name, created_at, invite_code")
      .eq("tutor_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const groupsWithCounts = await Promise.all(
      (groupsData || []).map(async (group) => {
        const { count } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("is_active", true);

        return {
          id: group.id,
          name: group.name,
          created_at: group.created_at,
          invite_code: group.invite_code,
          member_count: count || 0,
        };
      })
    );

    setGroups(groupsWithCounts);
  }, []);

  const fetchStudentsData = useCallback(async (userId: string) => {
    // First get all groups for this tutor
    const { data: groupsData, error: groupsError } = await supabase
      .from("student_groups")
      .select("id, name")
      .eq("tutor_id", userId)
      .eq("is_active", true);

    if (groupsError) throw groupsError;

    const groupIds = (groupsData || []).map(g => g.id);
    const groupMap = new Map(groupsData?.map(g => [g.id, g.name]) || []);

    if (groupIds.length === 0) {
      setStudents([]);
      return;
    }

    // Get all members from those groups with their profiles
    const { data: membersData, error: membersError } = await supabase
      .from("group_members")
      .select(`
        id,
        student_id,
        group_id,
        joined_at,
        user_profiles!group_members_student_id_fkey(
          display_name,
          first_name,
          last_name,
          student_code
        )
      `)
      .in("group_id", groupIds)
      .eq("is_active", true)
      .order("joined_at", { ascending: false });

    if (membersError) throw membersError;

    const studentsFormatted: StudentItem[] = (membersData || []).map((member) => {
      const profile = member.user_profiles as any;
      return {
        id: member.id,
        student_id: member.student_id,
        display_name: profile?.display_name || "Unknown",
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        student_code: profile?.student_code || null,
        group_id: member.group_id,
        group_name: groupMap.get(member.group_id) || "Unknown Group",
        joined_at: member.joined_at,
      };
    });

    setStudents(studentsFormatted);
  }, []);

  const fetchExamsData = useCallback(async (userId: string) => {
    const { data: examsData, error } = await supabase
      .from("exams")
      .select("id, title, subject_id, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get assignment counts for each exam
    const examsWithCounts = await Promise.all(
      (examsData || []).map(async (exam) => {
        const { count } = await supabase
          .from("exam_assignments")
          .select("*", { count: "exact", head: true })
          .eq("exam_id", exam.id)
          .eq("is_active", true);

        return {
          ...exam,
          assigned_count: count || 0,
        };
      })
    );

    setExams(examsWithCounts);
  }, []);

  const fetchAssignmentsData = useCallback(async (userId: string) => {
    // Get all active assignments created by this tutor
    const { data: assignmentsData, error } = await supabase
      .from("exam_assignments")
      .select(`
        id,
        exam_id,
        target_id,
        deadline,
        created_at,
        is_active,
        exams!exam_assignments_exam_id_fkey(title)
      `)
      .eq("assigned_by", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get group names for assignments
    const targetIds = (assignmentsData || [])
      .filter(a => a.target_id)
      .map(a => a.target_id!);

    let groupMap = new Map<string, string>();
    if (targetIds.length > 0) {
      const { data: groupsData } = await supabase
        .from("student_groups")
        .select("id, name")
        .in("id", targetIds);
      
      groupMap = new Map((groupsData || []).map(g => [g.id, g.name]));
    }

    const formattedAssignments: AssignmentItem[] = (assignmentsData || []).map((assignment) => ({
      id: assignment.id,
      exam_id: assignment.exam_id,
      exam_title: (assignment.exams as any)?.title || "Unknown Exam",
      target_id: assignment.target_id,
      group_name: assignment.target_id ? (groupMap.get(assignment.target_id) || null) : null,
      deadline: assignment.deadline,
      created_at: assignment.created_at,
      is_active: assignment.is_active,
    }));

    setAssignments(formattedAssignments);
  }, []);

  const openDrawer = useCallback(async (type: TutorDrilldownType) => {
    if (!type) return;
    
    setActiveDrawer(type);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      switch (type) {
        case 'studentGroups':
          await fetchGroupsData(user.id);
          break;
        case 'totalStudents':
          await fetchStudentsData(user.id);
          break;
        case 'examsCreated':
          await fetchExamsData(user.id);
          break;
        case 'activeAssignments':
          await fetchAssignmentsData(user.id);
          break;
      }
    } catch (error) {
      console.error('Error fetching tutor drilldown data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchGroupsData, fetchStudentsData, fetchExamsData, fetchAssignmentsData]);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  return {
    activeDrawer,
    loading,
    openDrawer,
    closeDrawer,
    groups,
    students,
    exams,
    assignments,
  };
};
