import { useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, ChevronDown, ChevronUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Simplified Advanced Settings.
 *
 * The user-facing controls have been reduced to two human-meaningful choices:
 *   1. Extended Response Question (toggle + mark value)
 *   2. Calculator Policy
 *
 * Everything else (mark distribution, MCQ position, difficulty progression,
 * regional structure presets) is now inferred by the AI from the subject and
 * educational level. The fields remain on the AdvancedSettings interface so
 * the existing edge functions / database schema continue to accept the shape,
 * but the UI no longer exposes them and they always carry safe defaults.
 */

export interface AdvancedSettings {
  structurePreset: string;
  mcqCount: number;
  mcqPosition: string;
  markDistribution: Record<number, number>;
  includeExtended: boolean;
  extendedMarks: number;
  difficultyProgression: string;
  calculatorPolicy: string;
}

export const DEFAULT_ADVANCED: AdvancedSettings = {
  structurePreset: "custom",
  mcqCount: 0,
  mcqPosition: "start",
  markDistribution: {},
  includeExtended: false,
  extendedMarks: 0,
  difficultyProgression: "ascending",
  calculatorPolicy: "allowed",
};

/**
 * Kept for backwards compatibility with any importer — region-specific
 * structure presets have been removed from the UI in favour of letting the
 * AI choose the structure based on subject + level.
 */
export interface PresetOption {
  id: string;
  label: string;
  detail: string;
  flag: string;
}

export const ALL_PRESETS: Record<string, Partial<AdvancedSettings>> = {};

export const getPresetsForRegion = (_curriculumRegion: string | null | undefined): PresetOption[] => [];

/* ── Sub-options ── */

const CALC_OPTIONS = [
  { id: "allowed", label: "Calculator allowed" },
  { id: "not_allowed", label: "No calculator" },
  { id: "mixed", label: "Mixed paper" },
];

const MCQ_POSITION_OPTIONS = [
  { id: "start", label: "At the start" },
  { id: "end", label: "At the end" },
  { id: "mixed", label: "Mixed throughout" },
];

const EXTENDED_MARKS_OPTIONS = [8, 10, 12, 15, 20, 25];

interface ExamProfileAdvancedProps {
  settings: AdvancedSettings;
  onChange: (settings: AdvancedSettings) => void;
  /** Kept for prop compatibility but no longer used. */
  questionLimit?: number;
  /** Kept for prop compatibility but no longer used. */
  subjectColor?: string;
  /** Kept for prop compatibility but no longer used. */
  curriculumRegion?: string | null;
}

export const ExamProfileAdvanced = ({
  settings,
  onChange,
}: ExamProfileAdvancedProps) => {
  const [open, setOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<AdvancedSettings>) => onChange({ ...settings, ...patch }),
    [settings, onChange]
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/60"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-semibold text-primary">Advanced Settings</span>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Calculator policy and extended response
            </span>
          </div>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-0.5 space-y-5 rounded-lg border border-border/40 bg-muted/30 p-4">
          {/* Info note */}
          <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
            <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Question structure, mark values and order are chosen automatically based on your
              subject and educational level. You only need to set the options below.
            </p>
          </div>

          {/* Extended Response */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Extended Response Question
              </Label>
              <Switch
                checked={settings.includeExtended}
                onCheckedChange={(v) => update({ includeExtended: v, extendedMarks: v && !settings.extendedMarks ? 10 : settings.extendedMarks })}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Adds one long essay-style question at the end of the exam.
            </p>
            {settings.includeExtended && (
              <div className="space-y-1.5 pt-1">
                <span className="text-xs text-muted-foreground">Mark value</span>
                <div className="flex flex-wrap gap-1.5">
                  {EXTENDED_MARKS_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update({ extendedMarks: m })}
                      className={cn(
                        "rounded-md border px-3 py-1 text-xs transition-all",
                        settings.extendedMarks === m
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/50 text-muted-foreground hover:bg-card"
                      )}
                    >
                      {m} marks
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Calculator Policy */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Calculator Policy
            </Label>
            <div className="flex gap-2">
              {CALC_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update({ calculatorPolicy: opt.id })}
                  className={cn(
                    "flex-1 rounded-md border py-2 text-[11px] transition-all",
                    settings.calculatorPolicy === opt.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 text-muted-foreground hover:bg-card"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
