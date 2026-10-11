import {ExamProfileBuilder} from "@/components/profiles/ExamProfileBuilder";
import {ProfileApprovalBadge} from "@/components/profiles/ExamlyApprovalBadge";
import {evaluateApproval,approvedPreset} from "../../../supabase/functions/_shared/preset-approval";
import { APPROVED_VISUAL_FILES } from "../../../supabase/functions/_shared/biology-visual-public";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  ArrowLeft,
  ArrowRight,
  Settings2,
  X,
  Pencil,
} from "lucide-react";
import { getLocalSubtopics } from "@/lib/subtopic-dictionary";
import {
  type AssessmentTier,
  getAssessmentTierOptions,
  getCourseCapability,
  getCourseOptions,
  OCR_GATEWAY_BIOLOGY_ID,
  EDEXCEL_BIOLOGY_ID,
  EDEXCEL_ALEVEL_BIOLOGY_B_ID,
  OCR_21C_BIOLOGY_ID,
  WJEC_BIOLOGY_ID,
  AQA_ALEVEL_BIOLOGY_ID,
  OCR_ALEVEL_BIOLOGY_ID,
  normaliseAssessmentTier,
} from "@/lib/assessment-tier";
import { AssessmentTierSelector } from "@/components/exams/AssessmentTierSelector";
import { BiologyCourseSelector } from "@/components/exams/BiologyCourseSelector";
import { BiologyPaperSelector } from "@/components/exams/BiologyPaperSelector";
import {
  profileCourseId,
  profilePaperId,
} from "../../../supabase/functions/_shared/course-selection";
import { PaperModeSelector } from "@/components/exams/PaperModeSelector";
import {
  supportsBiologyPaperContract,
  biologyPaperDefinition,
  buildPaperPlan,
  type PaperMode,
  type PaperPlan,
} from "@/lib/biology-paper-contract";
import { BLUEPRINT_PRESETS } from "@/lib/paperPresets";
import {
  getTopicSuggestions,
  hasTopicSuggestions,
} from "@/lib/topicSuggestions";
import { ProfilePaperPreview } from "./profile/ProfilePaperPreview";
import { ProfileTopicBrowser } from "./profile/ProfileTopicBrowser";
import { ProfileTimeLimit } from "./profile/ProfileTimeLimit";
import { ProfileLayoutEditor } from "./profile/ProfileLayoutEditor";
import {
  ExamProfileAdvanced,
  DEFAULT_ADVANCED,
  type AdvancedSettings,
} from "./ExamProfileAdvanced";
import {
  EDUCATIONAL_LEVELS,
  ALL_LEVELS,
  detectRegionKey,
  isKnownLevel,
} from "@/lib/educational-levels";
import { useUserPreferences } from "@/hooks/useUserPreferences";

// 1. Humanise tier ids so users never see raw codes like "level3_a_level".
const humaniseTier = (tier: string): string => {
  const age = tier.match(/(\d{1,2})[_-](\d{1,2})/);
  if (age) return `${age[1]}\u2013${age[2]} years`;
  return (
    tier
      .replace(/^(level\d*|college|school)[_-]/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
      .trim() || tier
  );
};

type ProfileStep = "basics" | "paper" | "layout" | "review";

function NumberControl({
  label,
  value,
  onChange,
  min = 0,
  max,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <Input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isInteger(next) && next >= min && next <= max)
            onChange(next);
        }}
        className="h-9 w-20 shrink-0 text-center tabular-nums"
      />
    </label>
  );
}

function getStudiedContentConfig(subjectName: string) {
  const s = subjectName || "";
  if (/history/i.test(s))
    return {
      title: "Studied units",
      hint: "e.g. Germany 1890\u20131945",
      placeholder: "Unit, e.g. Germany 1890\u20131945",
      description:
        "The exact units/periods you study \u2014 sources and questions will be set inside them.",
      roles: [
        { id: "period_study", label: "Period study" },
        { id: "thematic_study", label: "Thematic study" },
        { id: "british_depth", label: "British depth study" },
        { id: "world_depth", label: "Wider world depth study" },
        { id: "historic_environment", label: "Historic environment" },
        { id: "other", label: "Other studied content" },
      ],
    };
  if (/religio/i.test(s))
    return {
      title: "Studied content",
      hint: "e.g. Christianity, Islam",
      placeholder: "e.g. Christianity \u2014 beliefs and practices",
      description:
        "The religions and themes you study \u2014 questions will target these.",
      roles: [
        { id: "religion_beliefs", label: "Religion \u2014 beliefs" },
        { id: "religion_practices", label: "Religion \u2014 practices" },
        { id: "thematic_study", label: "Thematic study" },
        { id: "textual_study", label: "Textual study" },
        { id: "other", label: "Other studied content" },
      ],
    };
  if (/english|literature/i.test(s))
    return {
      title: "Studied texts",
      hint: "e.g. Othello, An Inspector Calls",
      placeholder: "Title, e.g. Othello",
      description:
        "The exact texts you study \u2014 questions will target these. Public-domain texts get real passage questions; in-copyright texts get essay questions.",
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
    title: "Studied content",
    hint: "units, case studies, set works",
    placeholder: "e.g. a unit, case study or set work",
    description:
      "The exact content you study \u2014 questions will target these.",
    roles: [
      { id: "studied_unit", label: "Studied unit / topic" },
      { id: "case_study", label: "Case study" },
      { id: "set_work", label: "Set work / key text" },
      { id: "other", label: "Other studied content" },
    ],
  };
}

