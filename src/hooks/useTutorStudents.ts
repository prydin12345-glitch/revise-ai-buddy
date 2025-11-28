import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TutorStudent {
  id: string;
  display_name: string | null;
  email: string;
  group_name: string;
  group_id: string;
}

export const useTutorStudents = () => {
  const [students, setStudents] = useState<TutorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTutorStudents = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Get all groups managed by this tutor
        const { data: groups, error: groupsError } = await supabase
          .from("student_groups")
          .select("id, name")
          .eq("tutor_id", user.id)
          .eq("is_active", true);

        if (groupsError) throw groupsError;

        if (!groups || groups.length === 0) {
          setStudents([]);
          setLoading(false);
          return;
        }

        const groupIds = groups.map(g => g.id);

        // Get all students in these groups
        const { data: members, error: membersError } = await supabase
          .from("group_members")
          .select(`
            student_id,
            group_id,
            student_groups!inner(name)
          `)
          .in("group_id", groupIds)
          .eq("is_active", true);

        if (membersError) throw membersError;

        // Get user profiles for these students
        const studentIds = [...new Set(members?.map(m => m.student_id) || [])];
        
        const { data: profiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, display_name")
          .in("id", studentIds);

        if (profilesError) throw profilesError;

        // Get auth users for emails
        const studentsData: TutorStudent[] = [];
        
        for (const member of members || []) {
          const profile = profiles?.find(p => p.id === member.student_id);
          const group = groups.find(g => g.id === member.group_id);
          
          // Get email from auth.users via RPC or service role
          // For now, we'll use display_name as identifier
          studentsData.push({
            id: member.student_id,
            display_name: profile?.display_name || "Unknown",
            email: "", // Would need service role to fetch from auth.users
            group_name: group?.name || "Unknown Group",
            group_id: member.group_id
          });
        }

        setStudents(studentsData);
      } catch (err) {
        console.error("Error fetching tutor students:", err);
        setError(err instanceof Error ? err.message : "Failed to load students");
      } finally {
        setLoading(false);
      }
    };

    fetchTutorStudents();
  }, []);

  return { students, loading, error };
};
