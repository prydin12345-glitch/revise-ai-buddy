import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Subject {
  id: string;
  name: string;
  slug: string;
  category: string;
  icon_name?: string | null;
  default_exam_types?: any;
  default_spaced_profile?: any;
  common_topics?: any;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserSubject {
  id?: string;
  user_id: string;
  subject_id?: string;
  subject_name?: string;
  subject_color: string;
  custom_name?: string;
  curriculum_tag?: string;
  proficiency_estimate?: number;
  is_custom: boolean;
}

export const useSubjects = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [userSubjects, setUserSubjects] = useState<UserSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSubjects();
    loadUserSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error("Error loading subjects:", error);
      toast({
        title: "Error",
        description: "Failed to load subjects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_subjects")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setUserSubjects(data || []);
    } catch (error) {
      console.error("Error loading user subjects:", error);
    }
  };

  const saveUserSubjects = async (selectedSubjects: UserSubject[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete existing subjects
      await supabase
        .from("user_subjects")
        .delete()
        .eq("user_id", user.id);

      // Insert new subjects
      const { error } = await supabase
        .from("user_subjects")
        .insert(selectedSubjects.map(s => ({
          user_id: user.id,
          subject_id: s.subject_id || null,
          subject_name: s.subject_name || s.custom_name || "Unknown",
          subject_color: s.subject_color,
          custom_name: s.custom_name || null,
          curriculum_tag: s.curriculum_tag || null,
          proficiency_estimate: s.proficiency_estimate || null,
          is_custom: s.is_custom
        })));

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subjects saved successfully",
      });

      await loadUserSubjects();
      return true;
    } catch (error) {
      console.error("Error saving subjects:", error);
      toast({
        title: "Error",
        description: "Failed to save subjects",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    subjects,
    userSubjects,
    loading,
    saveUserSubjects,
    reloadUserSubjects: loadUserSubjects
  };
};
