import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserSubject {
  id: string;
  subject_name: string;
  subject_color: string;
  subject_id?: string | null;
}

export const useUserSubjects = () => {
  const [subjects, setSubjects] = useState<UserSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_subjects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSubjectColor = (subjectName: string): string => {
    const subject = subjects.find(
      (s) => s.subject_name.toLowerCase() === subjectName.toLowerCase()
    );
    return subject?.subject_color || "#3B82F6";
  };

  const getAffectedEntityCounts = async (subjectName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { exams: 0, goals: 0, tasks: 0 };

      const [examsResult, goalsResult, tasksResult] = await Promise.all([
        supabase
          .from("exams")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .ilike("subject_id", subjectName),
        
        supabase
          .from("revision_goals")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .ilike("subject", subjectName),
        
        supabase
          .from("revision_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .ilike("subject", subjectName)
      ]);

      return {
        exams: examsResult.count || 0,
        goals: goalsResult.count || 0,
        tasks: tasksResult.count || 0
      };
    } catch (error) {
      console.error("Error fetching affected entity counts:", error);
      return { exams: 0, goals: 0, tasks: 0 };
    }
  };

  const saveOrUpdateSubject = async (subjectName: string, color: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Look up the subject_id from the subjects table
    const { data: subjectData } = await supabase
      .from("subjects")
      .select("id")
      .ilike("name", subjectName)
      .maybeSingle();

    // Check if subject already exists in user_subjects
    const existingSubject = subjects.find(
      (s) => s.subject_name.toLowerCase() === subjectName.toLowerCase()
    );

    if (existingSubject) {
      // Update existing subject color in user_subjects
      const { error } = await supabase
        .from("user_subjects")
        .update({ 
          subject_color: color, 
          updated_at: new Date().toISOString(),
          subject_id: subjectData?.id || existingSubject.subject_id || null,
        })
        .eq("id", existingSubject.id);

      if (error) throw error;

      // Cascade update to revision_goals
      const { error: goalsError } = await supabase
        .from("revision_goals")
        .update({ subject_color: color })
        .eq("user_id", user.id)
        .ilike("subject", subjectName);

      if (goalsError) console.error("Error updating goals:", goalsError);

      // Cascade update to revision_tasks
      const { error: tasksError } = await supabase
        .from("revision_tasks")
        .update({ subject_color: color })
        .eq("user_id", user.id)
        .ilike("subject", subjectName);

      if (tasksError) console.error("Error updating tasks:", tasksError);

      // Cascade update to weekly_subject_stats
      const { error: statsError } = await supabase
        .from("weekly_subject_stats")
        .update({ subject_color: color })
        .eq("user_id", user.id)
        .ilike("subject", subjectName);

      if (statsError) console.error("Error updating weekly stats:", statsError);
      
      setSubjects(subjects.map(s => 
        s.id === existingSubject.id 
          ? { ...s, subject_color: color }
          : s
      ));
    } else {
      // Insert new subject with proper subject_id reference
      const isCustomSubject = !subjectData?.id;
      
      const { data, error } = await supabase
        .from("user_subjects")
        .insert({
          user_id: user.id,
          subject_name: subjectName,
          subject_color: color,
          subject_id: subjectData?.id || null,
          is_custom: isCustomSubject,
          custom_name: isCustomSubject ? subjectName : null,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setSubjects([...subjects, data]);
    }
  };

  return {
    subjects,
    isLoading,
    getSubjectColor,
    saveOrUpdateSubject,
    getAffectedEntityCounts,
    refetch: fetchSubjects,
  };
};
