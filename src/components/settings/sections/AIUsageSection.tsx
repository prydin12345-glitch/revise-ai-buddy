import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAIUsageStats } from "@/hooks/useAIUsageStats";
import { Loader2, Brain, Zap, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Preferences</CardTitle>
          <CardDescription>Configure how AI assists you with studying</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ai-suggestions">Enable AI Suggestions</Label>
              <p className="text-sm text-muted-foreground">Get smart revision recommendations</p>
            </div>
            <Switch
              id="ai-suggestions"
              checked={preferences?.enable_ai_suggestions}
              onCheckedChange={(checked) => updatePreference({ enable_ai_suggestions: checked })}
            />
          </div>

          <div className="space-y-3 pt-4">
            <Label>Feedback Detail Level</Label>
            <RadioGroup
              value={preferences?.ai_feedback_detail}
              onValueChange={(value: 'concise' | 'detailed') => updatePreference({ ai_feedback_detail: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="concise" id="concise" />
                <Label htmlFor="concise" className="font-normal cursor-pointer">
                  Concise - Quick, to-the-point feedback
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="detailed" id="detailed" />
                <Label htmlFor="detailed" className="font-normal cursor-pointer">
                  Detailed - Comprehensive explanations and guidance
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Usage Summary</CardTitle>
          <CardDescription>Your AI usage for the current month</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary shrink-0" />
                    <p className="text-sm font-medium truncate">Total Credits</p>
                  </div>
                  <p className="text-2xl font-bold mt-2 tabular-nums">{totalCredits.toFixed(2)}</p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary shrink-0" />
                    <p className="text-sm font-medium truncate">Total Tokens</p>
                  </div>
                  <p className="text-2xl font-bold mt-2 tabular-nums">{totalTokens.toLocaleString()}</p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary shrink-0" />
                    <p className="text-sm font-medium truncate">Features Used</p>
                  </div>
                  <p className="text-2xl font-bold mt-2 tabular-nums">{stats.length}</p>
                </div>
              </div>

              {stats.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="font-medium">Usage by Feature</h4>
                  {stats.map((stat) => (
                    <div key={stat.feature_name} className="space-y-2">
                      <div className="flex justify-between text-sm">
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
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No AI usage this month yet</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
