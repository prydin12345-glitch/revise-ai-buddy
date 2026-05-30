// src/components/dashboard/SubjectDonut.tsx
// Subject statistics donut. Hover a segment OR a legend row → that subject's
// slice grows, the others dim, and the centre shows its name + %.
// Built on recharts. Subject colours are user content → passed as data (inline).
import { useState } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import { ChevronRight } from "lucide-react";
import type { Subject } from "./types";

interface SubjectDonutProps {
  subjects: Subject[];
  /** Centre value when nothing is hovered, e.g. "73%". */
  centerValue?: string;
  centerLabel?: string;
}

const activeShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius} outerRadius={outerRadius + 5}
      startAngle={startAngle} endAngle={endAngle}
      cornerRadius={6} fill={fill}
    />
  );
};

export default function SubjectDonut({
  subjects, centerValue = "73%", centerLabel = "Average score",
}: SubjectDonutProps) {
  const [active, setActive] = useState<number | null>(null);
  const current = active != null ? subjects[active] : null;

  return (
    <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-base font-bold">Statistics by subject</h2>
      </div>
      <p className="mb-3.5 text-[12.5px] font-semibold text-muted-foreground">
        Share of your study time · hover for detail
      </p>

      <div className="flex flex-col items-center">
        {/* donut */}
        <div className="relative h-[196px] w-[196px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={subjects}
                dataKey="pct"
                nameKey="name"
                cx="50%" cy="50%"
                innerRadius={64} outerRadius={92}
                paddingAngle={3} cornerRadius={6} stroke="none"
                activeIndex={active ?? undefined}
                activeShape={activeShape}
                onMouseEnter={(_, i) => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {subjects.map((s, i) => (
                  <Cell
                    key={s.key}
                    fill={s.color}
                    opacity={active == null || active === i ? 1 : 0.3}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* centre */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[32px] font-extrabold leading-none tracking-tight"
              style={current ? { color: current.color } : undefined}
            >
              {current ? `${current.pct}%` : centerValue}
            </span>
            <span className="mt-1.5 text-[11.5px] font-semibold text-muted-foreground">
              {current ? current.name : centerLabel}
            </span>
          </div>
        </div>

        {/* legend with per-subject bars */}
        <div className="mt-5 w-full space-y-1">
          {subjects.map((s, i) => (
            <div
              key={s.key}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className="cursor-default rounded-[10px] px-1.5 py-2 transition-colors hover:bg-panel-2"
            >
              <div className="flex items-center justify-between gap-2.5">
                <span className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span
                  className="text-[13px] font-extrabold tabular-nums text-muted-foreground"
                  style={active === i ? { color: s.color } : undefined}
                >
                  {s.pct}%
                </span>
              </div>
              <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${s.pct}%`,
                    background: s.color,
                    opacity: active == null || active === i ? 1 : 0.4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
