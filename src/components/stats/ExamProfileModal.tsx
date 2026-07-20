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
import { BLUEPRINT_PRESETS } from "@/lib/paperPresets";
import { getTopicSuggestions, hasTopicSuggestions } from "@/lib/topicSuggestions";
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
    preview: ["Q1  Explain how erosion shapes…", "Q2  Calculate the gradient of…", "Q3  Describe the process of…"],
  },
  {
    id: "sub_questions",
    label: "Sub-parts",
    preview: ["Q1 (a) State the definition of…", "     (b) Explain why this occurs…", "     (c) Evaluate the impact of…"],
  },
  {
    id: "mixed",
    label: "Mixed",
    preview: ["Q1  Explain how erosion shapes…", "Q2 (a) State the definition of…", "     (b) Evaluate the impact of…"],
  },
];


// Common board paper layouts — one tap loads the real architecture.
// Presets live in src/lib/paperPresets.ts — one library, filtered by
// subject × level × board at render time.


const QUESTION_STYLE_OPTIONS = [
  "List / identify from the text",
  "Explain / describe",
  "Compare",
  "Language analysis",
  "Structure analysis",
  "Analyse data / calculation",
  "Evaluate a statement",
  "Passage-based question with linked essay",
  "Essay on two unseen poems",
  "Essay comparing two studied texts",
  "Extended writing task",
];

