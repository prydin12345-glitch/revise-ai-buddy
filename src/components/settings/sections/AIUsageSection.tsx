import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAIUsageStats } from "@/hooks/useAIUsageStats";
import { Loader2, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingRow } from "@/components/settings/SettingRow";
import { cn } from "@/lib/utils";

export const AIUsageSection = () => {
  const { preferences, loading: prefsLoading, updatePreference } = useUserPreferences();
  const { stats, loading: statsLoading, totalCredits, totalTokens } = useAIUsageStats();
  const [usageOpen, setUsageOpen] = useState(false);

  if (prefsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Feedback detail"
        description="Choose how detailed AI responses should be."
      >
        <SettingRow
          label="Detail level"
          description="Applies to AI-generated feedback, marking notes and rationales."
          fullWidth
        >
          <RadioGroup
            value={preferences?.ai_feedback_detail}
            onValueChange={(value: "concise" | "detailed") =>
              updatePreference({ ai_feedback_detail: value })
            }
            className="w-full space-y-2"
          >
            {[
              { value: "concise", label: "Concise", hint: "Quick, to-the-point feedback." },
              { value: "detailed", label: "Detailed", hint: "Comprehensive explanations and guidance." },
            ].map((opt) => {
              const selected = preferences?.ai_feedback_detail === opt.value;
              return (
                <label
                  key={opt.value}
                  htmlFor={`fb-${opt.value}`}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors min-h-[56px]",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value={opt.value} id={`fb-${opt.value}`} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </SettingRow>
      </SettingsCard>

      {/* Usage — hidden by default, disclosure only. */}
      <section className="rounded-xl border border-border/60 bg-card">
        <button
          type="button"
          onClick={() => setUsageOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left min-h-[56px]"
          aria-expanded={usageOpen}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Monthly usage
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {statsLoading
                ? "Loading usage…"
                : `${totalCredits.toFixed(2)} credits · ${totalTokens.toLocaleString()} tokens this month`}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
              usageOpen && "rotate-180",
            )}
          />
        </button>

        {usageOpen && (
          <div className="px-5 pb-5 border-t border-border/40 pt-4">
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : stats.length > 0 ? (
              <div className="space-y-4">
                {stats.map((stat) => {
                  const pct = totalCredits > 0
                    ? Math.round((stat.total_credits / totalCredits) * 100)
                    : 0;
                  return (
                    <div key={stat.feature_name} className="space-y-1.5">
                      <div className="flex justify-between items-baseline gap-4">
                        <span className="text-sm font-medium text-foreground capitalize truncate">
                          {stat.feature_name.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {stat.total_credits.toFixed(2)} / {totalCredits.toFixed(2)} credits ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">
                No AI usage this month yet.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
