import { useEffect, useMemo, useState } from "react";

interface Props {
  /** ISO datetime being counted down to. */
  target: string;
  /** Subject theme colour — drives the active arc. */
  accent: string;
  size?: number;
}

interface Unit {
  key: string;
  label: string;
  value: number;
  /** 0..1 fill for this ring. */
  fraction: number;
}

const DAY_WINDOW = 365;

const breakdown = (msRemaining: number): Unit[] => {
  const ms = Math.max(0, msRemaining);
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    {
      key: "d",
      label: "DAYS",
      value: days,
      fraction: Math.min(days, DAY_WINDOW) / DAY_WINDOW,
    },
    { key: "h", label: "HOURS", value: hours, fraction: hours / 24 },
    { key: "m", label: "MINS", value: minutes, fraction: minutes / 60 },
    { key: "s", label: "SECS", value: seconds, fraction: seconds / 60 },
  ];
};

/** Existing countdown values in a compact, readable four-unit layout. */
export const CountdownRings = ({ target }: Props) => {
  const [now, setNow] = useState(() => Date.now());

  const targetMs = useMemo(() => new Date(target).getTime(), [target]);
  const remaining = targetMs - now;
  const elapsed = remaining <= 0;

  useEffect(() => {
    if (elapsed) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [elapsed]);

  const units = useMemo(() => breakdown(remaining), [remaining]);

  return (
    <div
      className="grid w-full grid-cols-4 divide-x divide-border rounded-lg border border-border py-3"
      aria-live="off"
      aria-label="Time until the scheduled exam"
    >
      {units.map((u) => (
        <div key={u.key} className="flex min-w-0 flex-col items-center gap-1">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {elapsed ? 0 : u.value}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {u.label.toLowerCase()}
          </span>
        </div>
      ))}
    </div>
  );
};
