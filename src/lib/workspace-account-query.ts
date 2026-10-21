import { supabase } from "@/integrations/supabase/client";
import { boundedQuery, workspaceUser } from "./workspace-query-client";
import type { WorkspaceStore } from "@/hooks/use-workspace-session";

export async function workspaceAvatarUrl(path: string | null) {
  if (!path || /^https?:\/\//.test(path)) return path;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl || null;
}

/** Read existing account details only. Never create preferences, upload, or save during navigation. */
export const accountQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["workspace-account"],
  queryFn: async () => {
    const user = await workspaceUser(store);
    if (!user) throw new Error("Sign in to view your account.");
    const { data: profile, error } = await supabase.from("user_profiles").select("first_name, last_name, display_name, student_code, avatar_url").eq("id", user.id).single();
    if (error) throw error;
    return { user: { id: user.id, email: user.email || "" }, profile, avatarUrl: await workspaceAvatarUrl(profile?.avatar_url || null) };
  },
});
