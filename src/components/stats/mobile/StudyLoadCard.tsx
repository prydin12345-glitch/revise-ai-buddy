import { useMemo } from "react";
import { Activity } from "lucide-react";
import { useTelemetry } from "./tokens";

interface Props {
  /** studyActivityData: [{ day: "Monday", Maths: 1.5, Physics: 0.5 }, ...] */
  data: Array<Record<string, any>>;
  subjects: { name: string; color: string }[];
}

const DAY_INITIAL: Record<string, string> = {
  Monday: "M", Tuesday: "T", Wednesday: "W", Thursday: "T",
  Friday: "F", Saturday: "S", Sunday: "S",
};

export const StudyLoadCard = ({ data, subjects }: Props) => {
  const TELEMETRY = useTelemetry();

  const { days, max, total, busiest, present } = useMemo(() => {
    const colourOf = new Map(subjects.map((s) => [s.name, s.color]));

    const days = data.map((row) => {
      const segments = Object.entries(row)
        .filter(([k, v]) => k !== "day" && typeof v === "number" && v > 0)
        .map(([name, hours]) => ({
          name,
          hours: hours as number,
          color: colourOf.get(name) ?? TELEMETRY.gray,
        }))
        .sort((a, b) => b.hours - a.hours);

      return {
        day: row.day as string,
        segments,
        total: segments.reduce((sum, s) => sum + s.hours, 0),
      };
    });

    const max = Math.max(...days.map((d) => d.total), 0);
    const total = days.reduce((sum, d) => sum + d.total, 0);
    const busiest = days.reduce<(typeof days)[number] | null>(
      (best, d) => (d.total > (best?.total ?? 0) ? d : best),
      null
    );
    const present = [...new Set(days.flatMap((d) => d.segments.map((s) => s.name)))];

    return { days, max, total, busiest, present };
  }, [data, subjects, TELEMETRY.gray]);

  const fmt = (h: number) => (h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <Activity size={13} style={{ color: TELEMETRY.cyan }} />
            <span className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
              Study load
            </span>
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: TELEMETRY.muted }}>
            This week, by subject
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold tabular-nums leading-none" style={{ color: TELEMETRY.text }}>
            {total > 0 ? fmt(total) : "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: TELEMETRY.muted }}>
            total
          </div>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-[12px] py-6 text-center" style={{ color: TELEMETRY.muted }}>
          No study time logged this week yet.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2" style={{ height: 108 }}>
            {days.map((d) => {
              const heightPct = max > 0 ? (d.total / max) * 100 : 0;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[9px] tabular-nums" style={{ color: TELEMETRY.muted }}>
                    {d.total > 0 ? fmt(d.total) : ""}
                  </span>
                  <div
                    className="w-full rounded-md overflow-hidden flex flex-col-reverse"
                    style={{
                      height: `${Math.max(heightPct, d.total > 0 ? 6 : 2)}%`,
                      minHeight: 4,
                      background: d.total > 0 ? "transparent" : TELEMETRY.cardAlt,
                    }}
                  >
                    {d.segments.map((s) => (
                      <div
                        key={s.name}
                        style={{
                          height: `${(s.hours / d.total) * 100}%`,
                          background: s.color,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: TELEMETRY.muted }}>
                    {DAY_INITIAL[d.day] ?? d.day.slice(0, 1)}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-4 pt-3"
            style={{ borderTop: `1px solid ${TELEMETRY.border}` }}
          >
            {present.map((name) => {
              const colour = subjects.find((s) => s.name === name)?.color ?? TELEMETRY.gray;
              return (
                <span key={name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: colour }} />
                  <span className="text-[10px] capitalize" style={{ color: TELEMETRY.muted }}>{name}</span>
                </span>
              );
            })}
          </div>

          {busiest && busiest.total > 0 && (
            <p className="text-[11px] mt-2.5" style={{ color: TELEMETRY.muted }}>
              Heaviest day was {busiest.day} at {fmt(busiest.total)}.
            </p>
          )}
        </>
      )}
    </div>
  );
};
