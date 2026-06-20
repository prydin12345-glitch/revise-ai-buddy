import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAIUsageStats } from "@/hooks/useAIUsageStats";
import { Loader2, Brain, Zap, TrendingUp, MessageSquare, BarChart3, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { SettingsTabHeader } from "@/components/settings/SettingsTabHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";

export const AIUsageSection = () => {
  const { preferences, loading: prefsLoading, updatePreference } = useUserPreferences();
  const { stats, loading: statsLoading, totalCredits, totalTokens } = useAIUsageStats();

  if (prefsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={Sparkles}
        title="AI Usage"
        description="Feedback style and your monthly usage"
      />

      <SettingsCard
        icon={MessageSquare}
        title="Feedback Detail"
        description="Choose how detailed AI responses should be"
      >
        <div className="space-y-3">
          <Label className="text-[13px] font-medium">Feedback Detail Level</Label>
          <RadioGroup
            value={preferences?.ai_feedback_detail}
            onValueChange={(value: 'concise' | 'detailed') => updatePreference({ ai_feedback_detail: value })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="concise" id="concise" />
              <Label htmlFor="concise" className="font-normal cursor-pointer text-[13px]">
                Concise - Quick, to-the-point feedback
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="detailed" id="detailed" />
              <Label htmlFor="detailed" className="font-normal cursor-pointer text-[13px]">
                Detailed - Comprehensive explanations and guidance
              </Label>
            </div>
          </RadioGroup>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={BarChart3}
        title="Monthly Usage"
        description="Your AI usage for the current month"
      >
        {statsLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
              <div className="rounded-xl p-4 bg-muted/40">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-[12px] font-medium truncate text-muted-foreground">Total Credits</p>
                </div>
                <p className="text-2xl font-bold mt-2 tabular-nums">{totalCredits.toFixed(2)}</p>
              </div>

              <div className="rounded-xl p-4 bg-muted/40">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-[12px] font-medium truncate text-muted-foreground">Total Tokens</p>
                </div>
                <p className="text-2xl font-bold mt-2 tabular-nums">{totalTokens.toLocaleString()}</p>
              </div>

              <div className="rounded-xl p-4 bg-muted/40">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-[12px] font-medium truncate text-muted-foreground">Features Used</p>
                </div>
                <p className="text-2xl font-bold mt-2 tabular-nums">{stats.length}</p>
              </div>
            </div>

            {stats.length > 0 ? (
              <div className="space-y-4 border-t border-border/40 pt-4">
                <h4 className="text-[13px] font-semibold">Usage by Feature</h4>
                {stats.map((stat) => (
                  <div key={stat.feature_name} className="space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="capitalize">{stat.feature_name.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground">
                        {stat.total_credits.toFixed(2)} credits
                      </span>
                    </div>
                    <Progress
                      value={(stat.total_credits / totalCredits) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border-t border-border/40">
                <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-[13px]">No AI usage this month yet</p>
              </div>
            )}
          </div>
        )}
      </SettingsCard>
    </div>
  );
};
