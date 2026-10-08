import type { CSSProperties } from "react";

/** A proportion, never a decorative or invented trend. Text remains the primary value. */
export function StatsGauge({
  value,
  label,
  shape = "semicircle",
  colour = "var(--stats-series-1)",
  valueLabel,
}: {
  value: number | null;
  label: string;
  shape?: "semicircle" | "ring";
  colour?: string;
  valueLabel?: string;
}) {
  const pct =
    value === null || !Number.isFinite(value)
      ? null
      : Math.max(0, Math.min(100, value));
  const display = valueLabel ?? (pct === null ? "—" : `${Math.round(pct)}%`);
  return (
    <span
      className="stats-gauge"
      data-shape={shape}
      style={{ "--gauge-colour": colour } as CSSProperties}
      role={pct === null ? "img" : "meter"}
      aria-label={pct === null ? `${label}: no data` : label}
      aria-valuemin={pct === null ? undefined : 0}
      aria-valuemax={pct === null ? undefined : 100}
      aria-valuenow={pct ?? undefined}
      aria-valuetext={pct === null ? undefined : display}
    >
      <svg
        viewBox={shape === "ring" ? "0 0 160 160" : "0 0 180 112"}
        aria-hidden="true"
      >
        {shape === "ring" ? (
          <>
            <circle cx="80" cy="80" r="73" className="stats-gauge-rim" />
            <circle cx="80" cy="80" r="52" className="stats-gauge-centre" />
            <circle
              cx="80"
              cy="80"
              r="62"
              className="stats-gauge-track"
              strokeWidth="18"
              fill="none"
            />
            {pct !== null && pct > 0 && (
              <circle
                cx="80"
                cy="80"
                r="62"
                pathLength="100"
                stroke={colour}
                strokeWidth="18"
                fill="none"
                strokeDasharray={`${pct} 100`}
                transform="rotate(-90 80 80)"
              />
            )}
          </>
        ) : (
          <>
            <path
              d="M20 90 A70 70 0 0 1 160 90"
              className="stats-gauge-track"
              strokeWidth="23"
              fill="none"
            />
            {pct !== null && pct > 0 && (
              <path
                d="M20 90 A70 70 0 0 1 160 90"
                pathLength="100"
                stroke={colour}
                strokeWidth="23"
                fill="none"
                strokeDasharray={`${pct} 100`}
              />
            )}
            <line
              x1="20"
              x2="160"
              y1="105"
              y2="105"
              stroke={colour}
              strokeWidth="2"
            />
          </>
        )}
        <text
          x={shape === "ring" ? "80" : "90"}
          y={shape === "ring" ? "87" : "85"}
          textAnchor="middle"
          className="stats-gauge-value"
        >
          {display}
        </text>
      </svg>
    </span>
  );
}
