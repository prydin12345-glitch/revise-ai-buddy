import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RangeChips } from "./RangeChips";
import { TELEMETRY } from "./tokens";

interface Props {
  data: Array<Record<string, any>>;
  subjects: { name: string; color: string }[];
  timeRange: "weekly" | "monthly" | "yearly";
  onTimeRangeChange: (v: "weekly" | "monthly" | "yearly") => void;
}

/** Collapse multi-subject rows into a single overall average per period. */
const flatten = (rows: Props["data"]) =>
  rows.map((row) => {
    const nums = Object.entries(row)
      .filter(([k, v]) => k !== "period" && typeof v === "number")
      .map(([, v]) => v as number);
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    return { period: row.period as string, score: Math.round(avg), _empty: nums.length === 0 };
  });

export const ScoreTrendCard = ({ data, timeRange, onTimeRangeChange }: Props) => {
  const flat = flatten(data);
  const hasData = flat.some((r) => !r._empty);
  const lastIdx = flat.length - 1;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: TELEMETRY.muted }}>
            Score Trends
          </div>
          <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
            Performance Over Time
          </div>
        </div>
        <RangeChips value={timeRange} onChange={onTimeRangeChange} />
      </div>

      <div style={{ height: 180 }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={flat} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TELEMETRY.lime} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={TELEMETRY.lime} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={TELEMETRY.border} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fill: TELEMETRY.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: TELEMETRY.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ stroke: TELEMETRY.borderSoft, strokeWidth: 1 }}
                contentStyle={{
                  background: TELEMETRY.cardAlt,
                  border: `1px solid ${TELEMETRY.border}`,
                  borderRadius: 10,
                  color: TELEMETRY.text,
                  fontSize: 12,
                }}
                labelStyle={{ color: TELEMETRY.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}
                formatter={(v: any) => [`${v}%`, "Score"]}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke={TELEMETRY.lime}
                strokeWidth={2}
                fill="url(#scoreFill)"
                dot={(props: any) =>
                  props.index === lastIdx ? (
                    <g key={props.index}>
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={7}
                        fill={TELEMETRY.lime}
                        opacity={0.18}
                      />
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={3.5}
                        fill={TELEMETRY.lime}
                        stroke={TELEMETRY.bg}
                        strokeWidth={1.5}
                      />
                    </g>
                  ) : (
                    <g key={props.index} />
                  )
                }
                activeDot={{ r: 5, fill: TELEMETRY.lime, stroke: TELEMETRY.bg, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="h-full flex items-center justify-center text-xs"
            style={{ color: TELEMETRY.muted }}
          >
            No scores in this range yet
          </div>
        )}
      </div>
    </div>
  );
};
