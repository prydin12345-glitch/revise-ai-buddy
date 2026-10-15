import { useRef, type MouseEvent, type TouchEvent } from 'react';
import { adjacentStatsSection, type StatsSection } from '@/lib/dashboard-stats';

const BLOCKED = 'input,textarea,select,a,[contenteditable="true"],[role="slider"],[data-stats-no-swipe]';

/** Observe only: never cancel vertical page scrolling, native editors or pinch zoom. */
export function useStatsSwipe(section: StatsSection | null, onNavigate: (section: StatsSection) => void, enabled: boolean, onSwipe?: () => void) {
  const gesture = useRef<{ id: number; x: number; y: number; cancelled: boolean } | null>(null);
  const suppressClickUntil = useRef(0);
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      gesture.current = null;
      suppressClickUntil.current = 0;
      if (!enabled || !section || event.touches.length !== 1 || (event.target instanceof Element && event.target.closest(BLOCKED)) || window.getSelection()?.toString()) return;
      const touch = event.touches[0];
      // Leave the browser's edge/back gestures alone.
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      gesture.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY, cancelled: false };
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      const start = gesture.current;
      if (!start) return;
      if (event.touches.length !== 1) { gesture.current = null; return; }
      const touch = event.touches[0];
      if (touch.identifier !== start.id) { gesture.current = null; return; }
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      if (dy > 12 && dy > dx) start.cancelled = true;
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const start = gesture.current;
      gesture.current = null;
      if (!start || start.cancelled || !section || event.touches.length > 0 || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      if (touch.identifier !== start.id) return;
      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);
      if (Math.abs(dx) < 64 || dy > 40 || Math.abs(dx) <= dy * 1.5) return;
      onSwipe?.();
      const next = adjacentStatsSection(section, dx);
      if (next) {
        // Date cells and bars remain tappable, but a committed swipe must not also tap them.
        if (event.cancelable) event.preventDefault();
        suppressClickUntil.current = Date.now() + 400;
        onNavigate(next);
      }
    },
    onTouchCancel() { gesture.current = null; },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (event.detail > 0 && Date.now() < suppressClickUntil.current) {
        suppressClickUntil.current = 0;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
