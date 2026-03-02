import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StudentGroup {
  id: string;
  name: string;
  description: string | null;
  subjects_covered: string[];
  invite_code: string | null;
  capacity: number;
  member_count: number;
  assignment_count: number;
  created_at: string;
  settings: Record<string, any> | null;
}

export const useManageGroups = () => {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get all groups managed by this tutor
      const { data: groupsData, error: groupsError } = await supabase
        .from("student_groups")
        .select("*")
        .eq("tutor_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (groupsError) throw groupsError;

      // Get member counts and assignment counts for each group
      const groupsWithCounts = await Promise.all(
        (groupsData || []).map(async (group) => {
          // Member count
          const { count: memberCount } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id)
            .eq("is_active", true);

          // Active assignment count
          const { count: assignmentCount } = await supabase
            .from("exam_assignments")
            .select("*", { count: "exact", head: true })
            .eq("target_id", group.id)
            .eq("assignment_type", "group")
            .eq("is_active", true);

          const subjects = Array.isArray(group.subjects_covered) 
            ? group.subjects_covered as string[]
            : [];

          return {
            id: group.id,
            name: group.name,
            description: group.description,
            subjects_covered: subjects,
            invite_code: group.invite_code,
            capacity: group.capacity || 10,
            member_count: memberCount || 0,
            assignment_count: assignmentCount || 0,
            created_at: group.created_at,
            settings: (group.settings as Record<string, any>) || null,
          };
        })
      );

      setGroups(groupsWithCounts);
    } catch (err) {
      console.error("Error fetching groups:", err);
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (groupId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("student_groups")
        .update({ is_active: false })
        .eq("id", groupId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error deleting group:", err);
      return false;
    }
  };

  const updateGroup = async (groupId: string, updates: { name?: string; description?: string }): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("student_groups")
        .update(updates)
        .eq("id", groupId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error updating group:", err);
      return false;
    }
  };

  const regenerateInviteCode = async (groupId: string): Promise<string | null> => {
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const newCode = `EXM-${code}`;

      const { error } = await supabase
        .from("student_groups")
        .update({ invite_code: newCode })
        .eq("id", groupId);

      if (error) throw error;
      return newCode;
    } catch (err) {
      console.error("Error regenerating invite code:", err);
      return null;
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  return { 
    groups, 
    loading, 
    error, 
    deleteGroup,
    updateGroup,
    regenerateInviteCode,
    refetch: fetchGroups 
  };
};
