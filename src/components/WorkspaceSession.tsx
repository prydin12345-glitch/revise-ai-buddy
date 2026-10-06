import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceContext, WorkspaceStore } from '@/hooks/use-workspace-session';

export function WorkspaceSession({ children }: { children: ReactNode }) {
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
  const value = useMemo(() => ({ ownerId, ready, store }), [ownerId, ready, store]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
