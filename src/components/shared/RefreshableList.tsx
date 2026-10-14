import { canStartRefresh } from '@/lib/list-refresh';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

/** Only opted-in lists consume a downward pull; exam and form routes never do. */
export function RefreshableList({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const action = useRef(onRefresh);
  action.current = onRefresh;
  const inFlight = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setRefreshing(true); setError(false); setPull(0);
    try { await action.current(); } catch { setError(true); }
    finally { inFlight.current = false; setRefreshing(false); }
  }, []);
  useEffect(() => {
    const element = container.current;
    // Older browsers keep their native pull-to-refresh behaviour.
    if (!element || !CSS.supports('overscroll-behavior-y', 'contain')) return;
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = 'contain';
    let start: { x: number; y: number } | null = null;
    let distance = 0;
    const reset = () => { start = null; distance = 0; setPull(0); };
    const onStart = (event: TouchEvent) => {
      reset();
      if (event.touches.length !== 1 || inFlight.current || !canStartRefresh(event.target, element)) return;
      const touch = event.touches[0];
      // Leave both screen edges to browser navigation gestures.
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      start = { x: touch.clientX, y: touch.clientY };
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1 || window.scrollY > 0) { reset(); return; }
      const dy = event.touches[0].clientY - start.y;
      const dx = event.touches[0].clientX - start.x;
      if (dy < 0 || Math.abs(dx) > Math.abs(dy)) { reset(); return; }
      if (dy > 12) { if (event.cancelable) event.preventDefault(); distance = Math.min(100, dy * 0.5); setPull(distance); }
    };
    const onEnd = () => { const triggered = distance >= 72; reset(); if (triggered) void refresh(); };
    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: false });
    element.addEventListener('touchend', onEnd);
    element.addEventListener('touchcancel', reset);
    return () => {
      root.style.overscrollBehaviorY = previous;
      element.removeEventListener('touchstart', onStart); element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onEnd); element.removeEventListener('touchcancel', reset);
    };
  }, [refresh]);
  const message = refreshing ? 'Refreshing…' : pull ? pull >= 72 ? 'Release to refresh' : 'Pull to refresh' : error ? 'Couldn’t refresh. Pull down to try again.' : '';
  return <div ref={container} className="relative min-w-0">
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 overflow-hidden text-xs text-muted-foreground motion-safe:transition-[height]"
      style={{ height: refreshing || error ? 44 : pull ? Math.max(32, pull) : 0 }}>
      {refreshing ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : pull > 0 ? <RefreshCw aria-hidden="true" className="h-4 w-4" /> : null}
      {message}
    </div>
    {children}
  </div>;
}
