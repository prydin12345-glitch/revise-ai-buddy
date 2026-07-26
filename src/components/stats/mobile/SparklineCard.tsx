import { useId } from "react";
import { LucideIcon } from "lucide-react";
import { useTelemetry, buildSparklinePath } from "./tokens";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  /** Sparkline stroke. Defaults to the telemetry lime; resolved inside the
   *  component because the palette is theme-dependent. */
  accent?: string;
  sparkline?: number[];
  onClick?: () => void;
}

export const SparklineCard = ({
  icon: Icon,
  label,
  value,
  delta,
  deltaTone = "neutral",
  accent,
  sparkline = [],
  onClick,
}: Props) => {
  const TELEMETRY = useTelemetry();
  const tone = accent ?? TELEMETRY.lime;

  // useId keeps gradient ids unique — deriving them from the label collided
  // whenever the same card appeared twice (e.g. "Accuracy" on the overview and
  // again inside a drill-down sheet), so one card rendered with the other's fill.
  const gradientId = `spark-${useId().replace(/:/g, "")}`;

  const W = 96;
  const H = 26;
  const hasSeries = sparkline.length > 1;
  const d = hasSeries ? buildSparklinePath(sparkline, W, H) : "";

  const deltaColor =
    deltaTone === "up" ? TELEMETRY.lime : deltaTone === "down" ? TELEMETRY.magenta : TELEMETRY.muted;

  const Element: any = onClick ? "button" : "div";

  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`text-left w-full h-full rounded-2xl p-3.5 flex flex-col gap-2 transition-transform ${
        onClick ? "active:scale-[0.98] cursor-pointer" : ""
      }`}
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-center justify-between">
        {/* Flat monochrome icon — the tinted pill-on-tint treatment read as
            generic dashboard filler and competed with the value for attention. */}
        <Icon size={18} strokeWidth={1.75} style={{ color: TELEMETRY.muted }} />
        {delta && (
          <span className="text-[11px] font-medium tabular-nums" style={{ color: deltaColor }}>
            {delta}
          </span>
        )}
      </div>

      <div className="mt-auto">
        <div className="text-xs" style={{ color: TELEMETRY.muted }}>
          {label}
        </div>
        <div
          className="text-2xl font-semibold tabular-nums mt-0.5 truncate"
          style={{ color: TELEMETRY.text }}
        >
          {value}
        </div>
      </div>

      {/* Only drawn when there's a series. Cards without one no longer reserve
          empty space, so the grid keeps an even rhythm. */}
      {d && (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity="0.22" />
              <stop offset="100%" stopColor={tone} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gradientId})`} />
          <path d={d} stroke={tone} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        </svg>
      )}
    </Element>
  );
};
