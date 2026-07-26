import { useEffect, useState } from "react";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { supabase } from "@/integrations/supabase/client";
import { SubjectCard } from "./SubjectCard";
import { BookOpen } from "lucide-react";

export const SubjectsList = () => {
  const { subjects, isLoading } = useUserSubjects();
  const [profileCounts, setProfileCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("subject_exam_profiles")
        .select("subject_name")
        .eq("user_id", user.id);
      if (cancelled || !data) return;
      const counts: Record<string, number> = {};
      for (const row of data as any[]) {
        const k = row.subject_name;
        counts[k] = (counts[k] || 0) + 1;
      }
      setProfileCounts(counts);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
          <BookOpen className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="text-sm font-semibold text-foreground mb-1">No subjects yet</div>
        <p className="text-xs text-muted-foreground">Add a subject from the dashboard to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {subjects.map((s) => (
        <SubjectCard
          key={s.id}
          subject={s as any}
          profileCount={profileCounts[s.subject_name] || 0}
        />
      ))}
    </div>
  );
};
