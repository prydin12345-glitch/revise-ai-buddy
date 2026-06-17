import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Loader2 } from "lucide-react";

export const AdvancedSection = () => {
  const { preferences, loading, updatePreference } = useUserPreferences();

  if (loading) {
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
          <CardTitle>Accessibility</CardTitle>
          <CardDescription>Customize accessibility options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="font-size">Font Size</Label>
            <Select
              value={preferences?.font_size}
              onValueChange={(value: 'small' | 'medium' | 'large') => updatePreference({ font_size: value })}
            >
              <SelectTrigger id="font-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium (default)</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Scales the entire app's base font size.</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4">
            <div className="flex-1 min-w-0">
              <Label htmlFor="high-contrast">High Contrast Mode</Label>
              <p className="text-sm text-muted-foreground">Increase contrast for better visibility</p>
            </div>
            <Switch
              id="high-contrast"
              checked={preferences?.high_contrast_mode}
              onCheckedChange={(checked) => updatePreference({ high_contrast_mode: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
