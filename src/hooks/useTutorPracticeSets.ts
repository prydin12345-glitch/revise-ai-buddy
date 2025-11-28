import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TutorPracticeSet {
  id: string;
  set_name: string;
  subject_id: string;
  subtopics: string[];
  difficulty_level: string | null;
  question_count: number;
  status: string | null;
  created_at: string;
  completion_count: number;
  total_assigned: number;
}

export const useTutorPracticeSets = () => {
  const [practiceSets, setPracticeSets] = useState<TutorPracticeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTutorPracticeSets = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Get all practice sets created by this tutor
        const { data: setsData, error: setsError } = await supabase
          .from("practice_question_sets")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (setsError) throw setsError;

        // Get progress data for each set
        const setsWithStats: TutorPracticeSet[] = [];

        for (const set of setsData || []) {
          // Get progress records
          const { data: progress } = await supabase
            .from("practice_set_progress")
            .select("id, completed_at")
            .eq("set_id", set.id);

          const totalAssigned = progress?.length || 0;
          const completionCount = progress?.filter(p => p.completed_at !== null).length || 0;

          setsWithStats.push({
            id: set.id,
            set_name: set.set_name,
            subject_id: set.subject_id,
            subtopics: set.subtopics || [],
            difficulty_level: set.difficulty_level,
            question_count: set.question_count,
            status: set.status,
            created_at: set.created_at || "",
            completion_count: completionCount,
            total_assigned: totalAssigned
          });
        }

        setPracticeSets(setsWithStats);
      } catch (err) {
        console.error("Error fetching tutor practice sets:", err);
        setError(err instanceof Error ? err.message : "Failed to load practice sets");
      } finally {
        setLoading(false);
      }
    };

    fetchTutorPracticeSets();
  }, []);

  return { practiceSets, loading, error };
};
