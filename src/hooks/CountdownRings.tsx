import { useEffect, useMemo, useState } from "react";
import { useTelemetry, alpha } from "./tokens";

interface Props {
  /** ISO datetime being counted down to. */
  target: string;
  /** Subject theme colour — drives every ring. */
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
    { key: "d", label: "Days", value: days, fraction: Math.min(days, DAY_WINDOW) / DAY_WINDOW },
    { key: "h", label: "Hours", value: hours, fraction: hours / 24 },
    { key: "m", label: "Minutes", value: minutes, fraction: minutes / 60 },
    { key: "s", label: "Seconds", value: seconds, fraction: seconds / 60 },
  ];
};

/**
 * Four rings, each showing its unit's position within its own cycle — so the
 * seconds ring sweeps once a minute, the minutes ring once an hour, and so on.
 * The whole set is tinted with the subject's colour.
 */
export const CountdownRings = ({ target, accent, size = 68 }: Props) => {
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

  const R = size / 2 - 4;
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
                stroke={alpha(accent, 0.18)}
                strokeWidth={3}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={R}
                fill="none"
                stroke={accent}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(u.fraction, 0) * CIRC} ${CIRC}`}
                style={{
                  // No transition on seconds — it would smear the tick.
                  transition: u.key === "s" ? undefined : "stroke-dasharray 0.4s ease",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[19px] font-bold tabular-nums leading-none"
                style={{ color: TELEMETRY.text }}
              >
                {elapsed ? 0 : u.value}
              </span>
            </div>
          </div>
          <span
            className="text-[9px] mt-1.5 tracking-wide truncate w-full text-center"
            style={{ color: TELEMETRY.muted }}
          >
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
};