function getStudiedContentConfig(subjectName: string) {
  const s = subjectName || "";
  if (/history/i.test(s)) return {
    title: "Studied units", hint: "e.g. Germany 1890\u20131945",
    placeholder: "Unit, e.g. Germany 1890\u20131945",
    description: "The exact units/periods you study \u2014 sources and questions will be set inside them.",
    roles: [
      { id: "period_study", label: "Period study" },
      { id: "thematic_study", label: "Thematic study" },
      { id: "british_depth", label: "British depth study" },
      { id: "world_depth", label: "Wider world depth study" },
      { id: "historic_environment", label: "Historic environment" },
      { id: "other", label: "Other studied content" },
    ],
  };
  if (/religio/i.test(s)) return {
    title: "Studied content", hint: "e.g. Christianity, Islam",
    placeholder: "e.g. Christianity \u2014 beliefs and practices",
    description: "The religions and themes you study \u2014 questions will target these.",
    roles: [
      { id: "religion_beliefs", label: "Religion \u2014 beliefs" },
      { id: "religion_practices", label: "Religion \u2014 practices" },
      { id: "thematic_study", label: "Thematic study" },
      { id: "textual_study", label: "Textual study" },
      { id: "other", label: "Other studied content" },
    ],
  };
  if (/english|literature/i.test(s)) return {
    title: "Studied texts", hint: "e.g. Othello, An Inspector Calls",
    placeholder: "Title, e.g. Othello",
    description: "The exact texts you study \u2014 questions will target these. Public-domain texts get real passage questions; in-copyright texts get essay questions.",
    roles: [
      { id: "shakespeare", label: "Shakespeare play" },
      { id: "pre1900_prose", label: "Pre-1900 prose" },
      { id: "pre1900_poetry", label: "Pre-1900 poetry" },
      { id: "modern_prose", label: "Modern prose" },
      { id: "modern_drama", label: "Modern drama" },
      { id: "poetry_anthology", label: "Poetry anthology" },
      { id: "other", label: "Other studied content" },
    ],
  };
  return {
    title: "Studied content", hint: "units, case studies, set works",
    placeholder: "e.g. a unit, case study or set work",
    description: "The exact content you study \u2014 questions will target these.",
    roles: [
      { id: "studied_unit", label: "Studied unit / topic" },
      { id: "case_study", label: "Case study" },
      { id: "set_work", label: "Set work / key text" },
      { id: "other", label: "Other studied content" },
    ],
  };
}

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
  examBoard?: string | null;
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
  examBoard,
  availableTopics,
  onSave,
  initialData,
}: ExamProfileModalProps) => {
  const { preferences } = useUserPreferences();
  const userRegion = detectRegionKey(preferences?.curriculum_region);
  const [levelPopoverOpen, setLevelPopoverOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const isTextBasedSubject = /english|literature|history|religio/i.test(subjectName || "");
  const studiedContentCfg = getStudiedContentConfig(subjectName || "");
  const [studiedTexts, setStudiedTexts] = useState<Array<{ role: string; title: string }>>([]);
  const [newTextRole, setNewTextRole] = useState(getStudiedContentConfig(subjectName || "").roles[0].id);
  const [newTextTitle, setNewTextTitle] = useState("");
  const [blueprintEnabled, setBlueprintEnabled] = useState(false);
  const [blueprintSections, setBlueprintSections] = useState<Array<{ title: string; questions: Array<{ marks: number; style: string }>; answerCount?: number }>>([]);
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
  const blueprintTotalQuestions = blueprintSections.reduce((n, s) => n + s.questions.length, 0);
  const blueprintTotalMarks = blueprintSections.reduce((n, s) => n + s.questions.reduce((m, q) => m + (Number(q.marks) || 0), 0), 0);
  const blueprintCountedMarks = blueprintSections.reduce((n, s) => {
    const marks = s.questions.map((q) => Number(q.marks) || 0).sort((a, b) => b - a);
    const take = s.answerCount && s.answerCount < marks.length ? s.answerCount : marks.length;
    return n + marks.slice(0, take).reduce((m, v) => m + v, 0);
  }, 0);
  const blueprintActive = blueprintEnabled && blueprintTotalQuestions > 0;
  const structureLocksWritten = (!isMcqOnlyProfile && questionStructure === "sub_questions") || blueprintActive;
  useEffect(() => {
    if (structureLocksWritten) {
      const derived = blueprintActive
        ? Math.min(20, blueprintTotalQuestions)
        : Math.min(20, parentQuestionCount * maxPartsPerQuestion);
      if (writtenCount !== derived) setWrittenCount(derived);
    }
  }, [structureLocksWritten, parentQuestionCount, maxPartsPerQuestion, blueprintActive, blueprintTotalQuestions]);
  useEffect(() => {
    if (!isMcqOnlyProfile && questionStructure === "mixed" && parentQuestionCount > writtenCount) {
      setParentQuestionCount(Math.max(1, writtenCount));
    }
  }, [questionStructure, writtenCount]);

  useEffect(() => {
    if (open) {
      setProfileName(initialData?.profile_name || "");
      setSelectedTopics(initialData?.topics || []);
      setStudiedTexts(Array.isArray((initialData as any)?.studied_texts) ? (initialData as any).studied_texts : []);
      const bp = (initialData as any)?.paper_blueprint;
      const bpSections = Array.isArray(bp?.sections) ? bp.sections : [];
      setBlueprintSections(bpSections);
      setBlueprintEnabled(bpSections.length > 0);
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

  const finalTier = educationalTier === "other" ? customTier.trim() : educationalTier;
  const availablePresets = BLUEPRINT_PRESETS.filter((pr) =>
    pr.subjects.test(subjectName || "") &&
    (!finalTier || pr.levels.test(finalTier)) &&
    (!examBoard || pr.boards.test(examBoard) || pr.boards.source === "."));
  const handleSave = () => {
    if (!profileName.trim() || selectedTopics.length === 0 || !finalTier) return;
    const timeVal = timeLimitMinutes ? parseInt(timeLimitMinutes) : null;
    const advancedWithMcq = {
      ...advanced, mcqCount,
      studiedTexts: isTextBasedSubject ? studiedTexts : undefined,
      paperBlueprint: blueprintActive ? { sections: blueprintSections } : null,
    };
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

  const blueprintHasInvalidMarks = blueprintActive && blueprintSections.some((s) => s.questions.some((q) => !q.marks || q.marks < 1));
  const canSave = !!profileName.trim() && selectedTopics.length > 0 && !!finalTier && !blueprintHasInvalidMarks;
  const missingLevel = !finalTier;
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
                <Label className="text-xs text-muted-foreground">
                  Educational level <span className="text-destructive">*</span>
                </Label>
                <Popover open={levelPopoverOpen} onOpenChange={setLevelPopoverOpen} modal>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={`w-full justify-between h-10 text-sm font-normal ${
                        missingLevel ? "border-amber-500/60" : ""
                      }`}
                    >
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
                {missingLevel && (
                  <p className="text-[11px] text-amber-500 flex items-center gap-1">
                    Please select a level so questions match your standard.
                  </p>
                )}
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
                    {blueprintActive ? `Set by your paper structure: ${blueprintTotalQuestions} questions · ${blueprintTotalMarks} marks` : `Set by your structure: ${parentQuestionCount} question${parentQuestionCount === 1 ? "" : "s"} × ${maxPartsPerQuestion} parts = ${writtenCount} written parts`}
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
                  disabled={blueprintActive}
                  value={[mcqCount]}
                  onValueChange={(v) => {
                    const newVal = v[0];
                    if (newVal === 0 && writtenCount === 0) return;
                    setMcqCount(newVal);
                  }}
                  style={{ "--slider-track": "hsl(var(--muted))", "--slider-range": "hsl(160 84% 39%)" } as React.CSSProperties}
                />
                {blueprintActive && (
                  <p className="text-[11px] text-muted-foreground">Locked by Exact paper layout — add MCQs as a section there instead.</p>
                )}
                {mcqCount >= 25 && (
                  <p className="text-[11px] text-orange-400">⚠ {mcqCount} MCQ — consider splitting into two sessions</p>
                )}
              </div>
            </div>

          </SectionCard>

          {/* ── Structure ── */}
          <SectionCard accent={subjectColor} icon={ListChecks} title={isMcqOnlyProfile ? "Answer options" : "Structure"} hint={blueprintActive ? "locked by Exact paper layout" : (isMcqOnlyProfile ? undefined : "how written questions are organised")}>
            {blueprintActive && (
              <p className="text-[11px] text-muted-foreground -mt-1">Locked — your Exact paper layout defines the structure. Turn it off below to edit these.</p>
            )}
            <div className={blueprintActive ? "opacity-50 pointer-events-none" : ""}>
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
                        ? `${parentQuestionCount} question${parentQuestionCount === 1 ? "" : "s"}, each with up to ${maxPartsPerQuestion} parts — ${parentQuestionCount * maxPartsPerQuestion} written parts in total.`
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
                        <Label className="text-[11px] text-muted-foreground">Parts per question (a, b, c…)</Label>
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
            </div>
          </SectionCard>

          {/* ── Topics ── */}
          <SectionCard
            accent={subjectColor}
            icon={BookOpen}
            title="Topics"
            hint={selectedTopics.length ? `${selectedTopics.length} selected` : "pick at least one"}
          >
            {(() => {
              if (!hasTopicSuggestions(subjectName || "")) return null;
              if (!finalTier) {
                return (
                  <p className="text-[11px] text-muted-foreground rounded-md bg-muted/40 px-2.5 py-1.5">
                    Choose your level in Basics above and suggested areas for {subjectName} will appear here.
                  </p>
                );
              }
              const isAdvanced = /a[-\s_]?level|level[\s_]*3|\bas\b|\ba2\b|year[\s_]*1[23]|sixth/i.test(finalTier);
              const suggestions = getTopicSuggestions(subjectName || "", finalTier).filter((t) => !selectedTopics.includes(t));
              if (suggestions.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">
                    Quick add — common {isAdvanced ? "A-level" : "GCSE"} areas for {subjectName}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTopics([...selectedTopics, t])}
                        className="rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[11.5px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <TopicPickerDialog
              allTopics={allTopics}
              selectedTopics={selectedTopics}
              onChange={setSelectedTopics}
              subjectColor={subjectColor}
              subjectName={subjectName}
            />
          </SectionCard>

          {/* ── Studied texts (text-based subjects) ── */}
          {isTextBasedSubject && (
            <SectionCard accent={subjectColor} icon={BookOpen} title={studiedContentCfg.title} hint={studiedTexts.length ? `${studiedTexts.length} added` : studiedContentCfg.hint}>
              <p className="text-[11px] text-muted-foreground -mt-1">
                {studiedContentCfg.description}
              </p>
              <div className="space-y-1.5">
                {studiedTexts.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 w-28">
                      {studiedContentCfg.roles.find((r) => r.id === t.role)?.label ?? t.role}
                    </span>
                    <span className="text-xs flex-1 truncate">{t.title}</span>
                    <button type="button" aria-label={`Remove ${t.title}`} onClick={() => setStudiedTexts(studiedTexts.filter((_, j) => j !== i))}>
                      <span className="text-muted-foreground hover:text-destructive text-sm">×</span>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={newTextRole}
                  onChange={(e) => setNewTextRole(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs w-40 shrink-0"
                >
                  {studiedContentCfg.roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                <Input
                  value={newTextTitle}
                  onChange={(e) => setNewTextTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTextTitle.trim()) {
                      e.preventDefault();
                      setStudiedTexts([...studiedTexts, { role: newTextRole, title: newTextTitle.trim() }]);
                      setNewTextTitle("");
                    }
                  }}
                  placeholder={studiedContentCfg.placeholder}
                  className="h-9 text-xs"
                />
                <Button type="button" size="sm" variant="outline" className="shrink-0"
                  disabled={!newTextTitle.trim()}
                  onClick={() => { setStudiedTexts([...studiedTexts, { role: newTextRole, title: newTextTitle.trim() }]); setNewTextTitle(""); }}>
                  Add
                </Button>
              </div>
            </SectionCard>
          )}

          {/* ── Timing ── */}
          <SectionCard accent={subjectColor} icon={Clock} title="Time limit" hint={timeLimitMinutes ? `${timeLimitMinutes} min` : "No limit"}>
            <TimeWheelPicker
              value={timeLimitMinutes}
              onChange={setTimeLimitMinutes}
              subjectColor={subjectColor}
            />
          </SectionCard>

          {/* ── Paper structure (optional blueprint) ── */}
          <SectionCard accent={subjectColor} icon={ListChecks} title="Exact paper layout" hint={blueprintActive ? `${blueprintTotalQuestions} questions · ${blueprintTotalMarks} marks` : "optional"}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Define the exact paper layout</p>
                <p className="text-[10px] text-muted-foreground">Recreate a real paper's layout question by question — every question's marks and purpose, organised into sections. While this is on, it sets the question counts (the sliders above lock).</p>
              </div>
              <Switch checked={blueprintEnabled} onCheckedChange={(v) => {
                setBlueprintEnabled(v);
                if (v && blueprintSections.length === 0) {
                  setBlueprintSections([{ title: "Section A", questions: [{ marks: 4, style: "" }] }]);
                }
              }} />
            </div>
            {blueprintEnabled && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground shrink-0">Start from a preset</Label>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1"
                    value={advanced.structurePreset && advanced.structurePreset !== "custom" ? advanced.structurePreset : ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      const preset = availablePresets.find((pr) => pr.id === id);
                      if (preset) {
                        setBlueprintSections(JSON.parse(JSON.stringify(preset.sections)));
                        setAdvanced((prev) => ({ ...prev, structurePreset: id }));
                      } else {
                        setAdvanced((prev) => ({ ...prev, structurePreset: "custom" }));
                      }
                    }}
                  >
                    <option value="">Choose a board paper (or build your own below)…</option>
                    {availablePresets.map((pr) => (
                      <option key={pr.id} value={pr.id}>{pr.label}</option>
                    ))}
                  </select>
                </div>
                {availablePresets.length === 1 && availablePresets[0].id === "universal_mixed" && (
                  <p className="text-[11px] text-muted-foreground">
                    No exact preset exists yet for this subject, board and level combination — the standard paper is a safe starting shape, and every question below stays fully editable.
                  </p>
                )}
                {blueprintSections.map((sec, si) => (
                  <div key={si} className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={sec.title} placeholder={`Section ${String.fromCharCode(65 + si)}: Reading`}
                        onChange={(e) => setBlueprintSections(blueprintSections.map((s, j) => j === si ? { ...s, title: e.target.value } : s))}
                        className="h-8 text-xs font-medium" />
                      <button type="button" aria-label="Remove section"
                        onClick={() => setBlueprintSections(blueprintSections.filter((_, j) => j !== si))}
                        className="text-muted-foreground hover:text-destructive text-sm shrink-0">×</button>
                    </div>
                    {sec.questions.map((q, qi) => (
                      <div key={qi} className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-7 shrink-0 tabular-nums">
                          Q{blueprintSections.slice(0, si).reduce((n, s) => n + s.questions.length, 0) + qi + 1}
                        </span>
                        <Input type="number" min={1} max={60} value={q.marks || ""}
                          onChange={(e) => setBlueprintSections(blueprintSections.map((s, j) => j === si ? { ...s, questions: s.questions.map((qq, k) => k === qi ? { ...qq, marks: parseInt(e.target.value) || 0 } : qq) } : s))}
                          className="h-8 w-16 text-xs text-center" aria-label="Marks" />
                        <span className="text-[10px] text-muted-foreground shrink-0">marks</span>
                        <select
                          value={QUESTION_STYLE_OPTIONS.includes(q.style) ? q.style : "__other"}
                          onChange={(e) => {
                            const v = e.target.value === "__other" ? "" : e.target.value;
                            setBlueprintSections(blueprintSections.map((s, j) => j === si ? { ...s, questions: s.questions.map((qq, k) => k === qi ? { ...qq, style: v } : qq) } : s));
                          }}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1 min-w-[150px]"
                          aria-label="Question style"
                        >
                          {QUESTION_STYLE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          <option value="__other">Other (describe it)…</option>
                        </select>
                        {!QUESTION_STYLE_OPTIONS.includes(q.style) && (
                          <Input value={q.style} placeholder="Describe this question's purpose"
                            onChange={(e) => setBlueprintSections(blueprintSections.map((s, j) => j === si ? { ...s, questions: s.questions.map((qq, k) => k === qi ? { ...qq, style: e.target.value } : qq) } : s))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setBlueprintSections(blueprintSections.map((s, j) => j === si ? { ...s, questions: [...s.questions, { marks: 6, style: "" }] } : s));
                              }
                            }}
                            className="h-8 text-xs flex-1 basis-full sm:basis-auto min-w-[150px]" />
                        )}
                        <button type="button" aria-label="Remove question"
                          onClick={() => setBlueprintSections(blueprintSections.map((s, j) => j === si ? { ...s, questions: s.questions.filter((_, k) => k !== qi) } : s))}
                          className="text-muted-foreground hover:text-destructive text-sm shrink-0">×</button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]"
                      onClick={() => setBlueprintSections(blueprintSections.map((s, j) => j === si ? { ...s, questions: [...s.questions, { marks: 6, style: "" }] } : s))}>
                      + Add question
                    </Button>
                    {sec.questions.length > 1 && (
                      <div className="flex items-center gap-2 pt-1">
                        <Label className="text-[11px] text-muted-foreground">Students answer</Label>
                        <Input type="number" min={1} max={sec.questions.length}
                          value={sec.answerCount ?? sec.questions.length}
                          onChange={(e) => {
                            const v = parseInt(e.target.value);
                            setBlueprintSections(blueprintSections.map((s, j) => j === si
                              ? { ...s, answerCount: Number.isFinite(v) && v >= 1 && v < s.questions.length ? v : undefined }
                              : s));
                          }}
                          className="h-7 w-14 text-xs text-center" aria-label="Number of questions students answer in this section" />
                        <span className="text-[11px] text-muted-foreground">of {sec.questions.length} question{sec.questions.length === 1 ? "" : "s"}{sec.answerCount && sec.answerCount < sec.questions.length ? " (their choice)" : " (all)"}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]"
                    onClick={() => setBlueprintSections([...blueprintSections, { title: "", questions: [{ marks: 4, style: "" }] }])}>
                    + Add section
                  </Button>
                  <p className="text-[11px] text-muted-foreground tabular-nums">{blueprintTotalQuestions} questions · {blueprintCountedMarks < blueprintTotalMarks ? `${blueprintCountedMarks} marks counted (of ${blueprintTotalMarks} printed)` : `${blueprintTotalMarks} marks`}</p>
                </div>
                {blueprintTotalQuestions > 0 && (
                  <p className="text-[11px] text-muted-foreground tabular-nums rounded-md bg-muted/40 px-2.5 py-1.5">
                    Preview: {(() => { let n = 0; return blueprintSections.flatMap((s) => s.questions).map((q) => { n++; return `Q${n} [${q.marks || "?"}]`; }).join(" · "); })()}
                  </p>
                )}
                {blueprintSections.some((s) => s.questions.some((q) => !q.marks || q.marks < 1)) && (
                  <p className="text-[11px] text-destructive">⚠ Some questions have no marks set — fix or remove them to save this profile.</p>
                )}
                {blueprintSections.some((s) => s.questions.some((q) => q.marks > 40)) && (
                  <p className="text-[11px] text-orange-400">⚠ Questions above 40 marks are rare on real papers — double-check this is intended.</p>
                )}
                {blueprintActive && mcqCount > 0 && (
                  <p className="text-[11px] text-orange-400">⚠ Your paper structure and MCQ count ({mcqCount}) are both set — MCQs will be generated as an additional section.</p>
                )}
              </div>
            )}
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
              {canSave ? summaryParts : (!profileName.trim() ? "Add a profile name" : selectedTopics.length === 0 ? "Pick at least one topic" : "Select an educational level") + " to continue"}
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
