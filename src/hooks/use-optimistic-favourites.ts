import { useRef, useState } from 'react';

export function useOptimisticFavourites(
  favourites: Set<string>,
  setFavourites: (update: (previous: Set<string>) => Set<string>) => void,
  save: (id: string, selected: boolean) => Promise<void>,
) {
  const locks = useRef(new Set<string>());
  const desired = useRef(new Map<string, boolean>());
  const version = useRef(0);
  const [pending, setPending] = useState(new Set<string>());
  const [failed, setFailed] = useState(new Set<string>());
  const latest = useRef(favourites);
  latest.current = favourites;
  const toggle = async (id: string) => {
    if (locks.current.has(id)) return;
    locks.current.add(id); setPending(new Set(locks.current));
    version.current += 1;
    setFailed(previous => { const next = new Set(previous); next.delete(id); return next; });
    const before = latest.current.has(id);
    desired.current.set(id, !before);
    const update = (selected: boolean) => setFavourites(previous => {
      const next = new Set(previous); if (selected) next.add(id); else next.delete(id); return next;
    });
    update(!before);
    try { await save(id, !before); }
    catch { update(before); setFailed(previous => new Set(previous).add(id)); }
    finally {
      // Also invalidate reads started during the write but completed afterwards.
      version.current += 1;
      locks.current.delete(id); desired.current.delete(id); setPending(new Set(locks.current));
    }
  };
  const reconcile = (server: Set<string>) => {
    const next = new Set(server);
    desired.current.forEach((selected, id) => { if (selected) next.add(id); else next.delete(id); });
    return next;
  };
  return { toggle, pending, failed, reconcile, version: () => version.current };
}
