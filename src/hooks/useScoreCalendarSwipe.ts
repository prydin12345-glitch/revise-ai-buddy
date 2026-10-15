import { useRef, type MouseEvent, type TouchEvent } from 'react';

/** All-axis paging is limited to the date strip. The rest of the drawer scrolls normally. */
export function useScoreCalendarSwipe(onShift: (direction: -1 | 1) => void, enabled: boolean) {
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      gesture.current = null; suppressClickUntil.current = 0;
      if (!enabled || event.touches.length !== 1 || window.getSelection()?.toString()) return;
      const touch = event.touches[0];
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      gesture.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      if (event.touches.length !== 1 || event.touches[0].identifier !== gesture.current?.id) gesture.current = null;
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const start = gesture.current; gesture.current = null;
      if (!start || event.touches.length || event.changedTouches.length !== 1 || event.changedTouches[0].identifier !== start.id) return;
      const touch = event.changedTouches[0];
      const x = touch.clientX - start.x; const y = touch.clientY - start.y;
      const major = Math.abs(x) >= Math.abs(y) ? x : y;
      const minor = Math.min(Math.abs(x), Math.abs(y));
      if (Math.abs(major) < 54 || Math.abs(major) < minor * 1.3) return;
      if (event.cancelable) event.preventDefault();
      suppressClickUntil.current = Date.now() + 400;
      onShift(major < 0 ? -1 : 1);
    },
    onTouchCancel() { gesture.current = null; },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (event.detail > 0 && Date.now() < suppressClickUntil.current) {
        suppressClickUntil.current = 0; event.preventDefault(); event.stopPropagation();
      }
    },
  };
}
