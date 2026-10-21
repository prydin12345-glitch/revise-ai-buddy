import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WorkspaceStore } from "@/hooks/use-workspace-session";

/** Memory only, owned by one sign-in generation. Never cache assessment answers here. */
export function workspaceQueryClient(store: WorkspaceStore) {
  return store.get("workspace:query-client", () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: true } } }));
}

export const workspaceUserQuery = (store: WorkspaceStore) => boundedQuery({
  queryKey: ["verified-workspace-user"],
  queryFn: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (store.ownerId && user?.id !== store.ownerId) throw new Error("Your account changed. Reopen this page.");
    return user;
  },
});

export async function workspaceUser(store: WorkspaceStore) {
  return workspaceQueryClient(store).fetchQuery(workspaceUserQuery(store));
}

/** A stalled metadata read must become a retryable error, not an endless route transition. */
export function boundedQuery<T>(options: { queryKey: QueryKey; queryFn: () => Promise<T> }) {
  return { ...options, queryFn: () => new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("This page took too long to load. Please retry.")), 15_000);
    Promise.resolve().then(options.queryFn).then(resolve, reject).finally(() => clearTimeout(timer));
  }) };
}
