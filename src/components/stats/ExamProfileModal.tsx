import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, ChevronsUpDown, Clock, User, ListChecks, BookOpen, Settings2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getLocalSubtopics } from "@/lib/subtopic-dictionary";
import { TimeWheelPicker } from "./TimeWheelPicker";
import { TopicPickerDialog } from "./TopicPickerDialog";
import { ExamProfileAdvanced, DEFAULT_ADVANCED, type AdvancedSettings } from "./ExamProfileAdvanced";
import { EDUCATIONAL_LEVELS, ALL_LEVELS, detectRegionKey, isKnownLevel } from "@/lib/educational-levels";
import { useUserPreferences } from "@/hooks/useUserPreferences";


// Module-level so its identity is stable across renders — defining this inside
// the component re-created the element type on every keystroke, remounting the
// subtree and dropping input focus after one character.
const SectionCard = ({ icon: Icon, title, hint, accent, children }: { icon: any; title: string; hint?: string; accent: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
    <div className="flex items-center gap-2">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: accent + "1A", color: accent }}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <span className="text-[11px] text-muted-foreground ml-auto">{hint}</span>}
    </div>
    {children}
  </section>
);

// 1. Humanise tier ids so users never see raw codes like "level3_a_level".
const humaniseTier = (tier: string): string => {
  const age = tier.match(/(\d{1,2})[_-](\d{1,2})/);
  if (age) return `${age[1]}\u2013${age[2]} years`;
  return tier
    .replace(/^(level\d*|college|school)[_-]/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim() || tier;
};


// Structure choices with a miniature exam-paper preview each.
const STRUCTURE_PREVIEWS = [
  {
    id: "standalone",
    label: "Standalone",
    preview: ["Q1  Explain how erosion shapes\u2026", "Q2  Calculate the gradient of\u2026", "Q3  Describe the process of\u2026"],
  },
  {
    id: "sub_questions",
    label: "Sub-parts",
    preview: ["Q1 (a) State the definition of\u2026", "     (b) Explain why this occurs\u2026", "     (c) Evaluate the impact of\u2026"],
  },
  {
    id: "mixed",
    label: "Mixed",
    preview: ["Q1  Explain how erosion shapes\u2026", "Q2 (a) State the definition of\u2026", "     (b) Evaluate the impact of\u2026"],
  },
];

export interface QuestionStructureSettings {
  questionStructure: string;
  parentQuestionCount: number;
  maxPartsPerQuestion: number;
  mcqOptionsCount?: number;
  includeGraphs?: boolean;
  includeTables?: boolean;
}

interface ExamProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  subjectColor: string;
  availableTopics: string[];
  onSave: (
    profileName: string,
    topics: string[],
    questionCount: number,
    educationalTier?: string,
    timeLimitMinutes?: number | null,
    advanced?: AdvancedSettings,
    writtenQuestionCount?: number,
    structureSettings?: QuestionStructureSettings
  ) => void;
  initialData?: {
    profile_name: string;
    topics: string[];
    question_count: number;
    educational_tier?: string | null;
    time_limit_minutes?: number | null;
    structure_preset?: string | null;
    mcq_count?: number | null;
    mcq_position?: string | null;
    mark_distribution?: Record<number, number> | null;
    include_extended?: boolean | null;
    extended_marks?: number | null;
    difficulty_progression?: string | null;
    calculator_policy?: string | null;
    written_question_count?: number | null;
    question_structure?: string | null;
    parent_question_count?: number | null;
    max_parts_per_question?: number | null;
    mcq_options_count?: number | null;
    include_graphs?: boolean | null;
    include_tables?: boolean | null;
  };
}

