import { useEffect, useRef } from "react";

interface TimeWheelPickerProps {
  value: string; // stringified minutes or "" for none
  onChange: (v: string) => void;
  subjectColor: string;
}

const PRESETS: { value: string; label: string }[] = [
  { value: "", label: "None" },
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "45", label: "45" },
  { value: "60", label: "60" },
  { value: "75", label: "75" },
  { value: "90", label: "90" },
  { value: "105", label: "105" },
  { value: "120", label: "120" },
  { value: "150", label: "150" },
  { value: "180", label: "180" },
];

export const TimeWheelPicker = ({ value, onChange, subjectColor }: TimeWheelPickerProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPreset = PRESETS.some((p) => p.value === value);

  // Scroll active preset into view when value changes externally
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLButtonElement>(`[data-val="${value}"]`);
    if (el && scrollRef.current) {
      const container = scrollRef.current;
      const target = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
      container.scrollTo({ left: target, behavior: "smooth" });
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {PRESETS.map((p) => {
          const active = value === p.value;
          return (
            <button
              key={p.value || "none"}
              type="button"
              data-val={p.value}
              onClick={() => onChange(p.value)}
              className={`snap-center shrink-0 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center ${
                active
                  ? "scale-105 shadow-lg text-white font-bold"
                  : "bg-card/60 border-border/50 text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
              style={{
                width: p.value === "" ? 68 : 64,
                height: 68,
                backgroundColor: active ? subjectColor : undefined,
                borderColor: active ? subjectColor : undefined,
              }}
            >
              <span className={`tabular-nums leading-none ${active ? "text-xl" : "text-lg"}`}>
                {p.label}
              </span>
              {p.value !== "" && (
                <span className={`text-[9.5px] uppercase tracking-wider mt-1 ${active ? "opacity-80" : ""}`}>
                  min
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!isPreset && value !== "" && (
        <p className="text-[11px] text-muted-foreground">
          Custom: <span className="font-semibold text-foreground">{value} min</span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground shrink-0">Or set custom:</span>
        <input
          type="number"
          min={0}
          placeholder="minutes"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-24 rounded-md border border-border/60 bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-offset-0"
          style={{ boxShadow: "none" }}
        />
      </div>
    </div>
  );
};
