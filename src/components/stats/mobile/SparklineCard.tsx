import { LucideIcon } from "lucide-react";
import { TELEMETRY, buildSparklinePath } from "./tokens";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  accent?: string;
  sparkline?: number[];
}

export const SparklineCard = ({
  icon: Icon,
  label,
  value,
  delta,
  deltaTone = "neutral",
  accent = TELEMETRY.lime,
  sparkline = [],
}: Props) => {
  const W = 96;
  const H = 28;
  const d = buildSparklinePath(sparkline, W, H);
  const gid = `spark-${label.replace(/\s+/g, "-")}`;

  const deltaColor =
    deltaTone === "up" ? TELEMETRY.lime : deltaTone === "down" ? TELEMETRY.magenta : TELEMETRY.muted;

  return (
    <div
      className="rounded-2xl p-3.5 flex flex-col justify-between min-h-[128px]"
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}1a`, border: `1px solid ${accent}33` }}
        >
          <Icon size={16} strokeWidth={2} style={{ color: accent }} />
        </div>
        {delta && (
          <span className="text-[10px] font-semibold tabular-nums" style={{ color: deltaColor }}>
            {delta}
          </span>
        )}
      </div>
      <div className="mt-2">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: TELEMETRY.muted }}>
          {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums mt-0.5" style={{ color: TELEMETRY.text }}>
          {value}
        </div>
      </div>
      {d && (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gid})`} />
          <path d={d} stroke={accent} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
};