export const ExamProfileModal = ({
  open,
  onOpenChange,
  subjectName,
  subjectColor,
  availableTopics,
  onSave,
  initialData,
}: ExamProfileModalProps) => {
  const { preferences } = useUserPreferences();
  const userRegion = detectRegionKey(preferences?.curriculum_region);
  const [levelPopoverOpen, setLevelPopoverOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [writtenCount, setWrittenCount] = useState(10);
  const [mcqCount, setMcqCount] = useState(0);
  const [topicSearch, setTopicSearch] = useState("");
  const [topicPopoverOpen, setTopicPopoverOpen] = useState(false);
  const [educationalTier, setEducationalTier] = useState("");
  const [customTier, setCustomTier] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<string>("");
  const [advanced, setAdvanced] = useState<AdvancedSettings>(DEFAULT_ADVANCED);

  // Question structure state
  const [questionStructure, setQuestionStructure] = useState("standalone");
  const [parentQuestionCount, setParentQuestionCount] = useState(4);
  const [maxPartsPerQuestion, setMaxPartsPerQuestion] = useState(3);
  const [mcqOptionsCount, setMcqOptionsCount] = useState(4);
  const [includeGraphs, setIncludeGraphs] = useState(false);
  const [includeTables, setIncludeTables] = useState(false);

  const totalQuestionCount = writtenCount + mcqCount;
  const isMcqOnlyProfile = mcqCount > 0 && writtenCount === 0;

  // Structure sync (single source of truth): with sub-parts, the written
  // count IS parents × parts — the slider locks and derives. With mixed,
  // parents are a subset of the written questions.
  const structureLocksWritten = !isMcqOnlyProfile && questionStructure === "sub_questions";
  useEffect(() => {
    if (structureLocksWritten) {
      const derived = Math.min(20, parentQuestionCount * maxPartsPerQuestion);
      if (writtenCount !== derived) setWrittenCount(derived);
    }
  }, [structureLocksWritten, parentQuestionCount, maxPartsPerQuestion]);
  useEffect(() => {
    if (!isMcqOnlyProfile && questionStructure === "mixed" && parentQuestionCount > writtenCount) {
      setParentQuestionCount(Math.max(1, writtenCount));
    }
  }, [questionStructure, writtenCount]);

  useEffect(() => {
    if (open) {
      setProfileName(initialData?.profile_name || "");
      setSelectedTopics(initialData?.topics || []);
      const initWritten = initialData?.written_question_count ?? (initialData?.question_count ? Math.max(initialData.question_count - (initialData.mcq_count ?? 0), 5) : 10);
      setWrittenCount(initWritten);
      setMcqCount(initialData?.mcq_count ?? 0);
      // Pre-fill educational tier from profile if no initial data.
      // Only accept known level ids — legacy/raw codes like "level3_a_level"
      // are ignored so the field shows "Select level..." rather than an ugly
      // pre-populated "Other qualification" with a raw code in the text box.
      const rawTier = initialData?.educational_tier || preferences?.preferred_educational_level || "";
      if (rawTier && isKnownLevel(rawTier)) {
        setEducationalTier(rawTier);
        setCustomTier("");
      } else {
        setEducationalTier("");
        setCustomTier("");
      }
      setTimeLimitMinutes(
        initialData?.time_limit_minutes != null ? String(initialData.time_limit_minutes) : ""
      );
      setTopicSearch("");
      setAdvanced({
        structurePreset: initialData?.structure_preset || "custom",
        mcqCount: initialData?.mcq_count ?? 0,
        mcqPosition: initialData?.mcq_position || "start",
        markDistribution: (initialData?.mark_distribution as Record<number, number>) || {},
        includeExtended: initialData?.include_extended ?? false,
        extendedMarks: initialData?.extended_marks ?? 0,
        difficultyProgression: initialData?.difficulty_progression || "ascending",
        calculatorPolicy: initialData?.calculator_policy || "allowed",
      });
      setQuestionStructure(initialData?.question_structure || "standalone");
      setParentQuestionCount(initialData?.parent_question_count ?? 4);
      setMaxPartsPerQuestion(initialData?.max_parts_per_question ?? 3);
      setMcqOptionsCount(initialData?.mcq_options_count ?? 4);
      setIncludeGraphs(initialData?.include_graphs ?? false);
      setIncludeTables(initialData?.include_tables ?? false);
    }
  }, [open, initialData]);

  // Sync MCQ count between main slider and advanced settings
  useEffect(() => {
    if (advanced.mcqCount !== mcqCount) {
      setAdvanced(prev => ({ ...prev, mcqCount }));
    }
  }, [mcqCount]);

  const allTopics = useMemo(() => {
    const dictTopics = getLocalSubtopics(subjectName);
    return [...new Set([...availableTopics, ...dictTopics])];
  }, [subjectName, availableTopics]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  // filtering handled inside InlineTopicPicker

  const handleSave = () => {
    if (!profileName.trim() || selectedTopics.length === 0) return;
    const timeVal = timeLimitMinutes ? parseInt(timeLimitMinutes) : null;
    const finalTier = educationalTier === "other" ? customTier : educationalTier;
    const advancedWithMcq = { ...advanced, mcqCount };
    const resolvedQuestionStructure = isMcqOnlyProfile ? "mcq_only" : questionStructure;
    onSave(
      profileName.trim(),
      selectedTopics,
      totalQuestionCount,
      finalTier || undefined,
      timeVal,
      advancedWithMcq,
      writtenCount,
      {
        questionStructure: resolvedQuestionStructure,
        parentQuestionCount,
        maxPartsPerQuestion,
        mcqOptionsCount,
        includeGraphs,
        includeTables,
      }
    );
    onOpenChange(false);
  };

  const STRUCTURE_OPTIONS = [
    {
      id: "standalone",
      label: "Standalone questions",
      example: "Q1, Q2, Q3, Q4...",
      icon: "1️⃣",
    },
    {
      id: "sub_questions",
      label: "Questions with sub-parts",
      example: "Q1a, Q1b, Q1c — Q2a, Q2b...",
      icon: "🔢",
    },
    {
      id: "mixed",
      label: "Mixed structure",
      example: "Some standalone, some with parts",
      icon: "🔀",
    },
  ];

  const MCQ_STRUCTURE_OPTIONS = [
    { id: 3, label: "3 options", example: "A, B, C", detail: "Compact MCQs with three choices." },
    { id: 4, label: "4 options", example: "A, B, C, D", detail: "Standard board-style MCQs with four choices." },
  ];

  const canSave = !!profileName.trim() && selectedTopics.length > 0;
  const summaryParts = [
    `${totalQuestionCount} question${totalQuestionCount === 1 ? "" : "s"}`,
    selectedTopics.length ? `${selectedTopics.length} topic${selectedTopics.length === 1 ? "" : "s"}` : null,
    timeLimitMinutes ? `${timeLimitMinutes} min` : "no time limit",
  ].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0 bg-card border-border/60">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: subjectColor }} />
            <div>
              <DialogTitle className="text-lg">
                {initialData ? "Edit" : "Create"} Exam Profile
              </DialogTitle>
              <DialogDescription className="text-xs">
                {subjectName} — a reusable recipe for generating exams
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 accent-scroll" style={{ "--scroll-accent": subjectColor } as React.CSSProperties}>
          {/* ── Basics ── */}
          <SectionCard accent={subjectColor} icon={User} title="Basics">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="text-xs text-muted-foreground">Profile name</Label>
                <Input
                  id="profile-name"
                  placeholder="e.g. Paper 1, Unit Test 3"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Educational level (optional)</Label>
                <Popover open={levelPopoverOpen} onOpenChange={setLevelPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between h-10 text-sm font-normal">
                      <span className={educationalTier ? "text-foreground" : "text-muted-foreground"}>
                        {educationalTier
                          ? (educationalTier === "other"
                              ? "Other qualification"
                              : ALL_LEVELS.find(l => l.id === educationalTier)?.label || humaniseTier(educationalTier))
                          : "Select level..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-80 overflow-y-auto accent-scroll" style={{ "--scroll-accent": subjectColor } as React.CSSProperties} align="start">
                    {EDUCATIONAL_LEVELS.map((group) => (
                      <div key={group.group}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-2.5 pb-1">
                          {group.group}
                        </p>
                        {group.levels.map((level) => {
                          const alias = userRegion ? level.aliases[userRegion] : null;
                          return (
                            <button
                              key={level.id}
                              type="button"
                              onClick={() => {
                                setEducationalTier(level.id);
                                if (level.id !== "other") setCustomTier("");
                                setLevelPopoverOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                educationalTier === level.id
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted text-foreground"
                              }`}
                            >
                              <div className="text-[13px]">{level.label}</div>
                              {alias && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {userRegion}: {alias}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {educationalTier === "other" && (
              <div className="space-y-1">
                <Input
                  value={customTier}
                  onChange={(e) => setCustomTier(e.target.value)}
                  placeholder="e.g. HNC/HND, NVQ Level 3, AWS Certification..."
                  className="h-9 border-primary/50"
                />
                <p className="text-[11px] text-muted-foreground">
                  The AI will interpret your qualification level when generating questions
                </p>
              </div>
            )}
          </SectionCard>

          {/* ── Questions ── */}
          <SectionCard accent={subjectColor} icon={ListChecks} title="Questions" hint={`${totalQuestionCount} total`}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Written</Label>
                  <span className="text-sm font-bold tabular-nums" style={{ color: subjectColor }}>{writtenCount}</span>
                </div>
                <Slider
                  min={0} max={20} step={1}
                  value={[writtenCount]}
                  disabled={structureLocksWritten}
                  onValueChange={(v) => {
                    const newVal = v[0];
                    if (newVal === 0 && mcqCount === 0) return;
                    setWrittenCount(newVal);
                  }}
                  style={{ "--slider-track": "hsl(var(--muted))", "--slider-range": subjectColor } as React.CSSProperties}
                />
                {structureLocksWritten && (
                  <p className="text-[11px] text-muted-foreground">
                    Set by your structure: {parentQuestionCount} question{parentQuestionCount === 1 ? "" : "s"} \u00d7 {maxPartsPerQuestion} parts = {writtenCount} written parts
                  </p>
                )}
                {writtenCount >= 15 && (
                  <p className="text-[11px] text-orange-400">⚠ {writtenCount} written questions may reduce quality</p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Multiple choice</Label>
                  <span className="text-sm font-bold tabular-nums text-emerald-500">{mcqCount}</span>
                </div>
                <Slider
                  min={0} max={30} step={1}
                  value={[mcqCount]}
                  onValueChange={(v) => {
                    const newVal = v[0];
                    if (newVal === 0 && writtenCount === 0) return;
                    setMcqCount(newVal);
                  }}
                  style={{ "--slider-track": "hsl(var(--muted))", "--slider-range": "hsl(160 84% 39%)" } as React.CSSProperties}
                />
                {mcqCount >= 25 && (
                  <p className="text-[11px] text-orange-400">⚠ {mcqCount} MCQ — consider splitting into two sessions</p>
                )}
              </div>
            </div>

          </SectionCard>

          {/* ── Structure ── */}
          <SectionCard accent={subjectColor} icon={ListChecks} title={isMcqOnlyProfile ? "Answer options" : "Structure"} hint={isMcqOnlyProfile ? undefined : "how written questions are organised"}>
            {isMcqOnlyProfile ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {MCQ_STRUCTURE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMcqOptionsCount(option.id)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        mcqOptionsCount === option.id
                          ? "border-primary bg-primary/10"
                          : "border-border/50 bg-card/60 hover:bg-card"
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground">{option.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{option.example}</div>
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">Include graph-based questions</p>
                      <p className="text-[10px] text-muted-foreground">Allow chart/graph MCQs where relevant.</p>
                    </div>
                    <Switch checked={includeGraphs} onCheckedChange={setIncludeGraphs} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">Include table/data questions</p>
                      <p className="text-[10px] text-muted-foreground">Allow table interpretation and data MCQs.</p>
                    </div>
                    <Switch checked={includeTables} onCheckedChange={setIncludeTables} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STRUCTURE_PREVIEWS.map((option) => {
                    const active = questionStructure === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setQuestionStructure(option.id)}
                        className={`group rounded-xl border-2 p-3.5 text-left transition-all duration-200 hover:scale-[1.03] ${
                          active ? "scale-[1.03] shadow-lg" : "border-border/50 bg-card/60 hover:shadow-md"
                        }`}
                        style={active ? { borderColor: subjectColor, backgroundColor: subjectColor + "0D" } : undefined}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground">{option.label}</span>
                          {active && (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: subjectColor }}>
                              <Check className="h-2.5 w-2.5 text-white" />
                            </span>
                          )}
                        </div>
                        {/* Mini exam-paper preview */}
                        <div className="rounded-md border border-border/60 bg-background px-2.5 py-2 space-y-1">
                          {option.preview.map((line, i) => (
                            <p key={i} className="text-[10px] leading-snug font-serif text-foreground/75 truncate">
                              {line}
                            </p>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {(questionStructure === "sub_questions" || questionStructure === "mixed") && (
                  <div className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-3">
                    <p className="text-[11px] text-muted-foreground">
                      {questionStructure === "sub_questions"
                        ? `${parentQuestionCount} question${parentQuestionCount === 1 ? "" : "s"}, each with up to ${maxPartsPerQuestion} parts \u2014 ${parentQuestionCount * maxPartsPerQuestion} written parts in total.`
                        : `${parentQuestionCount} of your ${writtenCount} written questions will have sub-parts; the other ${Math.max(0, writtenCount - parentQuestionCount)} are standalone.`}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground">Questions with parts</Label>
                        <span className="text-xs font-bold tabular-nums" style={{ color: subjectColor }}>{parentQuestionCount}</span>
                      </div>
                      <Slider min={1} max={10} step={1} value={[parentQuestionCount]}
                        onValueChange={(v) => setParentQuestionCount(v[0])}
                        style={{ "--slider-track": "hsl(var(--muted))", "--slider-range": subjectColor } as React.CSSProperties} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground">Parts per question (a, b, c\u2026)</Label>
                        <span className="text-xs font-bold tabular-nums" style={{ color: subjectColor }}>{maxPartsPerQuestion}</span>
                      </div>
                      <Slider min={2} max={6} step={1} value={[maxPartsPerQuestion]}
                        onValueChange={(v) => setMaxPartsPerQuestion(v[0])}
                        style={{ "--slider-track": "hsl(var(--muted))", "--slider-range": subjectColor } as React.CSSProperties} />
                    </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* ── Topics ── */}
          <SectionCard
            accent={subjectColor}
            icon={BookOpen}
            title="Topics"
            hint={selectedTopics.length ? `${selectedTopics.length} selected` : "pick at least one"}
          >
            <TopicPickerDialog
              allTopics={allTopics}
              selectedTopics={selectedTopics}
              onChange={setSelectedTopics}
              subjectColor={subjectColor}
              subjectName={subjectName}
            />
          </SectionCard>

          {/* ── Timing ── */}
          <SectionCard accent={subjectColor} icon={Clock} title="Time limit" hint={timeLimitMinutes ? `${timeLimitMinutes} min` : "No limit"}>
            <TimeWheelPicker
              value={timeLimitMinutes}
              onChange={setTimeLimitMinutes}
              subjectColor={subjectColor}
            />
          </SectionCard>

          {/* ── Advanced ── */}
          <SectionCard accent={subjectColor} icon={Settings2} title="Advanced" hint="optional">
            <ExamProfileAdvanced
              settings={advanced}
              onChange={setAdvanced}
              questionLimit={writtenCount}
              subjectColor={subjectColor}
              curriculumRegion={preferences?.curriculum_region}
            />
          </SectionCard>
        </div>

        {/* ── Sticky footer with live summary + disabled reason ── */}
        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-card sm:justify-between gap-3">
          <div className="text-left self-center min-w-0">
            <p className="text-xs font-medium truncate">{profileName.trim() || "Untitled profile"}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {canSave ? summaryParts : (!profileName.trim() ? "Add a profile name" : "Pick at least one topic") + " to continue"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              style={{ backgroundColor: subjectColor, opacity: 1 }}
              className="text-white hover:opacity-90 disabled:cursor-not-allowed disabled:saturate-50"
            >
              {initialData ? "Update" : "Create"} Profile
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
