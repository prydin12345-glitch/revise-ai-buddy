import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { ExternalLink, Loader2 } from "lucide-react";

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
          <CardTitle>Beta Features</CardTitle>
          <CardDescription>Try experimental features before official release</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="beta-features">Enable Beta Features</Label>
              <p className="text-sm text-muted-foreground">Access new features early (may be unstable)</p>
            </div>
            <Switch
              id="beta-features"
              checked={preferences?.beta_features_enabled}
              onCheckedChange={(checked) => updatePreference({ beta_features_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

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
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div>
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

      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
          <CardDescription>Help us improve the app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-between" asChild>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              Report a Bug
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
          <Button variant="outline" className="w-full justify-between" asChild>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              Suggest a Feature
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
