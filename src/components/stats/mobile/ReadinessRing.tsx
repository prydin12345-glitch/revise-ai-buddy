import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { useTelemetry, clampPct } from "./tokens";

interface Props {
  overall: number;      // 0..100
  coverage: number;     // 0..100
  consistency: number;  // 0..100
  onInfo?: () => void;
}

const SIZE = 208;
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
  const TELEMETRY = useTelemetry();
  const c = 2 * Math.PI * radius;
  const pct = clampPct(value) / 100;
  return (
    <>
      <circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={TELEMETRY.border}
        strokeWidth={8}
        fill="none"
      />
      <motion.circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 1.0, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
    </>
  );
};

export const ReadinessRing = ({ overall, coverage, consistency, onInfo }: Props) => {
  const TELEMETRY = useTelemetry();
  const overallSafe = clampPct(overall);
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-3xl"
      style={{
        background: TELEMETRY.card,
        border: `1px solid ${TELEMETRY.border}`,
        padding: 20,
      }}
    >
      {onInfo && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          aria-label="How readiness is calculated"
          className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center"
          style={{
            background: TELEMETRY.cardAlt,
            border: `1px solid ${TELEMETRY.border}`,
            color: TELEMETRY.mutedStrong,
          }}
        >
          <Info size={14} />
        </button>
      )}

      <div
        className="text-[11px] mb-3"
        style={{ color: TELEMETRY.muted }}
      >
        Exam Readiness
      </div>

      <div className="relative flex items-center justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Ring radius={92} value={overallSafe} color={TELEMETRY.mastered} delay={0} />
          <Ring radius={72} value={coverage} color={TELEMETRY.info} delay={0.12} />
          <Ring radius={52} value={consistency} color={TELEMETRY.info} delay={0.24} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6">
          <span
            className="text-4xl font-bold tabular-nums tracking-tight leading-none"
            style={{ color: TELEMETRY.text }}
          >
            {Math.round(overallSafe)}
            <span className="text-lg font-semibold ml-0.5" style={{ color: TELEMETRY.muted }}>
              %
            </span>
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-5">
        {[
          { c: TELEMETRY.mastered, l: "Mastery" },
          { c: TELEMETRY.info, l: "Coverage" },
          { c: TELEMETRY.info, l: "Streak" },
        ].map((x) => (
          <div key={x.l} className="flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: x.c }}
            />
            <span
              className="text-[11px]"
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
