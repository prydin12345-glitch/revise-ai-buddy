import { useTelemetry } from "./tokens";

interface Props {
  value: "weekly" | "monthly" | "yearly";
  onChange: (v: "weekly" | "monthly" | "yearly") => void;
}

// "yearly" is a rolling 12 months, not a calendar year — the chip used to read
// "All", which promised all-time history it never showed.
const OPTIONS: { key: Props["value"]; label: string }[] = [
  { key: "weekly", label: "7D" },
  { key: "monthly", label: "30D" },
  { key: "yearly", label: "12M" },
];

export const RangeChips = ({ value, onChange }: Props) => {
  const TELEMETRY = useTelemetry();

  return (
    <div
      role="tablist"
      aria-label="Time range"
      className="inline-flex items-center gap-1 p-1 rounded-full"
      style={{ background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}` }}
    >
      {OPTIONS.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!active) onChange(o.key);
            }}
            className="min-h-[36px] px-4 rounded-full text-xs font-semibold tracking-wide transition-colors"
            style={{
              color: active ? TELEMETRY.onAccent : TELEMETRY.mutedStrong,
              background: active ? TELEMETRY.lime : "transparent",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};
