import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorkspaceSession } from '@/hooks/use-workspace-session';

type Position = { top: number; rows: Record<string, number> };

/** Restore lists after their asynchronous content arrives, without touching exams. */
export function useWorkspaceScroll() {
  const { pathname, search } = useLocation();
  const { store } = useWorkspaceSession();
  useLayoutEffect(() => {
    const key = `scroll:${pathname}${search}`;
    const wanted = store.get<Position>(key, () => ({ top: 0, rows: {} }));
    let restoring = true;
    let frame = 0;
    const previousMode = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-restoration]'));
    const save = () => {
      if (restoring) return;
      const horizontal = Object.fromEntries(rows().map(row => [row.dataset.scrollRestoration!, row.scrollLeft]));
      store.set<Position>(key, { top: window.scrollY, rows: horizontal }, wanted);
    };
    const restore = () => {
      if (!restoring) return;
      window.scrollTo({ top: wanted.top, behavior: 'instant' as ScrollBehavior });
      let complete = Math.abs(window.scrollY - wanted.top) < 2;
      for (const [id, left] of Object.entries(wanted.rows)) {
        const row = rows().find(item => item.dataset.scrollRestoration === id);
        if (!row) { complete = false; continue; }
        row.scrollLeft = left;
        if (Math.abs(row.scrollLeft - left) >= 2) complete = false;
      }
      if (complete) restoring = false;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(restore); };
    const cancelRestore = () => { restoring = false; save(); };
    const top = () => { restoring = false; store.set<Position>(key, { top: 0, rows: wanted.rows }, wanted); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    resize?.observe(document.body);
    document.addEventListener('scroll', save, true);
    window.addEventListener('wheel', cancelRestore, { passive: true });
    window.addEventListener('touchstart', cancelRestore, { passive: true });
    window.addEventListener('keydown', cancelRestore);
    window.addEventListener('examly:scroll-top', top);
    schedule();
    return () => {
      save(); cancelAnimationFrame(frame); observer.disconnect(); resize?.disconnect();
      document.removeEventListener('scroll', save, true);
      window.removeEventListener('wheel', cancelRestore);
      window.removeEventListener('touchstart', cancelRestore);
      window.removeEventListener('keydown', cancelRestore);
      window.removeEventListener('examly:scroll-top', top);
      window.history.scrollRestoration = previousMode;
    };
  }, [pathname, search, store]);
}
