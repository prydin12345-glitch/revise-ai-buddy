import { useState, useMemo, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, ChevronDown, ChevronUp, Minus, Plus, Info } from "lucide-react";
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

/* ── Preset configs ── */

export interface PresetOption {
  id: string;
  label: string;
  detail: string;
  flag: string;
}

export const ALL_PRESETS: Record<string, Omit<AdvancedSettings, "structurePreset">> = {
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
  cambridge_igcse: {
    mcqCount: 0, mcqPosition: "none",
    markDistribution: { 1: 3, 2: 4, 3: 3, 4: 2, 6: 1 },
    includeExtended: true, extendedMarks: 8,
    difficultyProgression: "ascending", calculatorPolicy: "allowed",
  },
  abitur: {
    mcqCount: 0, mcqPosition: "none",
    markDistribution: { 3: 3, 5: 3, 8: 2, 15: 1 },
    includeExtended: true, extendedMarks: 15,
    difficultyProgression: "ascending", calculatorPolicy: "allowed",
  },
  aus_hsc: {
    mcqCount: 5, mcqPosition: "start",
    markDistribution: { 2: 3, 4: 3, 6: 2, 8: 1 },
    includeExtended: true, extendedMarks: 8,
    difficultyProgression: "ascending", calculatorPolicy: "allowed",
  },
};

/* ── Region-aware preset selection ── */

const PRESET_BANK: Record<string, PresetOption[]> = {
  universal: [
    { id: "custom", label: "Custom", detail: "Set your own structure", flag: "⚙" },
  ],
  UK: [
    { id: "uk_gcse", label: "GCSE Style", detail: "Short + structured + extended", flag: "🇬🇧" },
    { id: "uk_alevel", label: "A-Level Style", detail: "Structured + multi-part + essay", flag: "🇬🇧" },
  ],
  USA: [
    { id: "us_ap", label: "AP Style", detail: "~60% MCQ + Free Response", flag: "🇺🇸" },
    { id: "us_sat", label: "SAT / ACT Style", detail: "Heavy MCQ with timed sections", flag: "🇺🇸" },
  ],
  International: [
    { id: "ib_diploma", label: "IB Diploma Style", detail: "Data-based + structured + extended", flag: "🌐" },
    { id: "cambridge_igcse", label: "Cambridge IGCSE Style", detail: "Structured + data response", flag: "🌐" },
  ],
  Germany: [
    { id: "abitur", label: "Abitur Style", detail: "Three requirement levels + essay", flag: "🇩🇪" },
  ],
  Australia: [
    { id: "aus_hsc", label: "HSC Style", detail: "Short response + extended", flag: "🇦🇺" },
  ],
};

export const getPresetsForRegion = (curriculumRegion: string | null | undefined): PresetOption[] => {
  const region = (curriculumRegion ?? "").toLowerCase();
  const isUK = region.includes("uk") || region.includes("united kingdom");
  const isUSA = region.includes("usa") || region.includes("united states");
  const isGermany = region.includes("germany");
  const isAustralia = region.includes("australia");
  const isIB = region.includes("ib") || region.includes("international");

  return [
    ...PRESET_BANK.universal,
    ...(isUK ? PRESET_BANK.UK : []),
    ...(isUSA ? PRESET_BANK.USA : []),
    ...(isGermany ? PRESET_BANK.Germany : []),
    ...(isAustralia ? PRESET_BANK.Australia : []),
    ...(isIB || (!isUK && !isUSA && !isGermany && !isAustralia) ? PRESET_BANK.International : []),
  ];
};

/* ── Preset summaries ── */

interface StructureItem { icon: string; label: string; detail: string }
interface PresetSummaryData {
  structure: StructureItem[];
  mcq: string;
  calculator: string;
  difficulty: string;
  note: string;
}

