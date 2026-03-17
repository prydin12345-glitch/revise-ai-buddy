import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileDefaults {
  examBoard: string;
  educationalLevel: string;
  curriculumRegion: string;
}

export const useProfileDefaults = () => {
  const [defaults, setDefaults] = useState<ProfileDefaults>({
    examBoard: "",
    educationalLevel: "",
    curriculumRegion: "",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoaded(true); return; }

      const { data } = await supabase
        .from("user_preferences")
        .select("preferred_exam_board, preferred_educational_level, curriculum_region")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        setDefaults({
          examBoard: data.preferred_exam_board ?? "",
          educationalLevel: data.preferred_educational_level ?? "",
          curriculumRegion: data.curriculum_region ?? "",
        });
      }
      setLoaded(true);
    };

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { defaults, loaded };
};
