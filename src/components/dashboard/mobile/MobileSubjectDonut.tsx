// src/components/dashboard/mobile/MobileSubjectDonut.tsx
// Headerless recharts donut (the pager tab is the title). Shares the Subject
// type + colour logic with the desktop SubjectDonut.
import { useState } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import type { Subject } from "../types";

const activeShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5}
      startAngle={startAngle} endAngle={endAngle} cornerRadius={6} fill={fill} />
  );
};

interface Props {
  subjects: Subject[];
  centerValue?: string;
  centerLabel?: string;
}

export default function MobileSubjectDonut({ subjects, centerValue = "73%", centerLabel = "Average" }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const current = active != null ? subjects[active] : null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[180px] w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={subjects} dataKey="pct" nameKey="name"
              cx="50%" cy="50%" innerRadius={58} outerRadius={84}
              paddingAngle={3} cornerRadius={6} stroke="none"
              activeIndex={active ?? undefined} activeShape={activeShape}
              onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}
            >
              {subjects.map((s, i) => (
                <Cell key={s.key} fill={s.color} opacity={active == null || active === i ? 1 : 0.3} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-extrabold leading-none tracking-tight" style={current ? { color: current.color } : undefined}>
            {current ? `${current.pct}%` : centerValue}
          </span>
          <span className="mt-1 text-[11.5px] font-semibold text-muted-foreground">
            {current ? current.name : centerLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 w-full space-y-1">
        {subjects.map((s, i) => (
          <div
            key={s.key}
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            className="rounded-[10px] px-1.5 py-2 transition-colors hover:bg-panel-2"
          >
            <div className="flex items-center justify-between gap-2.5">
              <span className="flex items-center gap-2.5 text-[13px] font-semibold">
                <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="text-[13px] font-extrabold tabular-nums text-muted-foreground" style={active === i ? { color: s.color } : undefined}>
                {s.pct}%
              </span>
            </div>
            <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: s.color, opacity: active == null || active === i ? 1 : 0.4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
