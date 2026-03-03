import { Sparkles, User, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkingPreferenceSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const OPTIONS = [
  {
    id: "ai_assisted",
    label: "AI-Assisted",
    description: "AI evaluates based on your mark scheme criteria",
    icon: Sparkles,
  },
  {
    id: "manual",
    label: "Manual",
    description: "You retain full grading control",
    icon: User,
  },
  {
    id: "self_marking",
    label: "Self-Marking",
    description: "Students grade themselves against your scheme",
    icon: CheckCircle,
  },
];

export function MarkingPreferenceSelector({ value, onChange }: MarkingPreferenceSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {OPTIONS.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-200",
              "backdrop-blur-md bg-card/50",
              isActive
                ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-lg"
                : "border-border hover:border-muted-foreground/30 hover:bg-accent/50"
            )}
          >
            <opt.icon
              className={cn(
                "h-6 w-6 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span className={cn("text-sm font-semibold", isActive ? "text-primary" : "text-foreground")}>
              {opt.label}
            </span>
            <span className="text-xs text-muted-foreground leading-tight">{opt.description}</span>
          </button>
        );
      })}
    </div>
  );
}
