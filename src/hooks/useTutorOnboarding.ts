import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TutorProfile {
  subjects_taught: string[];
  student_count_estimate?: number;
  teaching_mode: "groups" | "one_on_one" | "mixed";
  preferred_group_size?: number;
  availability: Record<string, string[]>;
  bio?: string;
}

export interface SuggestedGroup {
  id: string;
  name: string;
  invite_code: string;
  invite_link: string;
  capacity: number;
}

export const useTutorOnboarding = () => {
  const [loading, setLoading] = useState(false);
  const [suggestedGroups, setSuggestedGroups] = useState<SuggestedGroup[]>([]);
  const { toast } = useToast();

  const completeTutorOnboarding = async (profile: TutorProfile) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "complete-tutor-onboarding",
        {
          body: profile
        }
      );

      if (error) throw error;

      if (data?.suggested_groups) {
        setSuggestedGroups(data.suggested_groups);
      }

      toast({
        title: "Welcome!",
        description: "Your tutor profile has been set up successfully",
      });

      return {
        success: true,
        profile: data.profile,
        groups: data.suggested_groups || []
      };
    } catch (error) {
      console.error("Error completing tutor onboarding:", error);
      toast({
        title: "Error",
        description: "Failed to complete onboarding. Please try again.",
        variant: "destructive",
      });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    completeTutorOnboarding,
    suggestedGroups,
    loading
  };
};