const PRESET_SUMMARIES: Record<string, PresetSummaryData> = {
  uk_gcse: {
    structure: [
      { icon: "📝", label: "Short answer questions", detail: "1–3 marks each, ~6 questions" },
      { icon: "📋", label: "Structured questions", detail: "4–6 marks each, ~4 questions" },
      { icon: "✍️", label: "Extended response", detail: "8 marks, 1 question at end" },
    ],
    mcq: "None", calculator: "Depends on subject", difficulty: "Easy → Hard",
    note: "Mirrors standard GCSE paper structure",
  },
  uk_alevel: {
    structure: [
      { icon: "📝", label: "Short structured questions", detail: "2–4 marks each, ~4 questions" },
      { icon: "📋", label: "Multi-part questions", detail: "5–8 marks each, ~4 questions" },
      { icon: "✍️", label: "Extended / essay question", detail: "12 marks, 1 question at end" },
    ],
    mcq: "None", calculator: "Depends on subject", difficulty: "Easy → Hard",
    note: "Mirrors standard A-Level paper structure",
  },
  us_ap: {
    structure: [
      { icon: "☑️", label: "Multiple choice section", detail: "~15 MCQ questions at start" },
      { icon: "✍️", label: "Free response questions", detail: "4–10 marks each, ~3 questions" },
    ],
    mcq: "15 questions at start", calculator: "Section dependent", difficulty: "Mixed",
    note: "Mirrors College Board AP exam format",
  },
  us_sat: {
    structure: [
      { icon: "☑️", label: "Multiple choice heavy", detail: "~20 MCQ questions" },
      { icon: "📝", label: "Grid-in / short answer", detail: "A few numeric response questions" },
    ],
    mcq: "20 questions, mixed throughout", calculator: "Mixed paper", difficulty: "Mixed",
    note: "Mirrors SAT/ACT format",
  },
  ib_diploma: {
    structure: [
      { icon: "📊", label: "Data-based questions", detail: "2–4 marks, source analysis" },
      { icon: "📋", label: "Structured questions", detail: "4–6 marks each" },
      { icon: "✍️", label: "Extended response", detail: "10 marks at end" },
    ],
    mcq: "None (some papers have MCQ section)", calculator: "Depends on paper", difficulty: "Easy → Hard",
    note: "Mirrors IB Diploma assessment style",
  },
  cambridge_igcse: {
    structure: [
      { icon: "📝", label: "Short answer questions", detail: "1–3 marks each" },
      { icon: "📋", label: "Structured data questions", detail: "4–6 marks each" },
      { icon: "✍️", label: "Extended response", detail: "8 marks at end" },
    ],
    mcq: "None", calculator: "Depends on subject", difficulty: "Easy → Hard",
    note: "Mirrors Cambridge IGCSE assessment style",
  },
  abitur: {
    structure: [
      { icon: "📝", label: "Requirement Level I", detail: "Reproduction — 3–5 marks each" },
      { icon: "📋", label: "Requirement Level II", detail: "Application — 5–8 marks each" },
      { icon: "✍️", label: "Requirement Level III", detail: "Transfer & essay — up to 15 marks" },
    ],
    mcq: "None", calculator: "Depends on subject", difficulty: "Easy → Hard",
    note: "Mirrors German Abitur three-level structure",
  },
  aus_hsc: {
    structure: [
      { icon: "☑️", label: "Multiple choice section", detail: "~5 MCQ questions at start" },
      { icon: "📝", label: "Short response", detail: "2–4 marks each" },
      { icon: "✍️", label: "Extended response", detail: "6–8 marks at end" },
    ],
    mcq: "5 at start", calculator: "Depends on subject", difficulty: "Easy → Hard",
    note: "Mirrors NSW HSC paper structure",
  },
};

/* ── Sub-components ── */

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

/* ── Preset Summary Component ── */

