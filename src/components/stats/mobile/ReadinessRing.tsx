import { motion } from "framer-motion";
import { TELEMETRY, clampPct } from "./tokens";

interface Props {
  overall: number;      // 0..100
  coverage: number;     // 0..100
  consistency: number;  // 0..100
}

const SIZE = 220;
const CENTER = SIZE / 2;

const Ring = ({
  radius,
  value,
  color,
  delay,
}: {
  radius: number;
  value: number;
  color: string;
  delay: number;
}) => {
  const c = 2 * Math.PI * radius;
  const pct = clampPct(value) / 100;
  return (
    <>
      <circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={TELEMETRY.border}
        strokeWidth={10}
        fill="none"
      />
      <motion.circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
    </>
  );
};

export const ReadinessRing = ({ overall, coverage, consistency }: Props) => {
  const overallSafe = clampPct(overall);
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-3xl overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, hsl(220 12% 12%) 0%, hsl(220 10% 7%) 60%, hsl(220 10% 6%) 100%)",
        border: `1px solid ${TELEMETRY.border}`,
        padding: 20,
      }}
    >
      <div className="relative flex items-center justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Ring radius={96} value={overallSafe} color={TELEMETRY.lime} delay={0} />
          <Ring radius={76} value={coverage} color={TELEMETRY.cyan} delay={0.15} />
          <Ring radius={56} value={consistency} color={TELEMETRY.magenta} delay={0.3} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: TELEMETRY.muted }}
          >
            Readiness
          </span>
          <span
            className="text-5xl font-bold tabular-nums leading-none mt-1"
            style={{ color: TELEMETRY.text }}
          >
            {Math.round(overallSafe)}
            <span className="text-xl align-top ml-0.5" style={{ color: TELEMETRY.muted }}>
              %
            </span>
          </span>
        </div>
      </div>

      {/* Legend — moved BELOW the ring, no more overlap with arcs */}
      <div className="mt-5 flex items-center justify-center gap-4">
        {[
          { c: TELEMETRY.lime, l: "Mastery" },
          { c: TELEMETRY.cyan, l: "Coverage" },
          { c: TELEMETRY.magenta, l: "Streak" },
        ].map((x) => (
          <div key={x.l} className="flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: x.c, boxShadow: `0 0 6px ${x.c}` }}
            />
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{ color: TELEMETRY.muted }}
            >
              {x.l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
