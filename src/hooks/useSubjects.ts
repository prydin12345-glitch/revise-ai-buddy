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

      // Validate input
      if (!selectedSubjects || selectedSubjects.length === 0) {
        throw new Error("No subjects to save");
      }

      // Validate subjects before saving
      const invalidSubjects = selectedSubjects.filter(s => {
        if (!s.is_custom && !s.subject_id) {
          console.error("Non-custom subject missing subject_id:", s);
          return true;
        }
        if (!s.subject_name && !s.custom_name) {
          console.error("Subject missing both subject_name and custom_name:", s);
          return true;
        }
        return false;
      });

      if (invalidSubjects.length > 0) {
        throw new Error("Some subjects are missing required fields. Please try again.");
      }

      // Delete existing subjects
      const { error: deleteError } = await supabase
        .from("user_subjects")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("Error deleting subjects:", deleteError);
        throw new Error(`Failed to clear existing subjects: ${deleteError.message}`);
      }

      // Prepare subjects for insertion with explicit validation
      const subjectsToInsert = selectedSubjects.map(s => ({
        user_id: user.id,
        subject_id: s.subject_id || null,
        subject_name: s.subject_name || s.custom_name || 'Unknown Subject',
        subject_color: s.subject_color || '#3B82F6',
        custom_name: s.custom_name || null,
        curriculum_tag: s.curriculum_tag || null,
        proficiency_estimate: s.proficiency_estimate || null,
        is_custom: s.is_custom === true // Explicit boolean comparison
      }));

      console.log("Inserting subjects:", subjectsToInsert);

      const { error: insertError } = await supabase
        .from("user_subjects")
        .insert(subjectsToInsert);

      if (insertError) {
        console.error("Error inserting subjects:", insertError);
        throw new Error(`Failed to save subjects: ${insertError.message}`);
      }

      toast({
        title: "Success",
        description: "Subjects saved successfully",
      });

      await loadUserSubjects();
      return true;
    } catch (error: any) {
      console.error("Error saving subjects:", error);
      const errorMessage = error.message || "Failed to save subjects";
      toast({
        title: "Error",
        description: errorMessage,
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
