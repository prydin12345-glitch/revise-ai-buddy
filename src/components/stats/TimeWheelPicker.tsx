// FILE: src/components/stats/TimeWheelPicker.tsx
// iPhone-timer-style vertical scroll wheel for the exam time limit.
// Scroll-snap centres a value; the centred value is selected live.
// Props unchanged from the previous picker: value "" = no limit.

import { useRef, useEffect, useMemo, useCallback } from "react";

interface TimeWheelPickerProps {
  value: string;
  onChange: (value: string) => void;
  subjectColor: string;
}

const ITEM_H = 36;

export function TimeWheelPicker({ value, onChange, subjectColor }: TimeWheelPickerProps) {
  const options = useMemo(() => {
    const mins: Array<number | null> = [null];
    for (let m = 5; m <= 240; m += 5) mins.push(m);
    return mins;
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppress = useRef(false);

  const indexOfValue = useCallback(
    (v: string) => {
      const n = v ? parseInt(v) : null;
      const i = options.findIndex((o) => o === n);
      return i === -1 ? 0 : i;
    },
    [options]
  );

  // Position the wheel when the external value changes (e.g. editing a profile)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = indexOfValue(value) * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) {
      suppress.current = true;
      el.scrollTo({ top: target });
      setTimeout(() => { suppress.current = false; }, 80);
    }
  }, [value, indexOfValue]);

  const handleScroll = () => {
    if (suppress.current) return;
    const el = scrollRef.current;
    if (!el) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const idx = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_H)));
      const opt = options[idx];
      onChange(opt === null ? "" : String(opt));
    }, 90);
  };

  return (
    <div className="relative h-[148px] rounded-xl border border-border/60 bg-background overflow-hidden select-none">
      {/* Centre selection band */}
      <div
        className="pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 rounded-lg border"
        style={{ height: ITEM_H, borderColor: subjectColor + "66", backgroundColor: subjectColor + "0D" }}
      />
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent z-10" />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar"
        style={{ paddingTop: (148 - ITEM_H) / 2, paddingBottom: (148 - ITEM_H) / 2 }}
        role="listbox"
        aria-label="Time limit"
      >
        {options.map((opt) => {
          const isActive = (opt === null && !value) || (opt !== null && value === String(opt));
          return (
            <button
              key={opt ?? "none"}
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => {
                const el = scrollRef.current;
                el?.scrollTo({ top: indexOfValue(opt === null ? "" : String(opt)) * ITEM_H, behavior: "smooth" });
                onChange(opt === null ? "" : String(opt));
              }}
              className="w-full snap-center flex items-center justify-center text-sm transition-colors"
              style={{
                height: ITEM_H,
                color: isActive ? subjectColor : "hsl(var(--muted-foreground))",
                fontWeight: isActive ? 700 : 400,
              }}
            >
              {opt === null ? "No limit" : `${opt} min`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
