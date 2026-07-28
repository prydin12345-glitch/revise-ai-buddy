import { useEffect, useMemo, useState } from "react";
import { useTelemetry, alpha } from "./tokens";

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
    { key: "d", label: "DAYS", value: days, fraction: Math.min(days, DAY_WINDOW) / DAY_WINDOW },
    { key: "h", label: "HOURS", value: hours, fraction: hours / 24 },
    { key: "m", label: "MINS", value: minutes, fraction: minutes / 60 },
    { key: "s", label: "SECS", value: seconds, fraction: seconds / 60 },
  ];
};

/**
 * Four minimalist rings — thin subtle track, crisp accent arc, bold centered
 * numeral, and uppercase wide-tracked sub-label. Matches the reference.
 */
export const CountdownRings = ({ target, accent, size = 72 }: Props) => {
  const TELEMETRY = useTelemetry();
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

  const STROKE = 2;
  const R = size / 2 - STROKE;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="flex items-start justify-between gap-1.5 w-full" aria-live="off">
      {units.map((u) => (
        <div key={u.key} className="flex flex-col items-center flex-1 min-w-0">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={R}
                fill="none"
                stroke={alpha(TELEMETRY.muted, 0.18)}
                strokeWidth={STROKE}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={R}
                fill="none"
                stroke={accent}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(u.fraction, 0) * CIRC} ${CIRC}`}
                style={{
                  transition: u.key === "s" ? undefined : "stroke-dasharray 0.4s ease",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[22px] font-bold tabular-nums leading-none tracking-tight text-foreground"
              >
                {elapsed ? 0 : u.value}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold mt-2 uppercase tracking-widest text-muted-foreground">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
};
