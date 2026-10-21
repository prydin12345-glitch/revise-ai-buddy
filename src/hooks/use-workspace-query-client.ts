import { useEffect, useState } from "react";
import { WorkspaceStore, useWorkspaceSession } from "./use-workspace-session";
import { workspaceQueryClient } from "@/lib/workspace-query-client";

/** Standalone consumers have their own cache; authenticated pages share the session's cache. */
export function useWorkspaceQueryScope() {
  const session = useWorkspaceSession();
  const [standalone] = useState(() => new WorkspaceStore());
  const store = session.ownerId ? session.store : standalone;
  const client = workspaceQueryClient(store);
  useEffect(() => {
    client.mount();
    return () => { client.unmount(); if (!session.ownerId) client.clear(); };
  }, [client, session.ownerId]);
  return { ...session, store, client };
}
