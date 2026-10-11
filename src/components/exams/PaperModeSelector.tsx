import type { AssessmentTier } from "@/lib/assessment-tier";
import { Button } from "@/components/ui/button";
import {
  buildPaperPlan,
  biologyPaperDefinition,
  describePlan,
  type PaperMode,
} from "@/lib/biology-paper-contract";

interface PaperModeSelectorProps {
  compact?: boolean;
  courseId?: string | null;
  paperId?: string | null;
  mode: PaperMode;
  tier: AssessmentTier | null;
  onModeChange: (mode: PaperMode) => void;
  /** Called only when the user explicitly accepts the conversion. */
  onApplyPlan: (plan: NonNullable<ReturnType<typeof buildPaperPlan>>) => void;
  /** True when the current profile already matches the selected guided plan. */
  applied: boolean;
  contractVersion?: number;
}

const MODES: Array<{ id: PaperMode; label: string; description: string }> = [
  {
    id: "full_mock",
    label: "Full mock",
    description: "Complete selected paper, with its planned marks and timing.",
  },
  {
    id: "short_practice",
    label: "Short practice",
    description:
      "Same paper scope, shorter session. Shows its real mark total.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Your own counts and resource choices, kept exactly as set.",
  },
];

export function PaperModeSelector({
  compact = false,
  mode,
  courseId,
  paperId,
  tier,
  onModeChange,
  onApplyPlan,
  applied,
  contractVersion,
}: PaperModeSelectorProps) {
  const definition = biologyPaperDefinition(
    courseId ?? "aqa_gcse_biology",
    tier,
    paperId,
    contractVersion,
  );
  const plan =
    tier && definition
      ? buildPaperPlan(
          mode,
          tier,
          courseId ?? undefined,
          paperId,
          contractVersion,
        )
      : null;

  if (compact)
    return (
      <section className="space-y-3" aria-label="Paper mode">
        <p className="text-sm font-medium">Paper mode</p>
        <div className="flex gap-1 rounded-md bg-muted/50 p-1">
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mode === option.id}
              onClick={() => onModeChange(option.id)}
              className={`min-h-10 flex-1 rounded px-2 text-sm ${mode === option.id ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {mode !== "custom" && !tier && (
          <p className="text-xs text-muted-foreground">
            Choose Foundation or Higher before applying a guided preset.
          </p>
        )}
        {plan && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5">
            <div className="min-w-0 text-xs">
              <p className="font-medium">
                {plan.totalMarks} marks, {plan.durationMinutes} minutes
              </p>
              <p className="mt-1 text-muted-foreground">
                {plan.partCount} parts ·{" "}
                {
                  plan.parts.filter(
                    (part) => part.responseType === "mcq_single",
                  ).length
                }{" "}
                multiple choice
              </p>
            </div>
            {applied ? (
              <span className="text-xs text-muted-foreground">Applied</span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApplyPlan(plan)}
              >
                Use these settings
              </Button>
            )}
          </div>
        )}
      </section>
    );

  return (
    <div className="space-y-3 rounded-md border border-border bg-panel-2 p-4">
      <div>
        <p className="text-sm font-medium">Paper mode</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Guided modes plan the question mix for you. Custom never changes on
          its own.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            className={`min-h-20 rounded-md border p-3 text-left transition-colors ${
              mode === m.id
                ? "border-primary bg-primary/10 ring-1 ring-primary"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <span className="block text-sm font-medium">{m.label}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {m.id === "full_mock" && definition
                ? `${definition.displayName}: ${definition.fullMockMarks} marks, ${definition.fullMockMinutes} minutes.`
                : m.description}
            </span>
          </button>
        ))}
      </div>

      {mode !== "custom" && !tier && (
        <p className="text-xs text-muted-foreground">
          Choose Foundation or Higher before applying a guided preset.
        </p>
      )}
      {plan && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {describePlan(plan)}
          </p>
          <ul className="text-xs leading-relaxed text-muted-foreground">
            <li>
              {plan.parts.filter((p) => p.responseType === "mcq_single").length}{" "}
              single-select multiple choice ·{" "}
              {plan.parts.filter((p) => p.responseType !== "mcq_single").length}{" "}
              written parts
            </li>
            <li>
              {plan.parts.filter((p) => p.resource === "data_table").length}{" "}
              data tables ·{" "}
              {plan.parts.filter((p) => p.resource === "graph").length} graphs
            </li>
          </ul>
          {applied ? (
            <p className="text-xs leading-relaxed text-primary">
              These settings are applied.
            </p>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-10 text-xs"
              onClick={() => onApplyPlan(plan)}
            >
              Use these settings
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
