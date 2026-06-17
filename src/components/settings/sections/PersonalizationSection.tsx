import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Loader2, Globe, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXAM_BOARD_OPTIONS } from "@/lib/board-scrubber";
import { getRegionBoards, getLevelsForBoard, LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";

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

  const profileFields = [
    { key: 'curriculum_region' as const, label: 'Region' },
    { key: 'preferred_exam_board' as const, label: 'Exam Board' },
    { key: 'preferred_educational_level' as const, label: 'Level' },
  ];
  const completedFields = profileFields.filter(f => preferences?.[f.key]);
  const completionPct = Math.round((completedFields.length / profileFields.length) * 100);

  return (
    <div className="space-y-6">
      {completionPct < 100 && (
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 border border-border p-3.5">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Complete your study profile</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedFields.length}/{profileFields.length} fields set — missing:{" "}
              {profileFields.filter(f => !preferences?.[f.key]).map(f => f.label).join(", ")}
            </p>
          </div>
          <span className={cn(
            "text-sm font-bold",
            completionPct === 100 ? "text-green-500" : "text-amber-500"
          )}>
            {completionPct}%
          </span>
        </div>
      )}

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
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Theme is controlled by the toggle in the top navigation bar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Accessibility options like font size and high-contrast mode are in the{" "}
            <a href="/settings?tab=advanced" className="text-primary underline">Advanced</a>{" "}
            tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
