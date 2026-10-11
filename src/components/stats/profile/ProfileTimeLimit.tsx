import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function ProfileTimeLimit({
  value,
  onChange,
  locked = false,
}: {
  value: string;
  onChange: (value: string) => void;
  locked?: boolean;
}) {
  const [lastValue, setLastValue] = useState(value || "30");
  return (
    <section
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
      aria-label="Timing"
    >
      <div>
        <h3 className="text-sm font-semibold">Time limit</h3>
        {locked && (
          <span className="text-xs text-muted-foreground">Preset</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {value ? "Timed" : "No limit"}
        </span>
        <Switch
          aria-label="Timed paper"
          checked={!!value}
          disabled={locked}
          onCheckedChange={(timed) => {
            if (value) setLastValue(value);
            onChange(timed ? lastValue : "");
          }}
        />
        {value && (
          <div className="flex items-center gap-2">
            <Input
              aria-label="Time limit in minutes"
              type="number"
              min={1}
              step={1}
              value={value}
              disabled={locked}
              onChange={(event) => onChange(event.target.value)}
              className="h-10 w-20 text-center tabular-nums"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        )}
      </div>
    </section>
  );
}