const PresetSummary = ({
  preset,
  onSwitchToCustom,
}: {
  preset: string;
  onSwitchToCustom: () => void;
}) => {
  const summary = PRESET_SUMMARIES[preset];
  if (!summary) return null;

  return (
    <div className="space-y-4 rounded-lg border border-border/40 bg-muted/20 p-4">
      <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
        <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          This preset will automatically configure the exam structure.{" "}
          <button
            type="button"
            onClick={onSwitchToCustom}
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Switch to Custom to override
          </button>
        </p>
      </div>

      <div className="space-y-2">
        {summary.structure.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border/30 bg-card/60 p-3"
          >
            <span className="text-lg leading-none mt-0.5">{item.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">{item.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "MCQ", value: summary.mcq },
          { label: "Calculator", value: summary.calculator },
          { label: "Order", value: summary.difficulty },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border/30 bg-card/60 p-2.5 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </p>
            <p className="text-[11px] text-foreground mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/70 text-center italic">
        {summary.note}
      </p>
    </div>
  );
};

/* ── Main Component ── */

interface ExamProfileAdvancedProps {
  settings: AdvancedSettings;
  onChange: (settings: AdvancedSettings) => void;
  questionLimit: number; // Now represents written question limit only
  subjectColor: string;
  curriculumRegion?: string | null;
}

export const ExamProfileAdvanced = ({
  settings,
  onChange,
  questionLimit,
  subjectColor,
  curriculumRegion,
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

  // Mark distribution only counts against written questions now
  const isOverLimit = totalFromDistribution > questionLimit;

  const updateMarkDist = (marks: number, delta: number) => {
    const next = { ...settings.markDistribution };
    const val = Math.max(0, (next[marks] ?? 0) + delta);
    if (val === 0) delete next[marks];
    else next[marks] = val;
    update({ markDistribution: next });
  };

  const presetOptions = useMemo(() => getPresetsForRegion(curriculumRegion), [curriculumRegion]);

  const applyPreset = (id: string) => {
    const p = ALL_PRESETS[id];
    if (p) update({ structurePreset: id, ...p });
  };

  const isCustom = settings.structurePreset === "custom";

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

            {!curriculumRegion && (
              <p className="text-[11px] text-muted-foreground/70 italic">
                Set your region in Settings to see region-specific presets
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {presetOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    "rounded-[10px] border p-3.5 text-left transition-all min-h-[80px] flex flex-col justify-center",
                    settings.structurePreset === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-card/60 hover:bg-card"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{p.flag}</span>
                    <span className="text-xs font-semibold text-foreground">{p.label}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{p.detail}</div>
                </button>
              ))}
            </div>

            {/* Legal disclaimer */}
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed mt-1">
              Examly is an independent study platform. Exam structure presets describe
              general academic formats for practice purposes only. Not affiliated with
              or endorsed by any official examination board.
            </p>
          </div>

          {/* Show summary or custom fields */}
          {!isCustom ? (
            <PresetSummary
              preset={settings.structurePreset}
              onSwitchToCustom={() => applyPreset("custom")}
            />
          ) : (
            <>
              {/* ── MCQ Position (only if MCQ count > 0 set from parent) ── */}
              {settings.mcqCount > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    MCQ Position in Exam
                  </Label>
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

              {/* ── Mark Distribution ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Mark Distribution
                  </Label>
                  <span
                    className={cn(
                      "text-[11px]",
                      isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
                    )}
                  >
                    Written: {totalFromDistribution} / {questionLimit} questions
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {MARK_VALUES.map((marks) => (
                    <div
                      key={marks}
                      className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-card/60 p-2.5 text-center"
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

                {isOverLimit && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
                    ⚠ Written questions ({totalFromDistribution}) exceeds your written limit ({questionLimit}).
                    Increase the written count or reduce question counts.
                  </div>
                )}
              </div>

              {/* ── Extended Response ── */}
              <div className="space-y-2 mt-4">
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
              <div className="space-y-2 mt-4">
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
                        "flex-1 rounded-lg border p-2.5 text-center transition-all min-h-[70px] flex flex-col items-center justify-center",
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
              <div className="space-y-2 mt-4">
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
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};