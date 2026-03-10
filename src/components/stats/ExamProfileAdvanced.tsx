import { useState, useMemo, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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

const PRESETS: Record<string, Omit<AdvancedSettings, "structurePreset">> = {
  custom: { ...DEFAULT_ADVANCED },
  uk_gcse: {
    mcqCount: 0, mcqPosition: "none",
    markDistribution: { 1: 4, 2: 4, 3: 3, 4: 2, 6: 1, 8: 1 },
    includeExtended: true, extendedMarks: 8,
    difficultyProgression: "ascending", calculatorPolicy: "allowed",
  },
  uk_alevel: {
    mcqCount: 0, mcqPosition: "none",
    markDistribution: { 2: 2, 3: 3, 4: 3, 5: 2, 8: 1, 12: 1 },
    includeExtended: true, extendedMarks: 12,
    difficultyProgression: "ascending", calculatorPolicy: "allowed",
  },
  us_ap: {
    mcqCount: 12, mcqPosition: "start",
    markDistribution: { 4: 3, 6: 2, 10: 1 },
    includeExtended: false, extendedMarks: 0,
    difficultyProgression: "mixed", calculatorPolicy: "allowed",
  },
  us_sat: {
    mcqCount: 20, mcqPosition: "start",
    markDistribution: { 1: 20 },
    includeExtended: false, extendedMarks: 0,
    difficultyProgression: "mixed", calculatorPolicy: "not_allowed",
  },
  ib_diploma: {
    mcqCount: 0, mcqPosition: "none",
    markDistribution: { 2: 3, 4: 3, 6: 2, 10: 1 },
    includeExtended: true, extendedMarks: 10,
    difficultyProgression: "ascending", calculatorPolicy: "allowed",
  },
};

const PRESET_OPTIONS = [
  { id: "custom", label: "Custom", detail: "Set your own structure" },
  { id: "uk_gcse", label: "UK GCSE Style", detail: "Short + structured + extended" },
  { id: "uk_alevel", label: "UK A-Level Style", detail: "Structured + multi-part + essay" },
  { id: "us_ap", label: "US AP Style", detail: "~60% MCQ + FRQ section" },
  { id: "us_sat", label: "US SAT/ACT Style", detail: "Heavy MCQ with timed sections" },
  { id: "ib_diploma", label: "IB Diploma Style", detail: "Data-based + structured + extended" },
];

const MCQ_POSITIONS = [
  { id: "start", label: "At the start" },
  { id: "end", label: "At the end" },
  { id: "mixed", label: "Mixed throughout" },
];

const DIFFICULTY_OPTIONS = [
  { id: "ascending", label: "Easy → Hard", detail: "Standard exam order" },
  { id: "mixed", label: "Mixed", detail: "Random difficulty order" },
  { id: "descending", label: "Hard → Easy", detail: "Challenge mode" },
];

const CALC_OPTIONS = [
  { id: "allowed", label: "✓ Calculator allowed" },
  { id: "not_allowed", label: "✗ No calculator" },
  { id: "mixed", label: "~ Mixed paper" },
];

const MARK_VALUES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15];

const EXTENDED_MARKS_OPTIONS = [8, 10, 12, 15, 20, 25];

interface ExamProfileAdvancedProps {
  settings: AdvancedSettings;
  onChange: (settings: AdvancedSettings) => void;
  questionLimit: number;
  subjectColor: string;
}

export const ExamProfileAdvanced = ({
  settings,
  onChange,
  questionLimit,
  subjectColor,
}: ExamProfileAdvancedProps) => {
  const [open, setOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<AdvancedSettings>) => onChange({ ...settings, ...patch }),
    [settings, onChange]
  );

  const totalFromDistribution = useMemo(
    () => Object.values(settings.markDistribution).reduce((s, c) => s + c, 0),
    [settings.markDistribution]
  );

  const totalQuestions = totalFromDistribution + settings.mcqCount;

  const updateMarkDist = (marks: number, delta: number) => {
    const next = { ...settings.markDistribution };
    const val = Math.max(0, (next[marks] ?? 0) + delta);
    if (val === 0) delete next[marks];
    else next[marks] = val;
    update({ markDistribution: next });
  };

  const applyPreset = (id: string) => {
    const p = PRESETS[id];
    if (p) update({ structurePreset: id, ...p });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/60"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-semibold text-primary">
              Advanced Settings
            </span>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Customise exam structure and question distribution
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
          {/* ── Preset ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Exam Structure Preset
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-all",
                    settings.structurePreset === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-card/60 hover:bg-card"
                  )}
                >
                  <div className="text-xs font-semibold text-foreground">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{p.detail}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── MCQ ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Multiple Choice Questions
            </Label>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Number of MCQ questions</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: subjectColor }}>
                {settings.mcqCount}
              </span>
            </div>
            <Slider
              min={0}
              max={30}
              step={1}
              value={[settings.mcqCount]}
              onValueChange={(v) => update({ mcqCount: v[0] })}
              style={{
                "--slider-track": "hsl(var(--muted))",
                "--slider-range": subjectColor,
              } as React.CSSProperties}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 (no MCQ)</span>
              <span>30</span>
            </div>

            {settings.mcqCount > 0 && (
              <div className="mt-3 space-y-1.5">
                <span className="text-xs text-muted-foreground">MCQ position in exam</span>
                <div className="flex gap-2">
                  {MCQ_POSITIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => update({ mcqPosition: opt.id })}
                      className={cn(
                        "flex-1 rounded-md border py-1.5 text-[11px] transition-all",
                        settings.mcqPosition === opt.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/50 text-muted-foreground hover:bg-card"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Mark Distribution ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mark Distribution
              </Label>
              <span
                className={cn(
                  "text-[11px]",
                  totalQuestions > questionLimit ? "text-destructive font-medium" : "text-muted-foreground"
                )}
              >
                Total: {totalQuestions} / {questionLimit} questions
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-5">
              {MARK_VALUES.map((marks) => (
                <div
                  key={marks}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-card/60 p-2"
                >
                  <span className="text-[10px] text-muted-foreground">
                    {marks}mk{marks > 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateMarkDist(marks, -1)}
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted"
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="min-w-[14px] text-center text-sm font-bold text-foreground tabular-nums">
                      {settings.markDistribution[marks] ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateMarkDist(marks, 1)}
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted"
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalQuestions > questionLimit && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
                ⚠ Total questions ({totalQuestions}) exceeds your question limit ({questionLimit}).
                Increase the limit or reduce question counts.
              </div>
            )}
          </div>

          {/* ── Extended Response ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Extended Response Question
              </Label>
              <Switch
                checked={settings.includeExtended}
                onCheckedChange={(v) => update({ includeExtended: v })}
              />
            </div>
            {settings.includeExtended && (
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Mark value for extended question</span>
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
                <p className="text-[11px] text-muted-foreground">
                  This will be placed at the end of the exam
                </p>
              </div>
            )}
          </div>

          {/* ── Difficulty Progression ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Difficulty Progression
            </Label>
            <div className="flex gap-2">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update({ difficultyProgression: opt.id })}
                  className={cn(
                    "flex-1 rounded-lg border p-2 text-center transition-all",
                    settings.difficultyProgression === opt.id
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-card/60 hover:bg-card"
                  )}
                >
                  <div className="text-xs font-semibold text-foreground">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{opt.detail}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Calculator Policy ── */}
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