interface BiologyBCustomSettings {
  topics: string[];
  writtenCount: number;
  mcqCount: number;
  timeLimitMinutes: string;
  advanced: AdvancedSettings;
  questionStructure: string;
  parentQuestionCount: number;
  maxPartsPerQuestion: number;
  mcqOptionsCount: number;
  includeGraphs: boolean;
  includeTables: boolean;
  blueprintEnabled: boolean;
  blueprintSections: Array<{
    title: string;
    questions: Array<{ marks: number; style: string }>;
    answerCount?: number;
  }>;
  interactiveResponses: boolean;
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
    structureSettings?: QuestionStructureSettings,
  ) => void;
  initialData?: {
    id?: string;
    profile_template?: unknown;
    paper_blueprint?: unknown;
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
    /** Independent of educational_tier. null/absent = unknown (legacy). */
    assessment_tier?: string | null;
    exam_board?: string | null;
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
  const [builderOpen, setBuilderOpen] = useState(false);
  const userRegion = detectRegionKey(preferences?.curriculum_region);
  const [step, setStep] = useState<"basics" | "paper" | "layout" | "review">(
    "basics",
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [profileName, setProfileName] = useState("");
  const isTextBasedSubject = /english|literature|history|religio/i.test(
    subjectName || "",
  );
  const studiedContentCfg = getStudiedContentConfig(subjectName || "");
  const [studiedTexts, setStudiedTexts] = useState<
    Array<{ role: string; title: string }>
  >([]);
  const [newTextRole, setNewTextRole] = useState(
    getStudiedContentConfig(subjectName || "").roles[0].id,
  );
  const [newTextTitle, setNewTextTitle] = useState("");
  const [blueprintEnabled, setBlueprintEnabled] = useState(false);
  const [blueprintSections, setBlueprintSections] = useState<
    Array<{
      title: string;
      questions: Array<{ marks: number; style: string }>;
      answerCount?: number;
    }>
  >([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [writtenCount, setWrittenCount] = useState(10);
  const [mcqCount, setMcqCount] = useState(0);
  const [educationalTier, setEducationalTier] = useState("");
  const [customTier, setCustomTier] = useState("");
  // Assessment tier (Foundation/Higher) — separate from the qualification
  // level above. null means "not recorded"; we never infer one.
  const [assessmentTier, setAssessmentTier] = useState<AssessmentTier | null>(
    null,
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<string>("");
  const [advanced, setAdvanced] = useState<AdvancedSettings>(DEFAULT_ADVANCED);

  // Question structure state
  const [questionStructure, setQuestionStructure] = useState("standalone");
  const [parentQuestionCount, setParentQuestionCount] = useState(4);
  const [maxPartsPerQuestion, setMaxPartsPerQuestion] = useState(3);
  const [mcqOptionsCount, setMcqOptionsCount] = useState(4);
  const [includeGraphs, setIncludeGraphs] = useState(false);
  const [includeTables, setIncludeTables] = useState(false);
  // Guided paper mode. "custom" keeps every manual count and media toggle.
  const [interactiveResponses, setInteractiveResponses] = useState(false);
  const [visualAssessment, setVisualAssessment] = useState(false);
  const [biologyBCustom, setBiologyBCustom] =
    useState<BiologyBCustomSettings | null>(null);
  const [paperMode, setPaperMode] = useState<PaperMode>("custom");
  const [planApplied, setPlanApplied] = useState(false);
  const [savedContractVersion, setSavedContractVersion] = useState<
    number | undefined
  >();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  const totalQuestionCount = writtenCount + mcqCount;
  const isMcqOnlyProfile = mcqCount > 0 && writtenCount === 0;

  // Structure sync (single source of truth): with sub-parts, the written
  // count IS parents × parts — the slider locks and derives. With mixed,
  // parents are a subset of the written questions.
  const blueprintTotalQuestions = blueprintSections.reduce(
    (n, s) => n + s.questions.length,
    0,
  );
  const blueprintTotalMarks = blueprintSections.reduce(
    (n, s) => n + s.questions.reduce((m, q) => m + (Number(q.marks) || 0), 0),
    0,
  );
  const blueprintCountedMarks = blueprintSections.reduce((n, s) => {
    const marks = s.questions
      .map((q) => Number(q.marks) || 0)
      .sort((a, b) => b - a);
    const take =
      s.answerCount && s.answerCount < marks.length
        ? s.answerCount
        : marks.length;
    return n + marks.slice(0, take).reduce((m, v) => m + v, 0);
  }, 0);
  const blueprintActive = blueprintEnabled && blueprintTotalQuestions > 0;
  const structureLocksWritten =
    (!isMcqOnlyProfile && questionStructure === "sub_questions") ||
    blueprintActive;
  useEffect(() => {
    if (structureLocksWritten && paperMode === "custom") {
      const derived = blueprintActive
        ? Math.min(20, blueprintTotalQuestions)
        : Math.min(20, parentQuestionCount * maxPartsPerQuestion);
      if (writtenCount !== derived) setWrittenCount(derived);
    }
  }, [
    structureLocksWritten,
    parentQuestionCount,
    maxPartsPerQuestion,
    blueprintActive,
    blueprintTotalQuestions,
    paperMode,
  ]);
  useEffect(() => {
    if (
      paperMode === "custom" &&
      !isMcqOnlyProfile &&
      questionStructure === "mixed" &&
      parentQuestionCount > writtenCount
    ) {
      setParentQuestionCount(Math.max(1, writtenCount));
    }
  }, [questionStructure, writtenCount, paperMode]);

  useEffect(() => {
    if (open) {
      setBuilderOpen(!!initialData?.profile_template);
      setStep(initialData ? "review" : "basics");
      setAdvancedOpen(false);
      setStepError(null);
      setProfileName(initialData?.profile_name || "");
      setSelectedTopics(initialData?.topics || []);
      setStudiedTexts(
        Array.isArray((initialData as any)?.studied_texts)
          ? (initialData as any).studied_texts
          : [],
      );
      const bp = (initialData as any)?.paper_blueprint;
      setBiologyBCustom(bp?.biologyBCustomSettings ?? null);
      setInteractiveResponses(bp?.responseFormats === "interactive_v1");
      setVisualAssessment(bp?.visualAssessment === "ocr_h420_03_visual_v1");
      setSelectedCourseId(profileCourseId(bp));
      setSelectedPaperId(profilePaperId(bp));
      const bpSections = Array.isArray(bp?.sections) ? bp.sections : [];
      setBlueprintSections(bpSections);
      setBlueprintEnabled(bpSections.length > 0);
      const initWritten =
        initialData?.written_question_count ??
        (initialData?.question_count
          ? Math.max(
              initialData.question_count - (initialData.mcq_count ?? 0),
              5,
            )
          : 10);
      setWrittenCount(initWritten);
      setMcqCount(initialData?.mcq_count ?? 0);
      // Pre-fill educational tier from profile if no initial data.
      // Only accept known level ids — legacy/raw codes like "level3_a_level"
      // are ignored so the field shows "Select level..." rather than an ugly
      // pre-populated "Other qualification" with a raw code in the text box.
      const rawTier =
        initialData?.educational_tier ||
        preferences?.preferred_educational_level ||
        "";
      const knownAlevel = getCourseOptions({
        subject: subjectName,
        examBoard: initialData?.exam_board ?? examBoard,
        educationalTier: rawTier,
      }).some(
        (course) =>
          course.tierMode === "untiered" &&
          course.curriculum?.qualification === "A-level",
      );
      if (knownAlevel) {
        setEducationalTier("level3");
        setCustomTier("");
      } else if (rawTier && isKnownLevel(rawTier)) {
        setEducationalTier(rawTier);
        setCustomTier("");
      } else {
        setEducationalTier("");
        setCustomTier("");
      }
      // Legacy profiles have no stored assessment tier — stay unknown.
      setAssessmentTier(normaliseAssessmentTier(initialData?.assessment_tier));
      setTimeLimitMinutes(
        initialData?.time_limit_minutes != null
          ? String(initialData.time_limit_minutes)
          : "",
      );
      setAdvanced({
        structurePreset: initialData?.structure_preset || "custom",
        mcqCount: initialData?.mcq_count ?? 0,
        mcqPosition: initialData?.mcq_position || "start",
        markDistribution:
          (initialData?.mark_distribution as Record<number, number>) || {},
        includeExtended: initialData?.include_extended ?? false,
        extendedMarks: initialData?.extended_marks ?? 0,
        difficultyProgression:
          initialData?.difficulty_progression || "ascending",
        calculatorPolicy: initialData?.calculator_policy || "allowed",
      });
      setQuestionStructure(initialData?.question_structure || "standalone");
      setParentQuestionCount(initialData?.parent_question_count ?? 4);
      setMaxPartsPerQuestion(initialData?.max_parts_per_question ?? 3);
      setMcqOptionsCount(initialData?.mcq_options_count ?? 4);
      setIncludeGraphs(initialData?.include_graphs ?? false);
      setIncludeTables(initialData?.include_tables ?? false);
      const storedContract = (initialData as any)?.paper_blueprint
        ?.paperContract;
      setPaperMode((storedContract?.mode as PaperMode) ?? "custom");
      setSavedContractVersion(storedContract?.contractVersion);
      const storedDefinition = storedContract
        ? biologyPaperDefinition(
            storedContract.courseId,
            normaliseAssessmentTier(initialData?.assessment_tier),
            storedContract.paperId,
            storedContract.contractVersion,
          )
        : null;
      setPlanApplied(
        !!storedDefinition &&
          storedContract.mode !== "custom" &&
          (!storedDefinition.specificationVersion ||
            storedContract.specificationVersion ===
              storedDefinition.specificationVersion),
      );
    }
  }, [open, initialData]);

  // Sync MCQ count between main slider and advanced settings
  useEffect(() => {
    if (advanced.mcqCount !== mcqCount) {
      setAdvanced((prev) => ({ ...prev, mcqCount }));
    }
  }, [mcqCount]);

  const allTopics = useMemo(() => {
    const dictTopics = getLocalSubtopics(subjectName);
    return [...new Set([...availableTopics, ...dictTopics])];
  }, [subjectName, availableTopics]);

  const finalTier =
    educationalTier === "other" ? customTier.trim() : educationalTier;
  const courseLookup = {
    subject: subjectName,
    examBoard: initialData?.exam_board ?? examBoard ?? null,
    educationalTier: finalTier,
    courseId: selectedCourseId,
  };
  const assessmentTierOptions = getAssessmentTierOptions(courseLookup);
  const courseCapability = getCourseCapability(courseLookup);
  const effectiveAssessmentTier =
    courseCapability?.tierMode === "untiered"
      ? "not_tiered"
      : assessmentTierOptions.length > 0
        ? assessmentTier
        : null;
  const availablePresets = BLUEPRINT_PRESETS.filter(
    (pr) =>
      pr.subjects.test(subjectName || "") &&
      (!finalTier || pr.levels.test(finalTier)) &&
      (!examBoard || pr.boards.test(examBoard) || pr.boards.source === "."),
  );
  const supportsGuidedPaper = supportsBiologyPaperContract({
    subject: subjectName,
    examBoard: initialData?.exam_board ?? examBoard ?? null,
    educationalLevel: finalTier,
    courseId: selectedCourseId,
    paperId: selectedPaperId,
  });
  const explicitCourseNeeded = getCourseOptions(courseLookup).length > 1;
  const selectedTier = effectiveAssessmentTier;
  const guidedActive =
    paperMode !== "custom" &&
    planApplied &&
    supportsGuidedPaper &&
    !!selectedTier;
  const paperDefinition = biologyPaperDefinition(
    courseCapability?.id ?? null,
    selectedTier,
    selectedPaperId,
  );
  const currentPlan = guidedActive
    ? buildPaperPlan(
        paperMode,
        selectedTier,
        courseCapability?.id,
        selectedPaperId,
        savedContractVersion,
      )
    : null;
  const effectiveTopics =
    currentPlan?.parts.some((p) => p.assessmentRole === "synoptic_essay") ||
    (currentPlan?.courseId === OCR_ALEVEL_BIOLOGY_ID &&
      currentPlan.paperId === "paper_3")
      ? [...(paperDefinition?.topics ?? [])]
      : currentPlan
        ? [...new Set(currentPlan.parts.map((p) => p.topic))]
        : selectedTopics;
  const configurationReady =
    (!explicitCourseNeeded ||
      (!!courseCapability &&
        courseCapability.generationAvailable !== false &&
        !!selectedTier)) &&
    (![
      EDEXCEL_BIOLOGY_ID,
      EDEXCEL_ALEVEL_BIOLOGY_B_ID,
      OCR_21C_BIOLOGY_ID,
      WJEC_BIOLOGY_ID,
      AQA_ALEVEL_BIOLOGY_ID,
      OCR_ALEVEL_BIOLOGY_ID,
    ].includes(courseCapability?.id ?? "") ||
      (!!selectedPaperId && !!selectedTier)) &&
    (!selectedPaperId || !!paperDefinition) &&
    (selectedPaperId !== "paper_2" || !!selectedTier) &&
    (paperMode === "custom" || !!currentPlan);

  // Explicit conversion only — nothing is overwritten until the user accepts.
  const applyGuidedPlan = (plan: PaperPlan) => {
    if (
      plan.courseId === EDEXCEL_ALEVEL_BIOLOGY_B_ID &&
      !guidedActive &&
      !biologyBCustom
    ) {
      setBiologyBCustom({
        topics: [...selectedTopics],
        writtenCount,
        mcqCount,
        timeLimitMinutes,
        advanced: structuredClone(advanced),
        questionStructure,
        parentQuestionCount,
        maxPartsPerQuestion,
        mcqOptionsCount,
        includeGraphs,
        includeTables,
        blueprintEnabled,
        blueprintSections: structuredClone(blueprintSections),
        interactiveResponses,
      });
    }
    setSavedContractVersion(plan.contractVersion);
    setMcqCount(
      plan.parts.filter((p) => p.responseType === "mcq_single").length,
    );
    setWrittenCount(
      plan.parts.filter((p) => p.responseType !== "mcq_single").length,
    );
    setParentQuestionCount(plan.parentCount);
    setQuestionStructure(
      [
        OCR_GATEWAY_BIOLOGY_ID,
        EDEXCEL_BIOLOGY_ID,
        EDEXCEL_ALEVEL_BIOLOGY_B_ID,
        OCR_21C_BIOLOGY_ID,
        WJEC_BIOLOGY_ID,
        AQA_ALEVEL_BIOLOGY_ID,
        OCR_ALEVEL_BIOLOGY_ID,
      ].includes(plan.courseId)
        ? "mixed"
        : "sub_questions",
    );
    setMcqOptionsCount(4);
    setBlueprintEnabled(false);
    setBlueprintSections([]);
    setAdvanced((prev) => ({
      ...prev,
      mcqPosition: [
        EDEXCEL_BIOLOGY_ID,
        EDEXCEL_ALEVEL_BIOLOGY_B_ID,
        OCR_21C_BIOLOGY_ID,
        WJEC_BIOLOGY_ID,
      ].includes(plan.courseId)
        ? "mixed"
        : "start",
      markDistribution: {},
      includeExtended: false,
      extendedMarks: 0,
      calculatorPolicy: "allowed",
    }));
    setMaxPartsPerQuestion(
      Math.max(
        ...plan.parts.map(
          (p) => plan.parts.filter((q) => q.parentId === p.parentId).length,
        ),
      ),
    );
    setTimeLimitMinutes(String(plan.durationMinutes));
    setIncludeTables(plan.parts.some((p) => p.resource === "data_table"));
    setIncludeGraphs(plan.parts.some((p) => p.resource === "graph"));
    // Keep the user's manual topic selection while the guided view uses its
    // own plan topics. Switching back to Custom restores that selection.
    setPlanApplied(true);
  };

  const changePaperMode = (mode: PaperMode) => {
    if (
      courseCapability?.id === EDEXCEL_ALEVEL_BIOLOGY_B_ID &&
      mode === "custom" &&
      biologyBCustom
    ) {
      const c = biologyBCustom;
      setSelectedTopics([...c.topics]);
      setWrittenCount(c.writtenCount);
      setMcqCount(c.mcqCount);
      setTimeLimitMinutes(c.timeLimitMinutes);
      setAdvanced(structuredClone(c.advanced));
      setQuestionStructure(c.questionStructure);
      setParentQuestionCount(c.parentQuestionCount);
      setMaxPartsPerQuestion(c.maxPartsPerQuestion);
      setMcqOptionsCount(c.mcqOptionsCount);
      setIncludeGraphs(c.includeGraphs);
      setIncludeTables(c.includeTables);
      setBlueprintEnabled(c.blueprintEnabled);
      setBlueprintSections(structuredClone(c.blueprintSections));
      setInteractiveResponses(c.interactiveResponses);
      setBiologyBCustom(null); // A future conversion captures the latest manual settings.
    }
    setPaperMode(mode);
    setPlanApplied(mode === "custom");
    setSavedContractVersion(undefined);
  };
  const currentBlueprint = (() => {
        const courseSelection =
          (courseCapability?.id === OCR_GATEWAY_BIOLOGY_ID ||
            selectedPaperId) &&
          paperDefinition
            ? {
                courseId: courseCapability.id,
                paperId: paperDefinition.paperId,
                ...(paperDefinition.specificationVersion
                  ? {
                      specificationVersion:
                        paperDefinition.specificationVersion,
                    }
                  : {}),
              }
            : undefined;
        const customSnapshot =
          courseCapability?.id === EDEXCEL_ALEVEL_BIOLOGY_B_ID && biologyBCustom
            ? { biologyBCustomSettings: biologyBCustom }
            : {};
        if (!currentPlan)
          return blueprintActive || courseSelection
            ? {
                ...customSnapshot,
                ...(blueprintActive ? { sections: blueprintSections } : {}),
                ...(courseSelection ? { courseSelection } : {}),
              }
            : null;
        const useReviewedVisuals =
          visualAssessment &&
          currentPlan.courseId === OCR_ALEVEL_BIOLOGY_ID &&
          currentPlan.paperId === "paper_3";
        return {
          ...customSnapshot,
          ...(useReviewedVisuals
            ? { visualAssessment: "ocr_h420_03_visual_v1" }
            : {}),
          ...(interactiveResponses || useReviewedVisuals
            ? { responseFormats: "interactive_v1" }
            : {}),
          courseSelection: {
            courseId: currentPlan.courseId,
            paperId: currentPlan.paperId,
            ...(currentPlan.specificationVersion
              ? { specificationVersion: currentPlan.specificationVersion }
              : {}),
          },
          paperContract: {
            courseId: currentPlan.courseId,
            paperId: currentPlan.paperId,
            mode: currentPlan.mode,
            contractVersion: currentPlan.contractVersion,
            ...(currentPlan.specificationVersion
              ? { specificationVersion: currentPlan.specificationVersion }
              : {}),
          },
        };
        })();
  const approvalSettings = {
    ...initialData, subject_name:subjectName, profile_name:profileName,
    exam_board:initialData?.exam_board ?? examBoard ?? null, educational_tier:finalTier,
    topics:effectiveTopics,question_count:currentPlan?.partCount??totalQuestionCount,
    time_limit_minutes:currentPlan?.durationMinutes??(timeLimitMinutes?Number(timeLimitMinutes):null),
    mcq_count:currentPlan?currentPlan.parts.filter(p=>p.responseType==='mcq_single').length:mcqCount,
    written_question_count:currentPlan?currentPlan.parts.filter(p=>p.responseType!=='mcq_single').length:writtenCount,
    mcq_options_count:currentPlan?4:mcqOptionsCount,
    question_structure:isMcqOnlyProfile?'mcq_only':questionStructure,
    parent_question_count:currentPlan?.parentCount??parentQuestionCount,
    max_parts_per_question:currentPlan?Math.max(...currentPlan.parts.map(p=>currentPlan.parts.filter(q=>q.parentId===p.parentId).length)):maxPartsPerQuestion,
    mcq_position:advanced.mcqPosition,mark_distribution:advanced.markDistribution,
    include_extended:advanced.includeExtended,extended_marks:advanced.extendedMarks,
    difficulty_progression:advanced.difficultyProgression,calculator_policy:advanced.calculatorPolicy,
    include_graphs:currentPlan?currentPlan.parts.some(p=>p.resource==='graph'):includeGraphs,
    include_tables:currentPlan?currentPlan.parts.some(p=>p.resource==='data_table'):includeTables,
    assessment_tier:effectiveAssessmentTier,paper_blueprint:currentBlueprint,
    ...(isTextBasedSubject?{studied_texts:studiedTexts}:{}),
  };
  const currentApproval = evaluateApproval(approvalSettings,(initialData?.profile_template as any)?.presetId);
  const restoreApproval = () => {
    const id=currentApproval.entry?.id??(initialData?.profile_template as any)?.presetId;
    if(!id)return;
    try {const {plan,settings}=approvedPreset(id);setInteractiveResponses(false);setVisualAssessment(false);setSelectedCourseId(plan.courseId);setSelectedPaperId(plan.paperId);setAssessmentTier(plan.tier);setPaperMode(plan.mode);applyGuidedPlan(plan);setSelectedTopics(settings.topics);setAdvanced({...DEFAULT_ADVANCED,mcqCount:settings.mcq_count,mcqPosition:settings.mcq_position});}catch(error){setStepError((error as Error).message);}
  };

  const handleSave = () => {
    if (
      !profileName.trim() ||
      effectiveTopics.length === 0 ||
      !finalTier ||
      !configurationReady
    )
      return;
    const timeVal = timeLimitMinutes ? parseInt(timeLimitMinutes) : null;
    const advancedWithMcq = {
      ...advanced,
      mcqCount: currentPlan
        ? currentPlan.parts.filter((p) => p.responseType === "mcq_single")
            .length
        : mcqCount,
      assessmentTier: effectiveAssessmentTier,
      examBoard: initialData?.exam_board ?? examBoard ?? null,
      studiedTexts: isTextBasedSubject ? studiedTexts : undefined,
      paperBlueprint: currentBlueprint,
    };
    const resolvedQuestionStructure = isMcqOnlyProfile
      ? "mcq_only"
      : questionStructure;
    onSave(
      profileName.trim(),
      effectiveTopics,
      currentPlan?.partCount ?? totalQuestionCount,
      finalTier || undefined,
      currentPlan?.durationMinutes ?? timeVal,
      advancedWithMcq,
      currentPlan
        ? currentPlan.parts.filter((p) => p.responseType !== "mcq_single")
            .length
        : writtenCount,
      {
        questionStructure: resolvedQuestionStructure,
        parentQuestionCount: currentPlan?.parentCount ?? parentQuestionCount,
        maxPartsPerQuestion: currentPlan
          ? Math.max(
              ...currentPlan.parts.map(
                (p) =>
                  currentPlan.parts.filter((q) => q.parentId === p.parentId)
                    .length,
              ),
            )
          : maxPartsPerQuestion,
        mcqOptionsCount: currentPlan ? 4 : mcqOptionsCount,
        includeGraphs: currentPlan
          ? currentPlan.parts.some((p) => p.resource === "graph")
          : includeGraphs,
        includeTables: currentPlan
          ? currentPlan.parts.some((p) => p.resource === "data_table")
          : includeTables,
      },
    );
    onOpenChange(false);
  };

  const blueprintHasInvalidMarks =
    blueprintActive &&
    blueprintSections.some((section) =>
      section.questions.some(
        (question) => !question.marks || question.marks < 1,
      ),
    );
  const validTime =
    !timeLimitMinutes ||
    (Number.isInteger(Number(timeLimitMinutes)) &&
      Number(timeLimitMinutes) >= 1);
  const canSave =
    configurationReady &&
    !!profileName.trim() &&
    effectiveTopics.length > 0 &&
    !!finalTier &&
    !blueprintHasInvalidMarks &&
    validTime;
  const navigation: Array<{ id: ProfileStep; label: string }> = [
    { id: "basics", label: "Basics" },
    { id: "paper", label: "Your paper" },
    ...(!guidedActive && blueprintEnabled
      ? [{ id: "layout" as const, label: "Sections & marks" }]
      : []),
    { id: "review", label: "Review" },
  ];
  const goTo = (next: ProfileStep) => {
    setAdvancedOpen(false);
    setStepError(null);
    setStep(next);
    bodyRef.current?.scrollTo({ top: 0 });
  };
  const checkBasics = () =>
    !profileName.trim()
      ? "Give your profile a name."
      : !finalTier
        ? "Choose an educational level."
        : !configurationReady
          ? "Choose your course and paper, then apply the preset or choose Custom."
          : null;
  const checkPaper = () =>
    !effectiveTopics.length
      ? "Choose at least one topic."
      : !validTime
        ? "Enter a whole number of minutes above zero."
        : null;
  const continueStep = () => {
    const error =
      step === "basics"
        ? checkBasics()
        : step === "paper"
          ? checkPaper()
          : blueprintHasInvalidMarks
            ? "Give each question at least one mark."
            : !blueprintActive
              ? "Add a question or use simple structure."
              : null;
    if (error) {
      setStepError(error);
      return;
    }
    goTo(
      step === "basics"
        ? "paper"
        : step === "paper" && !guidedActive && blueprintEnabled
          ? "layout"
          : "review",
    );
  };
  const saveProfile = () => {
    const error =
      checkBasics() ||
      checkPaper() ||
      (blueprintHasInvalidMarks
        ? "Give each question at least one mark."
        : null);
    if (error) {
      setStepError(error);
      return;
    }
    handleSave();
  };
  const startLayout = () => {
    setBlueprintEnabled(true);
    if (!blueprintSections.length)
      setBlueprintSections([
        {
          title: "Section A",
          questions: [{ marks: 4, style: "Explain / describe" }],
        },
      ]);
    goTo("layout");
  };
  const preview = (expanded = false) => (
    <ProfilePaperPreview
      plan={currentPlan}
      sections={
        blueprintActive && !guidedActive ? blueprintSections : undefined
      }
      structure={questionStructure}
      writtenCount={writtenCount}
      mcqCount={mcqCount}
      mcqOptionsCount={mcqOptionsCount}
      parentCount={parentQuestionCount}
      maxParts={maxPartsPerQuestion}
      subjectName={subjectName}
      expanded={expanded}
    />
  );
  const presetCount = currentPlan?.partCount ?? totalQuestionCount;
  const topicSuggestions =
    finalTier && hasTopicSuggestions(subjectName)
      ? getTopicSuggestions(subjectName, finalTier)
      : [];
  const missingSaveReason =
    checkBasics() ||
    checkPaper() ||
    (blueprintHasInvalidMarks ? "Give each question at least one mark." : null);

  if (builderOpen) return <ExamProfileBuilder open={open} onOpenChange={onOpenChange}
    subjectName={subjectName} examBoard={initialData?.exam_board??examBoard}
    educationalLevel={initialData?.educational_tier??finalTier} initialProfile={initialData}
    onManual={()=>setBuilderOpen(false)} />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={(event) => {
          if (advancedOpen) {
            event.preventDefault();
            setAdvancedOpen(false);
          }
        }}
        className="exam-profile-settings sm:max-w-2xl h-[88vh] max-h-[88vh] flex flex-col p-0 gap-0 bg-card border-border overflow-hidden"
      >
        <DialogHeader className="shrink-0 px-5 sm:px-6 pt-5 pb-4 border-b border-border text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogDescription
                className="mb-1 text-xs font-medium"
                style={{ color: subjectColor }}
              >
                {subjectName}
                {(initialData?.exam_board ?? examBoard)
                  ? ` · ${initialData?.exam_board ?? examBoard}`
                  : ""}
              </DialogDescription>
              <DialogTitle className="font-serif text-[25px] font-semibold leading-tight">
                {initialData ? "Edit exam profile" : "Create exam profile"}
              </DialogTitle>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label="Advanced settings"
                title="Advanced settings"
                aria-expanded={advancedOpen}
                aria-controls="profile-advanced-panel"
                onClick={() => setAdvancedOpen((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <DialogClose
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogClose>
            </div>
          </div>
          <div className="!mt-3 flex flex-wrap items-center justify-between gap-2">
            <ProfileApprovalBadge profile={approvalSettings}/>
            <Button type="button" size="sm" variant="outline" onClick={()=>setBuilderOpen(true)}>Build profile for me</Button>
          </div>
          {currentApproval.status==='customised'&&<Button type="button" variant="ghost" size="sm" onClick={restoreApproval}>Restore approved settings</Button>}
          <nav
            aria-label="Profile setup"
            className="!mt-4 flex items-center gap-1 rounded-md bg-muted/50 p-1"
          >
            {navigation.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(item.id)}
                aria-label={item.label}
                aria-current={step === item.id ? "step" : undefined}
                className={`min-h-9 min-w-0 flex-1 rounded px-1.5 text-xs transition-colors ${step === item.id ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span className="mr-1.5 hidden sm:inline tabular-nums opacity-60">
                  {i + 1}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </DialogHeader>

        <div
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4"
          style={{ "--scroll-accent": subjectColor } as React.CSSProperties}
        >
          {advancedOpen ? (
            <section
              id="profile-advanced-panel"
              className="mx-auto max-w-md space-y-5"
            >
              <h2 className="font-serif text-xl">Advanced settings</h2>
              {guidedActive ? (
                <p className="text-sm text-muted-foreground">
                  The preset sets these options. Choose Custom in Basics to
                  change them.
                </p>
              ) : (
                <ExamProfileAdvanced
                  settings={advanced}
                  onChange={setAdvanced}
                  questionLimit={writtenCount}
                  subjectColor={subjectColor}
                  curriculumRegion={preferences?.curriculum_region}
                  embedded
                />
              )}
            </section>
          ) : (
            <>
              {step === "basics" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-[1.15fr_1fr] gap-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="profile-name"
                        className="text-xs text-muted-foreground"
                      >
                        Profile name
                      </Label>
                      <Input
                        id="profile-name"
                        placeholder="e.g. Paper 1 revision"
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Educational level
                      </Label>
                      <select
                        aria-label="Educational level"
                        value={educationalTier}
                        onChange={(event) => {
                          setEducationalTier(event.target.value);
                          setSelectedCourseId(null);
                          setSelectedPaperId(null);
                          setAssessmentTier(null);
                          setPaperMode("custom");
                          setPlanApplied(false);
                          if (event.target.value !== "other") setCustomTier("");
                        }}
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="" disabled>
                          Select level
                        </option>
                        {EDUCATIONAL_LEVELS.map((group) => (
                          <optgroup key={group.group} label={group.group}>
                            {group.levels.map((level) => (
                              <option key={level.id} value={level.id}>
                                {level.label}
                                {userRegion && level.aliases[userRegion]
                                  ? ` · ${level.aliases[userRegion]}`
                                  : ""}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                  {educationalTier === "other" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-custom-level">
                        Qualification
                      </Label>
                      <Input
                        id="profile-custom-level"
                        value={customTier}
                        onChange={(event) => setCustomTier(event.target.value)}
                        placeholder="e.g. HNC, degree module or certification"
                      />
                    </div>
                  )}
                  <BiologyCourseSelector
                    compact
                    lookup={courseLookup}
                    value={selectedCourseId}
                    tier={selectedTier}
                    onChange={(id) => {
                      setBiologyBCustom(null);
                      setSelectedCourseId(id);
                      setSelectedPaperId(null);
                      setAssessmentTier(null);
                      setPaperMode("short_practice");
                      setPlanApplied(false);
                    }}
                  />
                  {assessmentTierOptions.length > 0 && (
                    <AssessmentTierSelector
                      options={assessmentTierOptions}
                      value={effectiveAssessmentTier}
                      onChange={(tier) => {
                        setAssessmentTier(tier);
                        setPlanApplied(false);
                      }}
                      accentColor={subjectColor}
                      courseLabel={courseCapability?.label ?? null}
                    />
                  )}
                  <BiologyPaperSelector
                    mode={paperMode}
                    contractVersion={planApplied?savedContractVersion:undefined}
                    compact
                    courseId={courseCapability?.id ?? null}
                    value={selectedPaperId}
                    tier={selectedTier}
                    onChange={(id) => {
                      setSelectedPaperId(id);
                      setPlanApplied(false);
                      setSavedContractVersion(undefined);
                    }}
                  />
                  {supportsGuidedPaper && (
                    <PaperModeSelector
                      compact
                      courseId={courseCapability?.id}
                      paperId={selectedPaperId}
                      mode={paperMode}
                      tier={effectiveAssessmentTier}
                      contractVersion={
                        planApplied ? savedContractVersion : undefined
                      }
                      onModeChange={changePaperMode}
                      onApplyPlan={applyGuidedPlan}
                      applied={planApplied}
                    />
                  )}
                  <section
                    className="space-y-3 border-t border-border pt-4"
                    aria-label="Question mix"
                  >
                    <div className="flex justify-between">
                      <h3 className="text-sm font-semibold">Questions</h3>
                      {(guidedActive || structureLocksWritten) && (
                        <span className="text-xs text-muted-foreground">
                          {guidedActive ? "Preset" : "From your layout"}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <NumberControl
                        label={
                          guidedActive || questionStructure === "sub_questions"
                            ? "Written parts"
                            : "Written questions"
                        }
                        value={writtenCount}
                        max={20}
                        disabled={guidedActive || structureLocksWritten}
                        onChange={(value) => {
                          if (value || mcqCount) setWrittenCount(value);
                        }}
                      />
                      <NumberControl
                        label="Multiple choice"
                        value={mcqCount}
                        max={30}
                        disabled={guidedActive || blueprintActive}
                        onChange={(value) => {
                          if (value || writtenCount) setMcqCount(value);
                        }}
                      />
                    </div>
                  </section>
                </div>
              )}

              {step === "paper" && (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start gap-5">
                  <section
                    aria-label="Question structure"
                    className="space-y-3"
                  >
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <h3 className="text-sm font-semibold">Structure</h3>
                      {guidedActive ? (
                        <span className="text-xs text-muted-foreground">
                          Preset
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={startLayout}
                          className="min-h-9 text-xs font-medium text-foreground underline decoration-border-strong underline-offset-4"
                        >
                          {blueprintEnabled
                            ? "Edit sections & marks"
                            : "Customise sections & marks"}
                        </button>
                      )}
                    </div>
                    {guidedActive || blueprintActive ? (
                      preview()
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          {!isMcqOnlyProfile && (
                            <div
                              role="group"
                              aria-label="Question organisation"
                              className="flex gap-1.5"
                            >
                              {[
                                { id: "standalone", label: "Standalone" },
                                { id: "sub_questions", label: "Sub-parts" },
                                { id: "mixed", label: "Mixed" },
                              ].map((option) => (
                                <button
                                  type="button"
                                  key={option.id}
                                  aria-pressed={questionStructure === option.id}
                                  onClick={() =>
                                    setQuestionStructure(option.id)
                                  }
                                  className={`flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-1.5 text-xs ${questionStructure === option.id ? "border-border-strong bg-muted font-medium" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
                                >
                                  <span>{option.label}</span>
                                  {questionStructure === option.id && (
                                    <Check
                                      className="h-3.5 w-3.5"
                                      style={{ color: subjectColor }}
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          {isMcqOnlyProfile && (
                            <div>
                              <label
                                htmlFor="profile-options"
                                className="mb-1.5 block text-xs text-muted-foreground"
                              >
                                Options per question
                              </label>
                              <select
                                id="profile-options"
                                value={mcqOptionsCount}
                                onChange={(event) =>
                                  setMcqOptionsCount(Number(event.target.value))
                                }
                                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                              >
                                <option value={3}>3 options</option>
                                <option value={4}>4 options</option>
                              </select>
                            </div>
                          )}
                        </div>
                        {preview()}
                      </div>
                    )}
                    {!guidedActive &&
                      !blueprintActive &&
                      !isMcqOnlyProfile &&
                      (questionStructure === "sub_questions" ||
                        questionStructure === "mixed") && (
                        <div className="space-y-2">
                          <NumberControl
                            label="Questions with parts"
                            value={parentQuestionCount}
                            min={1}
                            max={10}
                            onChange={setParentQuestionCount}
                          />
                          <NumberControl
                            label="Parts per question"
                            value={maxPartsPerQuestion}
                            min={2}
                            max={6}
                            onChange={setMaxPartsPerQuestion}
                          />
                        </div>
                      )}
                    {!guidedActive && isMcqOnlyProfile && (
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {[
                          {
                            label: "Graph questions",
                            value: includeGraphs,
                            change: setIncludeGraphs,
                          },
                          {
                            label: "Data tables",
                            value: includeTables,
                            change: setIncludeTables,
                          },
                        ].map((option) => (
                          <label
                            key={option.label}
                            className="flex min-h-10 items-center gap-2 text-xs"
                          >
                            <Switch
                              checked={option.value}
                              onCheckedChange={option.change}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    )}
                    {guidedActive && (
                      <label className="flex items-start gap-2.5 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={interactiveResponses}
                          onChange={(event) =>
                            setInteractiveResponses(event.target.checked)
                          }
                        />
                        <span>
                          Interactive answer formats{" "}
                          <span className="text-muted-foreground">
                            (preview)
                          </span>
                        </span>
                      </label>
                    )}
                    {guidedActive &&
                      currentPlan?.courseId === OCR_ALEVEL_BIOLOGY_ID &&
                      currentPlan.paperId === "paper_3" && (
                        <label className="flex items-start gap-2.5 text-xs">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={visualAssessment}
                            disabled={
                              !APPROVED_VISUAL_FILES.length && !visualAssessment
                            }
                            onChange={(event) =>
                              setVisualAssessment(event.target.checked)
                            }
                          />
                          <span>
                            Reviewed Biology visual assessments
                            {!APPROVED_VISUAL_FILES.length && (
                              <span className="block text-muted-foreground">
                                No approved images available yet.
                              </span>
                            )}
                          </span>
                        </label>
                      )}
                  </section>
                  <div className="min-w-0 border-t border-border pt-4 sm:border-t-0 sm:pt-0">
                    <ProfileTopicBrowser
                      allTopics={
                        guidedActive
                          ? effectiveTopics
                          : [...new Set([...allTopics, ...topicSuggestions])]
                      }
                      selectedTopics={effectiveTopics}
                      onChange={setSelectedTopics}
                      subjectName={subjectName}
                      accent={subjectColor}
                      locked={guidedActive}
                    />
                  </div>
                  {isTextBasedSubject && !guidedActive && (
                    <section className="space-y-3 border-t border-border pt-4 sm:col-span-2">
                      <h3 className="text-sm font-semibold">
                        {studiedContentCfg.title}
                      </h3>
                      {studiedTexts.map((text, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-[11px] text-muted-foreground">
                              {studiedContentCfg.roles.find(
                                (role) => role.id === text.role,
                              )?.label ?? text.role}
                            </span>
                            <span className="text-sm">{text.title}</span>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${text.title}`}
                            onClick={() =>
                              setStudiedTexts(
                                studiedTexts.filter((_, j) => j !== i),
                              )
                            }
                            className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <select
                          aria-label="Studied content type"
                          value={newTextRole}
                          onChange={(event) =>
                            setNewTextRole(event.target.value)
                          }
                          className="h-10 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {studiedContentCfg.roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                        <Input
                          aria-label={studiedContentCfg.title}
                          value={newTextTitle}
                          onChange={(event) =>
                            setNewTextTitle(event.target.value)
                          }
                          placeholder={studiedContentCfg.placeholder}
                          className="min-w-[140px] flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!newTextTitle.trim()}
                          onClick={() => {
                            setStudiedTexts([
                              ...studiedTexts,
                              { role: newTextRole, title: newTextTitle.trim() },
                            ]);
                            setNewTextTitle("");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </section>
                  )}
                  <div className="sm:col-span-2">
                    <ProfileTimeLimit
                      value={
                        currentPlan
                          ? String(currentPlan.durationMinutes)
                          : timeLimitMinutes
                      }
                      onChange={setTimeLimitMinutes}
                      locked={guidedActive}
                    />
                  </div>
                </div>
              )}

              {step === "layout" && (
                <ProfileLayoutEditor
                  sections={blueprintSections}
                  onChange={setBlueprintSections}
                  presets={availablePresets}
                  presetId={advanced.structurePreset}
                  subjectName={subjectName}
                  onRemove={() => {
                    setBlueprintEnabled(false);
                    goTo("paper");
                  }}
                  onPresetChange={(id) => {
                    const preset = availablePresets.find(
                      (value) => value.id === id,
                    );
                    if (preset)
                      setBlueprintSections(structuredClone(preset.sections));
                    setAdvanced((previous) => ({
                      ...previous,
                      structurePreset: id || "custom",
                    }));
                  }}
                />
              )}

              {step === "review" && (
                <div className="space-y-5">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h2 className="font-serif text-xl leading-snug">
                        {profileName.trim() || "Your exam profile"}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {paperDefinition && (guidedActive || selectedPaperId)
                          ? paperDefinition.displayName
                          : ALL_LEVELS.find((value) => value.id === finalTier)
                              ?.label || humaniseTier(finalTier)}
                        {effectiveAssessmentTier &&
                        effectiveAssessmentTier !== "not_tiered"
                          ? ` · ${effectiveAssessmentTier === "higher" ? "Higher" : "Foundation"}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goTo("basics")}
                      className="flex min-h-9 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit basics
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 text-xs">
                    <span>
                      <strong className="font-semibold tabular-nums">
                        {presetCount}
                      </strong>{" "}
                      {currentPlan || questionStructure === "sub_questions"
                        ? "parts"
                        : "questions"}
                    </span>
                    {currentPlan && (
                      <span>
                        <strong className="font-semibold tabular-nums">
                          {currentPlan.totalMarks}
                        </strong>{" "}
                        marks
                      </span>
                    )}
                    {blueprintActive && !currentPlan && (
                      <span>
                        <strong className="font-semibold tabular-nums">
                          {blueprintCountedMarks}
                        </strong>{" "}
                        marks counted
                      </span>
                    )}
                    <span>
                      <strong className="font-semibold tabular-nums">
                        {currentPlan?.durationMinutes ?? timeLimitMinutes}
                      </strong>{" "}
                      {timeLimitMinutes || currentPlan
                        ? "minutes"
                        : "No time limit"}
                    </span>
                    <span>
                      <strong className="font-semibold tabular-nums">
                        {effectiveTopics.length}
                      </strong>{" "}
                      topics
                    </span>
                  </div>
                  {preview(true)}
                  <section className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-semibold">Topics</h3>
                      <button
                        type="button"
                        onClick={() => goTo("paper")}
                        className="min-h-9 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {guidedActive ? "View paper" : "Edit paper"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {effectiveTopics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-md bg-muted px-2.5 py-1.5 text-xs"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </section>
                  {isTextBasedSubject && studiedTexts.length > 0 && (
                    <section>
                      <h3 className="mb-2 text-sm font-semibold">
                        {studiedContentCfg.title}
                      </h3>
                      <div className="space-y-1.5">
                        {studiedTexts.map((text, i) => (
                          <p key={i} className="text-sm text-muted-foreground">
                            {text.title}
                          </p>
                        ))}
                      </div>
                    </section>
                  )}
                  {blueprintActive && !guidedActive && (
                    <button
                      type="button"
                      onClick={() => goTo("layout")}
                      className="min-h-9 text-xs font-medium underline decoration-border-strong underline-offset-4"
                    >
                      Edit sections & marks
                    </button>
                  )}
                  {missingSaveReason && (
                    <p role="status" className="text-sm text-muted-foreground">
                      {missingSaveReason}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {stepError && (
          <p
            role="alert"
            className="shrink-0 border-t border-border px-5 sm:px-6 py-2.5 text-xs text-destructive"
          >
            {stepError}
          </p>
        )}
        <DialogFooter className="shrink-0 flex-row items-center justify-between border-t border-border bg-card px-3 sm:px-6 py-3 gap-2">
          {advancedOpen ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAdvancedOpen(false)}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                step === "basics"
                  ? onOpenChange(false)
                  : goTo(
                      step === "review"
                        ? !guidedActive && blueprintEnabled
                          ? "layout"
                          : "paper"
                        : step === "layout"
                          ? "paper"
                          : "basics",
                    )
              }
              className="px-2 text-muted-foreground"
            >
              {step !== "basics" && (
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              )}
              {step === "basics" ? "Cancel" : "Back"}
            </Button>
          )}
          <div className="flex min-w-0 items-center gap-2">
            {!advancedOpen && step !== "review" && (
              <Button
                type="button"
                className="px-3 sm:px-4"
                variant={initialData ? "outline" : "default"}
                onClick={continueStep}
              >
                {step === "basics"
                  ? "Continue"
                  : step === "paper" && !guidedActive && blueprintEnabled
                    ? "Sections & marks"
                    : "Review"}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
            {advancedOpen && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdvancedOpen(false)}
              >
                Done
              </Button>
            )}
            {((!advancedOpen && step === "review") || initialData) && (
              <Button
                type="button"
                aria-label={initialData ? "Update Profile" : "Create Profile"}
                onClick={saveProfile}
                disabled={!canSave}
                style={{ backgroundColor: subjectColor }}
                className="px-3 sm:px-4 text-white disabled:opacity-50"
              >
                <span className="sm:hidden">
                  {initialData ? "Save" : "Create"}
                </span>
                <span className="hidden sm:inline">
                  {initialData ? "Update Profile" : "Create Profile"}
                </span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
