import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rolesQuery } from "@/lib/workspace-summary-queries";
import { useWorkspaceQueryScope } from "./use-workspace-query-client";

type AppRole = "student" | "teacher" | "tutor" | "admin";
export const useUserRole = () => {
  const { store, client } = useWorkspaceQueryScope();
  const query = useQuery(rolesQuery(store), client);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user.id === store.ownerId) void client.invalidateQueries({ queryKey: ["workspace-roles"] }, { cancelRefetch: false });
    });
    return () => subscription.unsubscribe();
  }, [client, store]);
  const data = query.data || [];
  const roles = data.map(row => row.role as AppRole);
  const primary = data.find(row => (row.metadata as Record<string, unknown> | null)?.is_primary === true);
  return { roles, primaryRole: primary ? primary.role as AppRole : roles[0] || null, loading: query.isPending, error: query.error, retry: () => query.refetch({ cancelRefetch: false }), hasRole: (role: AppRole) => roles.includes(role) };
};
