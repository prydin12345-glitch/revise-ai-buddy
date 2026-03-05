import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Loader2, Globe } from "lucide-react";

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
];

const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
];

const curriculumRegions = [
  { value: 'GB', label: '🇬🇧 United Kingdom', description: 'AQA / Edexcel / OCR standards' },
  { value: 'US', label: '🇺🇸 United States', description: 'AP / Common Core standards' },
  { value: 'IGCSE', label: '🌍 International (IGCSE)', description: 'Cambridge International standards' },
  { value: 'AU', label: '🇦🇺 Australia', description: 'ATAR / HSC standards' },
  { value: 'SG', label: '🇸🇬 Singapore', description: 'GCE A-Level / O-Level standards' },
  { value: 'IN', label: '🇮🇳 India', description: 'CBSE / ISC standards' },
  { value: 'CA', label: '🇨🇦 Canada', description: 'Provincial curriculum standards' },
];

export const PersonalizationSection = () => {
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
      {/* Curriculum Region — top of personalization */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <CardTitle>Curriculum Region</CardTitle>
          </div>
          <CardDescription>
            Sets the academic standard for AI-generated questions. The system will match the tone, difficulty, and mark-weighting style of your region's exam boards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label htmlFor="curriculum-region">Your Region</Label>
            <Select
              value={preferences?.curriculum_region || ''}
              onValueChange={(value) => updatePreference({ curriculum_region: value })}
            >
              <SelectTrigger id="curriculum-region" className="h-11">
                <SelectValue placeholder="Select your curriculum region…" />
              </SelectTrigger>
              <SelectContent>
                {curriculumRegions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!preferences?.curriculum_region && (
              <p className="text-xs text-amber-500">
                Setting a region significantly improves AI question quality and difficulty calibration.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language & Region</CardTitle>
          <CardDescription>Customize your language and timezone preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select
              value={preferences?.language}
              onValueChange={(value) => updatePreference({ language: value })}
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={preferences?.timezone}
              onValueChange={(value) => updatePreference({ timezone: value })}
            >
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Customize the appearance of the app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme Mode</Label>
            <Select
              value={preferences?.theme_mode}
              onValueChange={(value: 'light' | 'dark' | 'system') => updatePreference({ theme_mode: value })}
            >
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accent">Accent Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="accent"
                value={preferences?.accent_color}
                onChange={(e) => updatePreference({ accent_color: e.target.value })}
                className="h-10 w-20 rounded border border-border cursor-pointer"
              />
              <Input
                value={preferences?.accent_color}
                onChange={(e) => updatePreference({ accent_color: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Manage how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notif">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch
              id="email-notif"
              checked={preferences?.email_notifications}
              onCheckedChange={(checked) => updatePreference({ email_notifications: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="push-notif">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive push notifications</p>
            </div>
            <Switch
              id="push-notif"
              checked={preferences?.push_notifications}
              onCheckedChange={(checked) => updatePreference({ push_notifications: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="inapp-notif">In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">Show notifications within the app</p>
            </div>
            <Switch
              id="inapp-notif"
              checked={preferences?.in_app_notifications}
              onCheckedChange={(checked) => updatePreference({ in_app_notifications: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
