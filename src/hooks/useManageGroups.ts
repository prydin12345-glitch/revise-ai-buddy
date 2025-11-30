import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StudentGroup {
  id: string;
  name: string;
  subjects_covered: unknown;
  invite_code: string | null;
  capacity: number;
  member_count: number;
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

      // Get member counts for each group
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
            subjects_covered: group.subjects_covered,
            invite_code: group.invite_code,
            capacity: group.capacity || 10,
            member_count: count || 0,
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

  useEffect(() => {
    fetchGroups();
  }, []);

  return { 
    groups, 
    loading, 
    error, 
    deleteGroup, 
    refetch: fetchGroups 
  };
};
