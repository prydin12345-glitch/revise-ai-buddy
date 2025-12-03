import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TutorStudent {
  id: string;
  display_name: string | null;
  student_code: string | null;
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

        // Get all students in these groups with their profiles
        const { data: members, error: membersError } = await supabase
          .from("group_members")
          .select(`
            student_id,
            group_id,
            user_profiles!group_members_student_id_fkey(id, display_name, student_code)
          `)
          .in("group_id", groupIds)
          .eq("is_active", true);

        if (membersError) throw membersError;

        // Build students data
        const studentsData: TutorStudent[] = [];
        
        for (const member of members || []) {
          const profile = member.user_profiles as any;
          const group = groups.find(g => g.id === member.group_id);
          
          studentsData.push({
            id: member.student_id,
            display_name: profile?.display_name || "Unknown",
            student_code: profile?.student_code || null,
            email: "",
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
