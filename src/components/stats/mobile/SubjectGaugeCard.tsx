import { useState, useMemo } from "react";
import { Gauge } from "lucide-react";
import { useTelemetry, clampPct, scoreColor } from "./tokens";

interface Props {
  subjects: { name: string; color: string; avgScore: number; count: number }[];
  /** Topic counts for the selected subject, for the footer row. */
  topicStats?: (subject: string) => { mastered: number; developing: number; review: number };
}

const SEGMENTS = 26;
const CX = 110;
const CY = 108;
const R_INNER = 66;
const R_OUTER = 92;

const bandLabel = (pct: number) =>
  pct >= 75 ? "Strong" : pct >= 55 ? "On track" : pct >= 35 ? "Needs work" : "At risk";

export const SubjectGaugeCard = ({ subjects, topicStats }: Props) => {
  const TELEMETRY = useTelemetry();
  const [selected, setSelected] = useState<string | null>(null);

  const active = useMemo(
    () => subjects.find((s) => s.name === selected) ?? subjects[0] ?? null,
    [subjects, selected]
  );

  const segments = useMemo(() => {
    const pct = clampPct(active?.avgScore ?? 0);
    const lit = Math.round((pct / 100) * SEGMENTS);
    return Array.from({ length: SEGMENTS }, (_, i) => {
      const angle = ((180 + (i + 0.5) * (180 / SEGMENTS)) * Math.PI) / 180;
      return {
        x1: CX + R_INNER * Math.cos(angle),
        y1: CY + R_INNER * Math.sin(angle),
        x2: CX + R_OUTER * Math.cos(angle),
        y2: CY + R_OUTER * Math.sin(angle),
        lit: i < lit,
        // Ramp across the arc so the gauge reads as a scale, not a single colour.
        t: i / (SEGMENTS - 1),
      };
    });
  }, [active]);

  if (!active) {
    return (
      <div
        className="rounded-2xl p-6 text-center text-[13px]"
        style={{ background: TELEMETRY.card, border: `1px dashed ${TELEMETRY.border}`, color: TELEMETRY.muted }}
      >
        Sit an exam to see your subject accuracy gauge.
      </div>
    );
  }

  const pct = clampPct(active.avgScore);
  const tone = scoreColor(pct, TELEMETRY);
  const stats = topicStats?.(active.name);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Gauge size={13} style={{ color: TELEMETRY.mastered }} />
        <span className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
          Subject accuracy
        </span>
      </div>

      {subjects.length > 1 && (
        <div className="-mx-1 overflow-x-auto no-scrollbar mt-3">
          <div className="flex items-center gap-1.5 px-1 pb-1">
            {subjects.map((s) => {
              const on = s.name === active.name;
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSelected(s.name)}
                  className="shrink-0 min-h-[32px] px-2.5 rounded-full text-[11px] font-medium whitespace-nowrap capitalize flex items-center gap-1.5"
                  style={{
                    color: on ? TELEMETRY.text : TELEMETRY.muted,
                    background: on ? TELEMETRY.cardAlt : "transparent",
                    border: `1px solid ${on ? s.color : "transparent"}`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative flex justify-center mt-1">
        <svg viewBox="0 0 220 124" className="w-full" style={{ maxWidth: 260 }}>
          {segments.map((s, i) => (
            <line
              key={i}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              strokeWidth={7}
              strokeLinecap="round"
              stroke={s.lit ? tone : TELEMETRY.cardAlt}
              opacity={s.lit ? 0.45 + 0.55 * s.t : 1}
            />
          ))}
        </svg>

        <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: "46%" }}>
          <span className="text-[11px] font-semibold" style={{ color: tone }}>
            {bandLabel(pct)}
          </span>
          <span className="text-[34px] font-bold tabular-nums leading-none mt-0.5" style={{ color: TELEMETRY.text }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>

      <div
        className="grid grid-cols-3 gap-2 mt-3 pt-3"
        style={{ borderTop: `1px solid ${TELEMETRY.border}` }}
      >
        {([
          ["Exams", String(active.count), TELEMETRY.text],
          ["Mastered", stats ? String(stats.mastered) : "—", TELEMETRY.mastered],
          ["To review", stats ? String(stats.review) : "—", TELEMETRY.review],
        ] as const).map(([label, value, colour]) => (
          <div key={label} className="text-center">
            <div className="text-[17px] font-semibold tabular-nums" style={{ color: colour }}>{value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: TELEMETRY.muted }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
