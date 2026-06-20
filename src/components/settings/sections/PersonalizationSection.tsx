import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Globe, GraduationCap, BookOpen, Palette, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLevelsForBoard } from "@/lib/board-level-mapping";
import { ExamBoardList } from "@/components/settings/ExamBoardList";
import { SettingsTabHeader } from "@/components/settings/SettingsTabHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";

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
    { key: 'preferred_educational_level' as const, label: 'Default Level' },
  ];
  const completedFields = profileFields.filter(f => preferences?.[f.key]);
  const completionPct = Math.round((completedFields.length / profileFields.length) * 100);

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        icon={Palette}
        title="Personalization"
        description="Curriculum, exam boards, and how the app looks"
      />

      {completionPct < 100 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground">Complete your study profile</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
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

      <SettingsCard
        icon={Globe}
        title="Curriculum Region"
        description="Sets the academic standard for AI-generated questions"
      >
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
                <span className="text-[13px] font-bold tracking-wide">{r.abbr}</span>
              </button>
            );
          })}
        </div>
        {!preferences?.curriculum_region && (
          <p className="text-[12px] text-amber-500 text-center">
            Select your region to improve AI question quality.
          </p>
        )}
      </SettingsCard>

      <SettingsCard
        icon={BookOpen}
        title="Your exam boards"
        description="Each subject can have its own board — only affects future exams"
      >
        <ExamBoardList curriculumRegion={preferences?.curriculum_region} />
      </SettingsCard>

      <SettingsCard
        icon={GraduationCap}
        title="Default Level"
        description="Applied when you add a new subject — each subject can override"
      >
        <div className="space-y-2">
          <Label className="text-[13px] font-medium">Default Level</Label>
          <Select
            value={preferences?.preferred_educational_level ?? '__none'}
            onValueChange={(val) => updatePreference({ preferred_educational_level: val === '__none' ? null : val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select level..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No preference</SelectItem>
              {getLevelsForBoard(null).map(level => (
                <SelectItem key={level.id} value={level.id}>{level.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SettingsCard>
    </div>
  );
};
