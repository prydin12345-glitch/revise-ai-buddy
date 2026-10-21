import { supabase } from "@/integrations/supabase/client";
import type { WorkspaceStore } from "@/hooks/use-workspace-session";
import type { ExamProfile, MasterTopic } from "@/hooks/useSubjectProfiles";
import { workspaceUser, boundedQuery } from "./workspace-query-client";

export const rolesQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["workspace-roles"],
  queryFn: async () => {
    const user = await workspaceUser(store);
    if (!user) return [];
    const { data, error } = await supabase.from("user_roles").select("role, metadata").eq("user_id", user.id).eq("is_active", true);
    if (error) throw error;
    return data || [];
  },
});

export const subjectsQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["workspace-subjects"],
  queryFn: async () => {
    const user = await workspaceUser(store);
    if (!user) return [];
    const { data, error } = await supabase.from("user_subjects").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },
});

export const profilesQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["workspace-profiles"],
  queryFn: async () => {
    const user = await workspaceUser(store);
    if (!user) return { masterTopics: [] as MasterTopic[], examProfiles: [] as ExamProfile[] };
    const [topics, profiles] = await Promise.all([
      supabase.from("subject_master_topics").select("*").eq("user_id", user.id).order("topic"),
      supabase.from("subject_exam_profiles").select("*").eq("user_id", user.id).order("created_at"),
    ]);
    if (topics.error) throw topics.error;
    if (profiles.error) throw profiles.error;
    return { masterTopics: (topics.data || []) as MasterTopic[], examProfiles: (profiles.data || []) as unknown as ExamProfile[] };
  },
});
