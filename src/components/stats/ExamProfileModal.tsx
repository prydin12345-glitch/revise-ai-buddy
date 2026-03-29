import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { X, Check, Plus, ChevronsUpDown, Clock } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fuzzyMatch, getLocalSubtopics } from "@/lib/subtopic-dictionary";
import { ExamProfileAdvanced, DEFAULT_ADVANCED, type AdvancedSettings } from "./ExamProfileAdvanced";
import { EDUCATIONAL_LEVELS, ALL_LEVELS, detectRegionKey, isKnownLevel } from "@/lib/educational-levels";
import { useUserPreferences } from "@/hooks/useUserPreferences";

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

  useEffect(() => {
    if (open) {
      setProfileName(initialData?.profile_name || "");
      setSelectedTopics(initialData?.topics || []);
      const initWritten = initialData?.written_question_count ?? (initialData?.question_count ? Math.max(initialData.question_count - (initialData.mcq_count ?? 0), 5) : 10);
      setWrittenCount(initWritten);
      setMcqCount(initialData?.mcq_count ?? 0);
      // Pre-fill educational tier from profile if no initial data
      const tier = initialData?.educational_tier || preferences?.preferred_educational_level || "";
      const known = isKnownLevel(tier);
      setEducationalTier(known || !tier ? tier : "other");
      setCustomTier(known || !tier ? "" : tier);
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

  const filteredTopics = useMemo(() => {
    const unselected = allTopics.filter((t) => !selectedTopics.includes(t));
    if (!topicSearch.trim()) return unselected.slice(0, 40);
    return unselected.filter((t) => fuzzyMatch(topicSearch, t));
  }, [allTopics, selectedTopics, topicSearch]);

  const isCustom =
    topicSearch.trim() &&
    !allTopics.some((t) => t.toLowerCase() === topicSearch.trim().toLowerCase()) &&
    !selectedTopics.some((t) => t.toLowerCase() === topicSearch.trim().toLowerCase());

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto backdrop-blur-xl bg-card/95 border-border/50">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: subjectColor }} />
            <div>
              <DialogTitle className="text-lg">
                {initialData ? "Edit" : "Create"} Exam Profile
              </DialogTitle>
              <DialogDescription className="text-xs">
                {subjectName} — select topics for this profile
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Profile Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Profile Name
            </Label>
            <Input
              placeholder="e.g. Paper 1, Paper 2, Unit Test 3"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Educational Level — Universal */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Educational Level
            </Label>
            <Popover open={levelPopoverOpen} onOpenChange={setLevelPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between h-10 text-sm font-normal"
                >
                  <span className={educationalTier ? "text-foreground" : "text-muted-foreground"}>
                    {educationalTier
                      ? (educationalTier === "other"
                          ? "Other — specify below"
                          : ALL_LEVELS.find(l => l.id === educationalTier)?.label || educationalTier)
                      : "Select level (optional)..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-80 overflow-y-auto" align="start">
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
            {educationalTier === "other" && (
              <div className="mt-2 space-y-1">
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
          </div>

          {/* Separate Written + MCQ Counts */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Written questions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Written
                  </Label>
                  <span className="text-sm font-bold tabular-nums" style={{ color: subjectColor }}>
                    {writtenCount}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={20}
                  step={1}
                  value={[writtenCount]}
                  onValueChange={(v) => {
                    const newVal = v[0];
                    // Ensure at least one type has questions
                    if (newVal === 0 && mcqCount === 0) return;
                    setWrittenCount(newVal);
                  }}
                  style={{
                    "--slider-track": "hsl(var(--muted))",
                    "--slider-range": subjectColor,
                  } as React.CSSProperties}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0 (none)</span>
                  <span>20 max</span>
                </div>
                {writtenCount >= 15 && (
                  <p className="text-[11px] text-orange-400">
                    ⚠ {writtenCount} written questions may reduce quality
                  </p>
                )}
              </div>

              {/* MCQ questions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    MCQ
                  </Label>
                  <span className="text-sm font-bold tabular-nums text-emerald-500">
                    {mcqCount}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={30}
                  step={1}
                  value={[mcqCount]}
                  onValueChange={(v) => {
                    const newVal = v[0];
                    // Ensure at least one type has questions
                    if (newVal === 0 && writtenCount === 0) return;
                    setMcqCount(newVal);
                  }}
                  style={{
                    "--slider-track": "hsl(var(--muted))",
                    "--slider-range": "hsl(160 84% 39%)",
                  } as React.CSSProperties}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0 (none)</span>
                  <span>30 max</span>
                </div>
                {mcqCount >= 25 && (
                  <p className="text-[11px] text-orange-400">
                    ⚠ {mcqCount} MCQ — consider splitting into two sessions
                  </p>
                )}
              </div>
            </div>

            {/* Total summary */}
            <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Total questions in exam</span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {totalQuestionCount}
                <span className="text-[11px] text-muted-foreground font-normal ml-1.5">
                  ({mcqCount > 0 ? `${mcqCount} MCQ + ` : ""}{writtenCount} written)
                </span>
              </span>
            </div>
          </div>

          {/* Time Limit */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Time Limit (minutes)
              </Label>
            </div>
            <Input
              type="number"
              min={0}
              placeholder="e.g. 60 (leave blank for no limit)"
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Topic Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Topics ({selectedTopics.length} selected)
            </Label>

            {selectedTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTopics.map((topic) => (
                  <Badge
                    key={topic}
                    className="cursor-pointer gap-1 rounded-full px-3 py-1 text-xs transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: subjectColor + "20",
                      color: subjectColor,
                      borderColor: subjectColor + "40",
                    }}
                    onClick={() => toggleTopic(topic)}
                  >
                    {topic}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}

            <Popover open={topicPopoverOpen} onOpenChange={setTopicPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between h-9 text-sm font-normal"
                >
                  <span className="text-muted-foreground">Search & add topics...</span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Type to search..."
                    value={topicSearch}
                    onValueChange={setTopicSearch}
                  />
                  {filteredTopics.length === 0 && !isCustom && (
                    <CommandEmpty>No topics found.</CommandEmpty>
                  )}
                  <CommandGroup className="max-h-52 overflow-y-auto">
                    {isCustom && (
                      <CommandItem
                        onSelect={() => {
                          toggleTopic(topicSearch.trim());
                          setTopicSearch("");
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        Add "{topicSearch.trim()}"
                      </CommandItem>
                    )}
                    {filteredTopics.map((topic) => (
                      <CommandItem key={topic} value={topic} onSelect={() => toggleTopic(topic)}>
                        <Check className="mr-2 h-3.5 w-3.5 opacity-0" />
                        {topic}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Question Structure */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isMcqOnlyProfile ? "MCQ Structure" : "Question Structure"}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {isMcqOnlyProfile
                ? "For MCQ-only profiles, choose the answer-option pattern and visual content preferences."
                : "How should written questions be organised?"}
            </p>

            {isMcqOnlyProfile ? (
              <div className="space-y-3">
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
                      <div className="text-[10px] text-muted-foreground/80 mt-1">{option.detail}</div>
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
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {STRUCTURE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setQuestionStructure(option.id)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        questionStructure === option.id
                          ? "border-primary bg-primary/10"
                          : "border-border/50 bg-card/60 hover:bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{option.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                            {option.label}
                            <span className="text-[10px] text-muted-foreground font-normal rounded bg-muted px-1.5 py-0.5">
                              {option.example}
                            </span>
                          </div>
                          {option.detail && <div className="text-[11px] text-muted-foreground mt-0.5">{option.detail}</div>}
                        </div>
                        {questionStructure === option.id && (
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

              </>
            )}
          </div>

          {/* Advanced Settings */}
          <ExamProfileAdvanced
            settings={advanced}
            onChange={setAdvanced}
            questionLimit={writtenCount}
            subjectColor={subjectColor}
            curriculumRegion={preferences?.curriculum_region}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!profileName.trim() || selectedTopics.length === 0}
            style={{ backgroundColor: subjectColor, opacity: 1 }}
            className="text-white hover:opacity-90 disabled:cursor-not-allowed disabled:saturate-50"
          >
            {initialData ? "Update" : "Create"} Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};