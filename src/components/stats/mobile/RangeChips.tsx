import { TELEMETRY } from "./tokens";

interface Props {
  value: "weekly" | "monthly" | "yearly";
  onChange: (v: "weekly" | "monthly" | "yearly") => void;
}

const OPTIONS: { key: Props["value"]; label: string }[] = [
  { key: "weekly", label: "7D" },
  { key: "monthly", label: "30D" },
  { key: "yearly", label: "All" },
];

export const RangeChips = ({ value, onChange }: Props) => (
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
          role="tab"
          aria-selected={active}
          onClick={() => onChange(o.key)}
          className="min-h-[44px] px-4 rounded-full text-xs font-semibold tracking-wide transition-colors"
          style={{
            color: active ? "hsl(220 10% 6%)" : TELEMETRY.mutedStrong,
            background: active ? TELEMETRY.lime : "transparent",
          }}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);
