import { workspaceQueryClient } from "@/lib/workspace-query-client";
import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceContext, WorkspaceStore } from '@/hooks/use-workspace-session';

export function WorkspaceSession({ children }: { children: ReactNode }) {
  const applicationClient = useContext(QueryClientContext);
  const [identity, setIdentity] = useState({ ownerId: null as string | null, generation: 0 });
  const ownerId = identity.ownerId;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    let authEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && _event !== 'SIGNED_OUT' && _event !== 'INITIAL_SESSION') return;
      authEventReceived = true;
      if (alive) {
        const id = session?.user.id ?? null;
        setIdentity(previous => previous.ownerId === id && _event !== 'SIGNED_OUT' ? previous : { ownerId: id, generation: previous.generation + 1 });
        setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (alive && !authEventReceived) { setIdentity({ ownerId: session?.user.id ?? null, generation: 1 }); setReady(true); }
    }).catch(() => { if (alive) setReady(true); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  // A different account gets a fresh store, including after signing out and in.
  const store = useMemo(() => new WorkspaceStore(ownerId, identity.generation), [ownerId, identity.generation]);
  useEffect(() => {
    const client = workspaceQueryClient(store);
    return () => {
      void client.cancelQueries();
      client.clear();
      // These older dashboard reads use the application cache. Drop them even
      // when the same person signs out and signs back in during this session.
      const ownedSummary = { predicate: (query: { queryKey: readonly unknown[] }) =>
        ["student-dashboard", "workspace-sidebar-account"].includes(String(query.queryKey[0])) && query.queryKey[1] === store.ownerId };
      void applicationClient?.cancelQueries(ownedSummary);
      applicationClient?.removeQueries(ownedSummary);
    };
  }, [store, applicationClient]);
  const value = useMemo(() => ({ ownerId, ready, store }), [ownerId, ready, store]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
