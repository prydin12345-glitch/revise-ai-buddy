import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceSession } from '@/hooks/use-workspace-session';
import { readSetupDraft, writeSetupDraft, setupDraftKey, type SetupValues } from '@/lib/setup-draft';

export function useSetupDraft<T extends SetupValues>({ item, values, restore, dirty, enabled = true }: {
  item: string; values: T; restore: (values: T) => void; dirty: boolean; enabled?: boolean;
}) {
  const { ownerId, ready } = useWorkspaceSession();
  const initial = useRef(values);
  const latest = useRef({ values, restore, dirty, ownerId, item });
  latest.current = { values, restore, dirty, ownerId, item };
  const hydrated = useRef('');
  const cleared = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [restored, setRestored] = useState(false);
  const [retry, setRetry] = useState(0);
  const fingerprint = JSON.stringify(values);

  const persist = useCallback(() => {
    if (!ownerId || latest.current.ownerId !== ownerId || latest.current.item !== item || !enabled || !latest.current.dirty || cleared.current === JSON.stringify(latest.current.values)) return;
    try { writeSetupDraft(sessionStorage, ownerId, item, latest.current.values); setStatus('saved'); }
    catch { setStatus('error'); }
  }, [ownerId, enabled, item]);

  useEffect(() => {
    if (!ready || !ownerId) return;
    const scope = setupDraftKey(ownerId, item);
    if (hydrated.current === scope) return;
    const changingAccount = hydrated.current !== '';
    hydrated.current = scope; cleared.current = null; setRestored(false); setStatus('idle');
    try {
      const saved = readSetupDraft(sessionStorage, ownerId, item, initial.current);
      // Never overwrite text typed while the initial auth lookup was pending.
      if (saved && (!latest.current.dirty || changingAccount)) { latest.current.restore(saved as T); setRestored(true); }
      else if (changingAccount) latest.current.restore(initial.current);
    } catch { setStatus('error'); }
  }, [ready, ownerId, item]);

  useEffect(() => {
    if (!ownerId || !enabled || !dirty || hydrated.current !== setupDraftKey(ownerId, item) || cleared.current === fingerprint) return;
    setStatus('saving');
    timer.current = setTimeout(persist, 400);
    return () => clearTimeout(timer.current);
  }, [ownerId, enabled, dirty, item, fingerprint, persist, retry]);

  useEffect(() => {
    const flush = () => { clearTimeout(timer.current); persist(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [persist]);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    cleared.current = JSON.stringify(latest.current.values);
    try { if (ownerId) sessionStorage.removeItem(setupDraftKey(ownerId, item)); setStatus('idle'); setRestored(false); }
    catch { setStatus('error'); }
  }, [ownerId, item]);
  return { status, restored, clear, retry: () => setRetry(value => value + 1), discard: () => { clear(); latest.current.restore(initial.current as T); cleared.current = JSON.stringify(initial.current); } };
}
