import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLevelsForBoard } from "@/lib/board-level-mapping";
import { ExamBoardList } from "@/components/settings/ExamBoardList";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingRow } from "@/components/settings/SettingRow";

export const curriculumRegions = [
  { value: "GB", code: "gb", abbr: "UK" },
  { value: "US", code: "us", abbr: "USA" },
  { value: "AU", code: "au", abbr: "AUS" },
  { value: "CA", code: "ca", abbr: "CAN" },
  { value: "AE", code: "ae", abbr: "UAE" },
  { value: "IN", code: "in", abbr: "IND" },
  { value: "SG", code: "sg", abbr: "SG" },
  { value: "HK", code: "hk", abbr: "HK" },
  { value: "IE", code: "ie", abbr: "IRE" },
  { value: "NZ", code: "nz", abbr: "NZ" },
  { value: "ZA", code: "za", abbr: "SA" },
  { value: "IB", code: null, abbr: "INT" },
];

export const PersonalizationSection = () => {
  const { preferences, loading, updatePreference } = useUserPreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const profileFields = [
    { key: "curriculum_region" as const, label: "Region" },
    { key: "preferred_educational_level" as const, label: "Default level" },
  ];
  const completedFields = profileFields.filter((f) => preferences?.[f.key]);
  const completionPct = Math.round((completedFields.length / profileFields.length) * 100);

  return (
    <div className="space-y-6">
      {completionPct < 100 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Complete your study profile</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedFields.length}/{profileFields.length} fields set — missing:{" "}
              {profileFields.filter((f) => !preferences?.[f.key]).map((f) => f.label).join(", ")}
            </p>
          </div>
          <span className="text-sm font-medium text-primary tabular-nums">{completionPct}%</span>
        </div>
      )}

      <SettingsCard
        title="Curriculum region"
        description="Sets the academic standard for AI-generated questions."
      >
        <SettingRow
          label="Region"
          description="Select the country whose curriculum should shape generated content."
          fullWidth
        >
          <div className="flex flex-wrap gap-2">
            {curriculumRegions.map((r) => {
              const isSelected = preferences?.curriculum_region === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => updatePreference({ curriculum_region: r.value })}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full border transition-colors min-h-[40px]",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  {r.code ? (
                    <img
                      src={`https://flagcdn.com/w40/${r.code}.png`}
                      alt=""
                      className="w-5 h-auto rounded-sm object-contain"
                    />
                  ) : (
                    <span className="text-base leading-none">🌍</span>
                  )}
                  <span className="text-xs font-semibold tracking-wide">{r.abbr}</span>
                </button>
              );
            })}
          </div>
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Exam boards"
        description="Each subject can have its own board — only affects future exams."
      >
        <SettingRow label="Boards by subject" fullWidth>
          <ExamBoardList curriculumRegion={preferences?.curriculum_region} />
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Default level"
        description="Applied when you add a new subject. Each subject can override."
      >
        <SettingRow label="Educational level" htmlFor="default-level">
          <Select
            value={preferences?.preferred_educational_level ?? "__none"}
            onValueChange={(val) =>
              updatePreference({
                preferred_educational_level: val === "__none" ? null : val,
              })
            }
          >
            <SelectTrigger id="default-level" className="w-full">
              <SelectValue placeholder="Select level…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No preference</SelectItem>
              {getLevelsForBoard(null).map((level) => (
                <SelectItem key={level.id} value={level.id}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsCard>
    </div>
  );
};
