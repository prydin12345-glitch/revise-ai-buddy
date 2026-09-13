import { cn } from "@/lib/utils";
import {
  type AssessmentTier,
  ASSESSMENT_TIER_LABELS,
} from "@/lib/assessment-tier";

interface AssessmentTierSelectorProps {
  /** Tier options this course supports. Render nothing when empty. */
  options: AssessmentTier[];
  /** null = not recorded (legacy profiles stay unknown until chosen). */
  value: AssessmentTier | null;
  onChange: (value: AssessmentTier | null) => void;
  accentColor?: string;
  courseLabel?: string | null;
}

export const AssessmentTierSelector = ({
  options,
  value,
  onChange,
  accentColor,
  courseLabel,
}: AssessmentTierSelectorProps) => {
  if (options.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        Assessment tier
        {courseLabel ? ` — ${courseLabel}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((tier) => {
          const selected = value === tier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => onChange(selected ? null : tier)}
              aria-pressed={selected}
              className={cn(
                "px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors min-h-[40px]",
                selected
                  ? "text-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
              style={
                selected && accentColor
                  ? { borderColor: accentColor, backgroundColor: `${accentColor}1a` }
                  : undefined
              }
            >
              {ASSESSMENT_TIER_LABELS[tier]}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {value
          ? "Questions will be written for this tier."
          : "Not set — questions will not assume a tier."}
      </p>
    </div>
  );
};
