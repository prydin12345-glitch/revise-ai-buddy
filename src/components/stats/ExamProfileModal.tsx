import {ExamProfileBuilder} from "@/components/profiles/ExamProfileBuilder";
import {ProfileApprovalBadge} from "@/components/profiles/ExamlyApprovalBadge";
import {evaluateApproval,approvedPreset} from "../../../supabase/functions/_shared/preset-approval";
import { APPROVED_VISUAL_FILES } from "../../../supabase/functions/_shared/biology-visual-public";
import { useState, useEffect, useMemo, useRef } from "react";
import { useWorkspaceSession } from "@/hooks/use-workspace-session";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  ArrowRight,
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
import { CustomProfileTopics } from "./profile/CustomProfileTopics";
import { profileTopicLabel, type ProfileTopicPresentationEdit } from "@/lib/profile-topic-presentation";
import { preserveCustomProfilePayload, type ProfileSaveArgs, type ProfileSaveResult } from "@/lib/custom-profile-save";
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

type ProfileStep = "topics" | "settings" | "layout";

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
    <label className="flex flex-col gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
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
        className="min-h-11 w-full text-foreground tabular-nums"
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
  /** Enter the assistant directly from a subject; the manual editor stays available. */
  initialBuilder?: boolean;
  availableTopics: string[];
  onSave: (...args: ProfileSaveArgs) => void | ProfileSaveResult | Promise<void | ProfileSaveResult>;
  /** Shown only when editing a saved profile. Resolves after the delete finishes. */
  onDelete?: (profileId: string) => Promise<boolean>;
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
  initialBuilder = false,
  availableTopics,
  onSave,
  onDelete,
  initialData,
}: ExamProfileModalProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { preferences } = useUserPreferences();
  const { ownerId } = useWorkspaceSession();
  const [builderOpen, setBuilderOpen] = useState(false);
  const userRegion = detectRegionKey(preferences?.curriculum_region);
  const [step, setStep] = useState<ProfileStep>(
    "settings",
  );
  const [setupComplete, setSetupComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [manualStructureTouched, setManualStructureTouched] = useState(false);
  const [paperConfigurationTouched, setPaperConfigurationTouched] = useState(false);
  const [explicitPlanApplied, setExplicitPlanApplied] = useState(false);
  const [hydrationKey, setHydrationKey] = useState(0);
  const [topicEdits, setTopicEdits] = useState<ProfileTopicPresentationEdit[]>([]);
  const [topicUndo, setTopicUndo] = useState<Array<{topics: string[]; edits: ProfileTopicPresentationEdit[]}>>([]);
  const openingDraft = useRef<ReturnType<typeof draftSnapshot> | null>(null);
  const openingPayload = useRef<Record<string, unknown> | null>(null);
  const pendingAction = useRef<"close" | "builder">("close");
  const afterDiscard = useRef<"close" | "builder" | null>(null);
  const closeAfterDelete = useRef(false);
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
    if (manualStructureTouched && structureLocksWritten && paperMode === "custom") {
      const derived = blueprintActive
        ? blueprintTotalQuestions
        : Math.min(20, parentQuestionCount * maxPartsPerQuestion);
      if (writtenCount !== derived) setWrittenCount(derived);
    }
  }, [
    manualStructureTouched,
    structureLocksWritten,
    parentQuestionCount,
    maxPartsPerQuestion,
    blueprintActive,
    blueprintTotalQuestions,
    paperMode,
  ]);
  useEffect(() => {
    if (
      manualStructureTouched && paperMode === "custom" &&
      !isMcqOnlyProfile &&
      questionStructure === "mixed" &&
      parentQuestionCount > writtenCount
    ) {
      setParentQuestionCount(Math.max(1, writtenCount));
    }
  }, [questionStructure, writtenCount, paperMode, manualStructureTouched]);

  useEffect(() => {
    if (open) {
      setBuilderOpen(!!initialData?.profile_template || (!initialData && initialBuilder));
      setStep(initialData ? "topics" : "settings");
      setSetupComplete(!!initialData); setSaving(false); setDiscardOpen(false);
      setManualStructureTouched(false); setTopicUndo([]);
      setPaperConfigurationTouched(false); setExplicitPlanApplied(false);
      openingDraft.current = null; openingPayload.current = null;
      setHydrationKey(value => value + 1);
      setStepError(null);
      setProfileName(initialData?.profile_name || "");
      setSelectedTopics(initialData?.topics || []);
      setNewTextTitle(""); setNewTextRole(studiedContentCfg.roles[0].id);
      setStudiedTexts(
        Array.isArray((initialData as any)?.studied_texts)
          ? (initialData as any).studied_texts
          : [],
      );
      const bp = (initialData as any)?.paper_blueprint;
      setBiologyBCustom(bp?.biologyBCustomSettings ?? null);
      setTopicEdits(Array.isArray(bp?.topicEdits) ? structuredClone(bp.topicEdits.filter((value: unknown) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const edit = value as Record<string, unknown>;
        return typeof edit.topic === "string" && typeof edit.label === "string" && !!edit.label.trim() && edit.label.trim().length <= 180;
      })) : []);
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
              0,
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
      } else if (initialData && rawTier) {
        setEducationalTier("other"); setCustomTier(rawTier);
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
  }, [open, initialData, initialBuilder]);

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
  const effectiveTopics = currentPlan && initialData && !paperConfigurationTouched
    ? selectedTopics
    : currentPlan?.parts.some((p) => p.assessmentRole === "synoptic_essay") ||
    (currentPlan?.courseId === OCR_ALEVEL_BIOLOGY_ID &&
      currentPlan.paperId === "paper_3")
      ? [...(paperDefinition?.topics ?? [])]
      : currentPlan
        ? [...new Set(currentPlan.parts.map((p) => p.topic))]
        : selectedTopics;
  const chosenConfigurationReady =
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
  // A legacy custom reference is still editable even when it has no current
  // guided-course definition. Keep its stored metadata until an explicit choice.
  const configurationReady = chosenConfigurationReady ||
    (!!initialData && !paperConfigurationTouched && paperMode === "custom" && !courseCapability &&
      !!(profileCourseId(initialData.paper_blueprint) || profilePaperId(initialData.paper_blueprint)));

  // Explicit conversion only — nothing is overwritten until the user accepts.
  const applyGuidedPlan = (plan: PaperPlan) => {
    setExplicitPlanApplied(true); setPaperConfigurationTouched(true);
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
    setPaperConfigurationTouched(true); setExplicitPlanApplied(false);
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
  const layoutBlueprint = (() => {
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
  const currentBlueprint = topicEdits.length ? { ...(layoutBlueprint ?? {}), topicEdits } : layoutBlueprint;
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
  const reviewSettings = openingPayload.current ? { ...approvalSettings,
    ...preserveCustomProfilePayload(initialData, openingPayload.current, approvalSettings,
      { mode: explicitPlanApplied ? "guided" : "custom", blueprintConfigurationChanged: paperConfigurationTouched }) } : approvalSettings;
  const currentApproval = evaluateApproval(reviewSettings,(initialData?.profile_template as any)?.presetId);
  const restoreApproval = () => {
    const id=currentApproval.entry?.id??(initialData?.profile_template as any)?.presetId;
    if(!id)return;
    try {const {plan,settings}=approvedPreset(id);setInteractiveResponses(false);setVisualAssessment(false);setSelectedCourseId(plan.courseId);setSelectedPaperId(plan.paperId);setAssessmentTier(plan.tier);setPaperMode(plan.mode);applyGuidedPlan(plan);setSelectedTopics(settings.topics);setAdvanced({...DEFAULT_ADVANCED,mcqCount:settings.mcq_count,mcqPosition:settings.mcq_position});}catch(error){setStepError((error as Error).message);}
  };

  const handleSave = async () => {
    if (saving || !profileName.trim() || !effectiveTopics.length || !finalTier || !configurationReady) return;
    setSaving(true); setStepError(null);
    try {
      const currentPayload = { ...approvalSettings,
        profile_name: openingPayload.current?.profile_name === profileName ? profileName : profileName.trim() };
      const profilePatch = preserveCustomProfilePayload(initialData, openingPayload.current ?? approvalSettings, currentPayload,
        { mode: explicitPlanApplied ? "guided" : "custom", blueprintConfigurationChanged: paperConfigurationTouched });
      const result = await onSave(profileName.trim(), effectiveTopics, currentPlan?.partCount ?? totalQuestionCount, finalTier,
        currentPlan?.durationMinutes ?? (timeLimitMinutes ? Number(timeLimitMinutes) : null),
        { ...advanced, mcqCount: currentPlan ? currentPlan.parts.filter(part => part.responseType === "mcq_single").length : mcqCount,
          assessmentTier: effectiveAssessmentTier, examBoard: initialData?.exam_board ?? examBoard ?? null,
          studiedTexts: profilePatch.studied_texts, paperBlueprint: profilePatch.paper_blueprint, profilePatch },
        currentPlan ? currentPlan.parts.filter(part => part.responseType !== "mcq_single").length : writtenCount,
        { questionStructure: isMcqOnlyProfile ? "mcq_only" : questionStructure,
          parentQuestionCount: currentPlan?.parentCount ?? parentQuestionCount,
          maxPartsPerQuestion: currentPlan ? Math.max(...currentPlan.parts.map(part => currentPlan.parts.filter(other => other.parentId === part.parentId).length)) : maxPartsPerQuestion,
          mcqOptionsCount: currentPlan ? 4 : mcqOptionsCount,
          includeGraphs: currentPlan ? currentPlan.parts.some(part => part.resource === "graph") : includeGraphs,
          includeTables: currentPlan ? currentPlan.parts.some(part => part.resource === "data_table") : includeTables });
      if (result && typeof result === "object" && !result.ok) {
        setStepError(result.message || "Could not save this profile. Your edits are kept. Try again."); return;
      }
      onOpenChange(false);
    } catch (error) { setStepError(error instanceof Error ? error.message : "Could not save this profile. Your edits are kept. Try again."); }
    finally { setSaving(false); }
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
  const hasPendingStudiedText = isTextBasedSubject && !guidedActive && !!newTextTitle.trim();
  const canSave =
    configurationReady &&
    !!profileName.trim() &&
    effectiveTopics.length > 0 &&
    !!finalTier &&
    !blueprintHasInvalidMarks &&
    validTime && !hasPendingStudiedText;
  const goTo = (next: ProfileStep) => { setStepError(null); setStep(next); bodyRef.current?.scrollTo({ top: 0 }); };
  const checkBasics = () => !profileName.trim() ? "Give your profile a name." : !finalTier ? "Choose an educational level." : !configurationReady ? "Choose your course and paper, then apply the preset or choose Custom." : null;
  const checkPaper = () => !effectiveTopics.length ? "Choose at least one topic." : !validTime ? "Enter a whole number of minutes above zero."
    : hasPendingStudiedText ? "Add the studied content, or clear its title before saving." : null;
  const continueStep = () => { const error = checkBasics(); if (error) { setStepError(error); return; } setSetupComplete(true); goTo("topics"); };
  const saveProfile = async () => {
    const error = checkBasics() || checkPaper() || (blueprintHasInvalidMarks ? "Give each question at least one mark." : null);
    if (error) { setStepError(error); return; }
    await handleSave();
  };
  const startLayout = () => {
    setManualStructureTouched(true); setBlueprintEnabled(true);
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

  function draftSnapshot() {
    return { profileName, selectedTopics, writtenCount, mcqCount, educationalTier, customTier, assessmentTier,
      timeLimitMinutes, advanced, questionStructure, parentQuestionCount, maxPartsPerQuestion, mcqOptionsCount,
      includeGraphs, includeTables, interactiveResponses, visualAssessment, biologyBCustom, paperMode, planApplied,
      savedContractVersion, selectedCourseId, selectedPaperId, studiedTexts, newTextTitle, newTextRole, blueprintEnabled, blueprintSections, topicEdits,
      paperConfigurationTouched, explicitPlanApplied };
  }
  useEffect(() => {
    if (!hydrationKey) return;
    openingDraft.current = structuredClone(draftSnapshot());
    openingPayload.current = structuredClone(approvalSettings);
  // A hydration key captures the complete opening state after its setters commit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationKey]);
  const reviewDirty = !!openingDraft.current && JSON.stringify(draftSnapshot()) !== JSON.stringify(openingDraft.current);
  const discardChanges = () => {
    const value = openingDraft.current; if (!value || saving) return;
    const v = structuredClone(value);
    setProfileName(v.profileName); setSelectedTopics(v.selectedTopics); setWrittenCount(v.writtenCount); setMcqCount(v.mcqCount);
    setEducationalTier(v.educationalTier); setCustomTier(v.customTier); setAssessmentTier(v.assessmentTier); setTimeLimitMinutes(v.timeLimitMinutes);
    setAdvanced(v.advanced); setQuestionStructure(v.questionStructure); setParentQuestionCount(v.parentQuestionCount); setMaxPartsPerQuestion(v.maxPartsPerQuestion);
    setMcqOptionsCount(v.mcqOptionsCount); setIncludeGraphs(v.includeGraphs); setIncludeTables(v.includeTables); setInteractiveResponses(v.interactiveResponses);
    setVisualAssessment(v.visualAssessment); setBiologyBCustom(v.biologyBCustom); setPaperMode(v.paperMode); setPlanApplied(v.planApplied);
    setSavedContractVersion(v.savedContractVersion); setSelectedCourseId(v.selectedCourseId); setSelectedPaperId(v.selectedPaperId); setStudiedTexts(v.studiedTexts);
    setBlueprintEnabled(v.blueprintEnabled); setBlueprintSections(v.blueprintSections); setTopicEdits(v.topicEdits);
    setPaperConfigurationTouched(v.paperConfigurationTouched); setExplicitPlanApplied(v.explicitPlanApplied);
    setManualStructureTouched(false); setTopicUndo([]); setNewTextTitle(v.newTextTitle); setNewTextRole(v.newTextRole); setStepError(null);
  };
  const requestClose = () => { if (saving) return; if (reviewDirty) { pendingAction.current = "close"; setDiscardOpen(true); } else onOpenChange(false); };
  const requestBuilder = () => { if (saving) return; if (reviewDirty) { pendingAction.current = "builder"; setDiscardOpen(true); } else setBuilderOpen(true); };
  const pushTopicUndo = () => setTopicUndo(history => [...history.slice(-19), { topics: [...selectedTopics], edits: structuredClone(topicEdits) }]);
  const changeTopics = (topics: string[]) => {
    if (saving || guidedActive) return;
    pushTopicUndo(); setSelectedTopics(topics); setTopicEdits(edits => edits.filter(edit => topics.includes(edit.topic)));
  };
  const renameTopic = (topic: string, label: string) => {
    if (saving || guidedActive || selectedTopics.filter(value => value === topic).length !== 1) return;
    const trimmed = label.trim(); if (!trimmed || trimmed.length > 180) return;
    pushTopicUndo();
    setTopicEdits(edits => trimmed === topic ? edits.filter(edit => edit.topic !== topic)
      : edits.some(edit => edit.topic === topic) ? edits.map(edit => edit.topic === topic ? { ...edit, label: trimmed } : edit)
        : [...edits, { topic, label: trimmed }]);
  };
  const undoTopics = () => { const previous = topicUndo.at(-1); if (!previous || saving || guidedActive) return;
    setSelectedTopics(previous.topics); setTopicEdits(previous.edits); setTopicUndo(history => history.slice(0,-1)); };

  const basicsPane = (
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
                          setPaperConfigurationTouched(true); setExplicitPlanApplied(false);
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
                      setPaperConfigurationTouched(true); setExplicitPlanApplied(false);
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
                        setPaperConfigurationTouched(true); setExplicitPlanApplied(false);
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
                      setPaperConfigurationTouched(true); setExplicitPlanApplied(false);
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
                        max={blueprintActive ? Math.max(20, blueprintTotalQuestions) : 20}
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
  );
  const structurePane = (
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
                                  onClick={() => {
                                    setManualStructureTouched(true); setQuestionStructure(option.id);
                                  }}
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
                            onChange={value => { setManualStructureTouched(true); setParentQuestionCount(value); }}
                          />
                          <NumberControl
                            label="Parts per question"
                            value={maxPartsPerQuestion}
                            min={2}
                            max={6}
                            onChange={value => { setManualStructureTouched(true); setMaxPartsPerQuestion(value); }}
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
  );
  const studiedContentPane = <>
{isTextBasedSubject && !guidedActive && (
                    <section className="space-y-3">
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
                            title={`Remove ${text.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
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
  </>;
  const exactLayoutPane = (
<ProfileLayoutEditor
                  sections={blueprintSections}
                  onChange={value => {
                    const count = (sections: typeof blueprintSections) => sections.reduce((total, section) => total + section.questions.length, 0);
                    if (count(value) !== count(blueprintSections)) setManualStructureTouched(true);
                    setBlueprintSections(value);
                  }}
                  presets={availablePresets}
                  presetId={advanced.structurePreset}
                  subjectName={subjectName}
                  onRemove={() => {
                    setManualStructureTouched(true); setBlueprintEnabled(false);
                    goTo("layout");
                  }}
                  onPresetChange={(id) => {
                    setManualStructureTouched(true);
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
  );

  if (builderOpen) return <ExamProfileBuilder open={open} onOpenChange={onOpenChange}
    accountId={ownerId}
    subjectName={subjectName} examBoard={initialData?.exam_board||examBoard||preferences?.preferred_exam_board}
    educationalLevel={initialData?.educational_tier||finalTier||preferences?.preferred_educational_level}
    curriculumRegion={preferences?.curriculum_region} courseId={selectedCourseId} paperId={selectedPaperId}
    assessmentTier={assessmentTier} initialMode={initialData ? paperMode : "full_mock"} initialProfile={initialData}
    onManual={()=>setBuilderOpen(false)} onDelete={onDelete} />;

  return <>
    <Dialog open={open} onOpenChange={value => { if (!value) requestClose(); }}>
      <DialogContent hideCloseButton
        onEscapeKeyDown={event => { if (saving || discardOpen || confirmDelete) event.preventDefault(); }}
        onInteractOutside={event => { if (saving || discardOpen || confirmDelete) event.preventDefault(); }}
        className="exam-profile-settings left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-border bg-card p-0 text-foreground sm:left-1/2 sm:top-1/2 sm:h-[90dvh] sm:max-h-[850px] sm:w-[calc(100%_-_2rem)] sm:max-w-[1040px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
        <DialogHeader className="sr-only"><DialogTitle>{initialData ? "Edit exam profile" : "Create exam profile"}</DialogTitle>
          <DialogDescription>Choose your topics, exam settings and paper layout.</DialogDescription>
        </DialogHeader>
        <header className="shrink-0 px-5 pb-4 pt-6 sm:px-7 sm:pb-5 sm:pt-7">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5"><h2 className="min-w-0 break-words text-[23px] font-semibold leading-snug tracking-tight sm:text-[25px]">{profileName.trim() || "Create exam profile"}</h2>
                <Button type="button" variant="ghost" size="icon" aria-label="Edit profile name" title="Edit profile name" disabled={saving} className="h-11 w-11 shrink-0" onClick={() => goTo("settings")}><Pencil aria-hidden="true" className="h-4 w-4" /></Button>
              </div>
              <p className="mt-1.5 break-words text-xs leading-relaxed text-muted-foreground">{[initialData?.exam_board ?? examBoard, ALL_LEVELS.find(level => level.id === finalTier)?.label || finalTier, subjectName].filter(Boolean).join(" · ")}</p>
              {paperDefinition && (guidedActive || selectedPaperId) && <p className="mt-1 break-words text-xs text-muted-foreground">{paperDefinition.displayName}{effectiveAssessmentTier && effectiveAssessmentTier !== "not_tiered" ? ` · ${effectiveAssessmentTier === "higher" ? "Higher" : "Foundation"}` : ""}</p>}
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Close profile" title="Close profile" disabled={saving} className="-mr-1 -mt-1 h-11 w-11 shrink-0" onClick={requestClose}><X aria-hidden="true" className="h-4 w-4" /></Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span>{currentPlan ? `${currentPlan.durationMinutes} minutes` : timeLimitMinutes ? `${timeLimitMinutes} minutes` : "No time limit"}</span><span aria-hidden="true">·</span>
            <span>{presetCount} {currentPlan || questionStructure === "sub_questions" ? "parts" : "questions"}</span>
            {(currentPlan || blueprintActive) && <><span aria-hidden="true">·</span><span>{currentPlan?.totalMarks ?? blueprintCountedMarks} marks</span></>}
            <span aria-hidden="true">·</span><span>{guidedActive ? paperMode === "full_mock" ? "Full mock" : "Short practice" : "Custom profile"}</span>
          </div>
        </header>
        {setupComplete && <nav aria-label="Profile sections" className="flex shrink-0 gap-6 border-b border-border px-5 sm:gap-7 sm:px-7">
          {([["topics", "Topics"], ["settings", "Exam settings"], ["layout", "Paper layout"]] as const).map(([value,label]) => <button key={value} type="button" disabled={saving} aria-current={step === value ? "page" : undefined} onClick={() => goTo(value)}
            className={`min-h-11 border-b-2 py-3 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs ${step === value ? "border-foreground/70 text-foreground" : "border-transparent text-muted-foreground"}`}>
              {label}{value === "topics" && <span className="ml-1.5 text-[10px] font-normal tabular-nums text-muted-foreground">{effectiveTopics.length}</span>}
          </button>)}
        </nav>}
        {setupComplete && step === "topics" ? <>
          <CustomProfileTopics topics={effectiveTopics} allTopics={guidedActive ? effectiveTopics : [...new Set([...allTopics, ...topicSuggestions])]} subjectName={subjectName} accent={subjectColor}
            getTopicLabel={topic => profileTopicLabel({ topics: effectiveTopics, paper_blueprint: { topicEdits } }, topic)}
            onChange={changeTopics} onRename={renameTopic} disabled={saving} locked={guidedActive} onUndo={undoTopics} canUndo={topicUndo.length > 0} />
          {isTextBasedSubject && !guidedActive && <details className="max-h-[40%] shrink-0 overflow-y-auto border-t border-border px-5 py-2 sm:px-7"><summary className="min-h-11 cursor-pointer content-center text-xs font-medium">{studiedContentCfg.title}{studiedTexts.length ? ` · ${studiedTexts.length}` : ""}</summary><fieldset disabled={saving} className="pb-4">{studiedContentPane}</fieldset></details>}
        </> : <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
          <fieldset disabled={saving} className="space-y-6">
            {(!setupComplete || step === "settings") ? <>
              <div><h3 className="text-lg font-semibold">{setupComplete ? "Exam settings" : "Set up your profile"}</h3><p className="mt-1 text-xs text-muted-foreground">{setupComplete ? "Your paper details and question settings." : "Choose a name and qualification, then add your topics."}</p></div>
              {basicsPane}
              {!setupComplete && <div className="border-t border-border pt-3"><Button type="button" variant="ghost" onClick={requestBuilder}>Build profile for me</Button></div>}
              {setupComplete && <>
                <ProfileTimeLimit value={currentPlan ? String(currentPlan.durationMinutes) : timeLimitMinutes} onChange={setTimeLimitMinutes} locked={guidedActive} />
                <details className="border-t border-border pt-2"><summary className="min-h-11 cursor-pointer content-center text-xs font-medium">More question settings</summary><div className="pb-4 pt-3">
                  {guidedActive ? <p className="text-xs text-muted-foreground">The preset sets these options. Choose Custom in Exam settings to change them.</p> : <ExamProfileAdvanced settings={advanced} onChange={setAdvanced} questionLimit={writtenCount} subjectColor={subjectColor} curriculumRegion={preferences?.curriculum_region} embedded />}
                </div></details>
                <details className="border-t border-border pt-2"><summary className="min-h-11 cursor-pointer content-center text-xs font-medium">Profile options</summary><div className="space-y-3 py-3">
                  <ProfileApprovalBadge profile={reviewSettings}/>
                  {currentApproval.status === "customised" && <Button type="button" variant="ghost" size="sm" onClick={restoreApproval}>Restore approved settings</Button>}
                  <div className="flex flex-wrap gap-3"><Button type="button" variant="ghost" onClick={requestBuilder}>Build profile for me</Button>
                    {initialData?.id && onDelete && <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden="true" className="mr-1.5 h-4 w-4" />Delete profile</Button>}
                  </div>
                </div></details>
              </>}
            </> : <>
              <div><h3 className="text-lg font-semibold">Paper layout</h3><p className="mt-1 text-xs text-muted-foreground">Your structure, sections and question marks.</p></div>
              {blueprintEnabled && !guidedActive ? exactLayoutPane : structurePane}
              {currentPlan && <details className="border-t border-border pt-2"><summary className="min-h-11 cursor-pointer content-center text-xs font-medium">Full paper preview</summary><div className="pt-3">{preview(true)}</div></details>}
            </>}
          </fieldset>
        </div>}
        {stepError ? <p role="alert" className="shrink-0 border-t border-border px-5 py-2.5 text-xs text-destructive sm:px-7">{stepError}</p>
          : !canSave && setupComplete && missingSaveReason ? <p role={!validTime ? "alert" : "status"} className={`shrink-0 border-t border-border px-5 py-2.5 text-xs sm:px-7 ${!validTime ? "text-destructive" : "text-muted-foreground"}`}>{missingSaveReason}</p> : null}
        <DialogFooter className="shrink-0 flex-row items-center justify-between gap-2 border-t border-border bg-card px-5 py-3 sm:justify-between sm:space-x-0 sm:px-7 sm:py-4">
          <p role="status" className="min-w-0 text-[10px] text-muted-foreground sm:text-xs">{saving ? "Saving…" : reviewDirty ? "Unsaved changes" : initialData ? "All changes saved" : "Ready to create"}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="ghost" className="min-h-11 rounded-md px-3 text-xs font-normal" disabled={saving || !reviewDirty} onClick={discardChanges}>Discard changes</Button>
            {setupComplete ? <Button type="button" aria-label={initialData ? "Update Profile" : "Create Profile"} disabled={saving || !canSave} onClick={() => void saveProfile()} className="min-h-11 rounded-md px-3 text-xs">{saving ? "Saving…" : initialData ? "Save changes" : "Create profile"}</Button>
              : <Button type="button" disabled={saving} onClick={continueStep} className="min-h-11 rounded-md px-3 text-xs">Continue<ArrowRight aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" /></Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent onCloseAutoFocus={event => {
      if (!afterDiscard.current) return;
      event.preventDefault(); const action = afterDiscard.current; afterDiscard.current = null;
      discardChanges(); if (action === "builder") setBuilderOpen(true); else onOpenChange(false);
    }}><AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your saved profile stays unchanged. Your edits in this window will be discarded.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { afterDiscard.current = pendingAction.current; setDiscardOpen(false); }}>Discard and continue</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={confirmDelete} onOpenChange={value => { if (!deleting) setConfirmDelete(value); }}><AlertDialogContent onCloseAutoFocus={event => { if (closeAfterDelete.current) { event.preventDefault(); closeAfterDelete.current = false; onOpenChange(false); } }}><AlertDialogHeader><AlertDialogTitle>Delete "{initialData?.profile_name}"?</AlertDialogTitle><AlertDialogDescription>This removes the exam profile. Exams and practice you already made from it are kept.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async event => {
      event.preventDefault(); if (!initialData?.id || !onDelete) return; setDeleting(true);
      try { const ok = await onDelete(initialData.id); if (ok) { closeAfterDelete.current = true; setConfirmDelete(false); } else setStepError("Could not delete this profile. Try again."); }
      catch { setStepError("Could not delete this profile. Try again."); } finally { setDeleting(false); }
    }}>{deleting ? "Deleting…" : "Delete profile"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
};
