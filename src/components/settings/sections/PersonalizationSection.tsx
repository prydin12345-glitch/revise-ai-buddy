import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Loader2, Globe, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXAM_BOARD_OPTIONS } from "@/lib/board-scrubber";
import { getRegionBoards, getLevelsForBoard, LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";


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
  { value: 'GB', code: 'gb', abbr: 'UK' },
  { value: 'US', code: 'us', abbr: 'USA' },
  { value: 'AU', code: 'au', abbr: 'AUS' },
  { value: 'CA', code: 'ca', abbr: 'CAN' },
  { value: 'AE', code: 'ae', abbr: 'UAE' },
  { value: 'IN', code: 'in', abbr: 'IND' },
  { value: 'SG', code: 'sg', abbr: 'SG' },
  { value: 'HK', code: 'hk', abbr: 'HK' },
  { value: 'IE', code: 'ie', abbr: 'IRE' },
  { value: 'NZ', code: 'nz', abbr: 'NZ' },
  { value: 'ZA', code: 'za', abbr: 'SA' },
  { value: 'IB', code: null, abbr: 'INT' },
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
          <div className="flex flex-wrap gap-3 justify-center">
            {curriculumRegions.map((r) => {
              const isSelected = preferences?.curriculum_region === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => updatePreference({ curriculum_region: r.value })}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2.5 rounded-full border transition-all cursor-pointer",
                    "hover:shadow-md hover:border-muted-foreground/50 hover:-translate-y-0.5",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border bg-card"
                  )}
                >
                  {r.code ? (
                    <img src={`https://flagcdn.com/w40/${r.code}.png`} alt={r.abbr} className="w-6 h-auto rounded-sm object-contain" />
                  ) : (
                    <span className="text-xl leading-none">🌍</span>
                  )}
                  <span className="text-sm font-bold tracking-wide">{r.abbr}</span>
                </button>
              );
            })}
          </div>
          {!preferences?.curriculum_region && (
            <p className="text-xs text-amber-500 mt-3 text-center">
              Select your region to improve AI question quality.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Exam Board & Level */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <CardTitle>Exam Board & Level</CardTitle>
          </div>
          <CardDescription>
            This pre-fills your exam and practice quiz creation forms. You can always override it per session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preferred Exam Board — filtered by region */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preferred Exam Board
            </Label>
            <Select
              value={preferences?.preferred_exam_board ?? '__none'}
              onValueChange={(val) => {
                const board = val === '__none' ? null : val;
                updatePreference({ preferred_exam_board: board });
                if (board && preferences?.preferred_educational_level) {
                  const validLevels = getLevelsForBoard(board);
                  if (!validLevels.some(l => l.id === preferences.preferred_educational_level)) {
                    updatePreference({ preferred_educational_level: null });
                  }
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select board..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No preference</SelectItem>
                {getRegionBoards(preferences?.curriculum_region).map(board => (
                  <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current Level — filtered by board */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Level
            </Label>
            <Select
              value={preferences?.preferred_educational_level ?? '__none'}
              onValueChange={(val) => updatePreference({ preferred_educational_level: val === '__none' ? null : val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select level..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No preference</SelectItem>
                {getLevelsForBoard(preferences?.preferred_exam_board).map(level => (
                  <SelectItem key={level.id} value={level.id}>{level.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview of what AI will use */}
          {preferences?.preferred_exam_board && preferences?.preferred_educational_level && (
            <div className="p-3 rounded-md bg-primary/5 border-l-3 border-primary text-sm text-muted-foreground">
              ✓ Your exams will be generated in{' '}
              <strong className="text-foreground">
                {EXAM_BOARD_OPTIONS.find(b => b.id === preferences.preferred_exam_board)?.name}
              </strong>{' '}
              style at{' '}
              <strong className="text-foreground">
                {LEVEL_DISPLAY_NAMES[preferences.preferred_educational_level] ?? preferences.preferred_educational_level}
              </strong>{' '}
              level
            </div>
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
