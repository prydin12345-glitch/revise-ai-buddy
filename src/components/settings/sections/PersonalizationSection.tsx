import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Loader2, Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

export const curriculumRegions = [
  { value: 'GB', flag: '🇬🇧', label: 'United Kingdom', standard: 'A-Level / GCSE' },
  { value: 'US', flag: '🇺🇸', label: 'United States', standard: 'AP / SAT' },
  { value: 'AU', flag: '🇦🇺', label: 'Australia', standard: 'ATAR' },
  { value: 'CA', flag: '🇨🇦', label: 'Canada', standard: 'Provincial / OCAS' },
  { value: 'AE', flag: '🇦🇪', label: 'United Arab Emirates', standard: 'UAE Ministry / International' },
  { value: 'IN', flag: '🇮🇳', label: 'India', standard: 'CBSE / ICSE' },
  { value: 'SG', flag: '🇸🇬', label: 'Singapore', standard: 'GCE O/A Level' },
  { value: 'HK', flag: '🇭🇰', label: 'Hong Kong', standard: 'DSE' },
  { value: 'IE', flag: '🇮🇪', label: 'Ireland', standard: 'Leaving Certificate' },
  { value: 'NZ', flag: '🇳🇿', label: 'New Zealand', standard: 'NCEA' },
  { value: 'ZA', flag: '🇿🇦', label: 'South Africa', standard: 'NSC' },
  { value: 'IB', flag: '🌍', label: 'Global / International', standard: 'IB Diploma' },
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
      {/* Curriculum Region — visual flag grid */}
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
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap gap-2.5 justify-center">
              {curriculumRegions.map((r) => {
                const isSelected = preferences?.curriculum_region === r.value;
                return (
                  <Tooltip key={r.value}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => updatePreference({ curriculum_region: r.value })}
                        className={cn(
                          "relative w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all ring-2 ring-offset-2 ring-offset-background cursor-pointer hover:scale-110",
                          isSelected
                            ? "ring-primary shadow-lg scale-110"
                            : "ring-transparent hover:ring-muted-foreground/30"
                        )}
                      >
                        {r.flag}
                        {isSelected && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p className="font-medium">{r.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
          {!preferences?.curriculum_region && (
            <p className="text-xs text-amber-500 mt-3 text-center">
              Select your region to improve AI question quality.
            </p>
          )}
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
