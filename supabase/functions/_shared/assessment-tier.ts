// Shared catalogue for the frontend and Deno runtime. Custom names are display
// labels; the explicit board and qualification determine the supported course.
// An absent tier remains unknown. Subject names never select a tier themselves.

export type AssessmentTier = "foundation" | "higher" | "not_tiered";

export const ASSESSMENT_TIER_VALUES: AssessmentTier[] = [
  "foundation",
  "higher",
  "not_tiered",
];

export const ASSESSMENT_TIER_LABELS: Record<AssessmentTier, string> = {
  foundation: "Foundation",
  higher: "Higher",
  not_tiered: "Not tiered",
};

const GCSE_LEVEL_IDS = [
  "level2",
  "level2_gcse",
  "gcse",
  "gcse_9_1",
  "ks4",
  "secondary_14_16",
  "level 2",
];

export interface CourseCapability {
  id: string;
  label: string;
  subjects: string[];
  boards: string[];
  levels: string[];
  tiers: AssessmentTier[];
  specificationCode?: string;
  generationAvailable?: boolean;
}

export const OCR_GATEWAY_BIOLOGY_ID = 'ocr_gcse_biology_a_j247';
export const OCR_21C_BIOLOGY_ID = 'ocr_gcse_biology_b_j257';
export const EDEXCEL_BIOLOGY_ID = 'edexcel_gcse_biology_1bi0';
const OCR_BIOLOGY_NAMES = ['biology', 'biology a', 'biology b', 'gateway biology', 'gateway biology a', 'biology (single science)', 'twenty first century biology', 'twenty first century biology b'];

export const COURSE_CAPABILITIES: CourseCapability[] = [
  {
    id: "aqa_gcse_biology",
    label: "AQA GCSE Biology",
    subjects: ["biology", "gcse biology", "biology (single science)"],
    boards: ["aqa"],
    levels: GCSE_LEVEL_IDS,
    tiers: ["foundation", "higher"],
    specificationCode: '8461',
  },
  {
    id: EDEXCEL_BIOLOGY_ID,
    label: 'Pearson Edexcel GCSE Biology (1BI0)',
    subjects: ['biology', 'gcse biology', 'biology (single science)'],
    boards: ['edexcel', 'pearson edexcel'],
    levels: GCSE_LEVEL_IDS,
    tiers: ['foundation', 'higher'],
    specificationCode: '1BI0',
  },
  {
    id: OCR_GATEWAY_BIOLOGY_ID,
    label: 'OCR Gateway Biology A (J247)',
    subjects: OCR_BIOLOGY_NAMES,
    boards: ['ocr', 'cambridge ocr'],
    levels: GCSE_LEVEL_IDS,
    tiers: ['foundation', 'higher'],
    specificationCode: 'J247',
  },
  {
    id: OCR_21C_BIOLOGY_ID,
    label: 'OCR Twenty First Century Biology B (J257)',
    subjects: OCR_BIOLOGY_NAMES,
    boards: ['ocr', 'cambridge ocr'],
    levels: GCSE_LEVEL_IDS,
    tiers: ['foundation', 'higher'],
    specificationCode: 'J257',
    generationAvailable: true,
  },
];

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

const DECORATION = /\b(aqa|pearson|edexcel|cambridge|ocr|wjec|eduqas|gcse|igcse|ks4|j247|j257|1bi0|paper\s*\d+|higher|foundation|tier|hl|sl)\b/g;

const subjectForms = (value?: string | null): string[] => {
  const base = norm(value);
  if (!base) return [];
  const stripped = base
    .replace(DECORATION, " ")
    .replace(/\(\s*\)|\[\s*\]/g, " ")
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped && stripped !== base ? [base, stripped] : [base];
};

export interface CourseLookup {
  subject?: string | null;
  examBoard?: string | null;
  educationalTier?: string | null;
  /** A subject label never chooses between OCR's two Biology qualifications. */
  courseId?: string | null;
}

export const canonicalCourseId = (value?: string | null): string | null => {
  const id = norm(value);
  // Preserve historical AQA snapshot ids and its existing paper-contract id.
  return id === 'aqa_gcse_biology_8461' ? 'aqa_gcse_biology' : id || null;
};

export const getCourseOptions = (
  lookup: CourseLookup,
): CourseCapability[] => {
  const subjects = subjectForms(lookup.subject);
  const board = norm(lookup.examBoard);
  const level = norm(lookup.educationalTier);
  if (subjects.length === 0 || !board || !level) return [];
  return COURSE_CAPABILITIES.filter(
      (c) =>
        subjects.some((s) => c.subjects.includes(s)) &&
        c.boards.includes(board) &&
        c.levels.includes(level),
    );
};

export const getCourseCapability = (lookup: CourseLookup): CourseCapability | null => {
  const options = getCourseOptions(lookup);
  const selected = canonicalCourseId(lookup.courseId);
  if (selected) return options.find(c => c.id === selected) ?? null;
  return options.length === 1 ? options[0] : null;
};

export const supportsAssessmentTier = (lookup: CourseLookup): boolean =>
  (getCourseCapability(lookup)?.tiers.length ?? 0) > 0;

export const getAssessmentTierOptions = (
  lookup: CourseLookup,
): AssessmentTier[] => getCourseCapability(lookup)?.tiers ?? [];

export const normaliseAssessmentTier = (
  value?: string | null,
): AssessmentTier | null => {
  const v = norm(value);
  return (ASSESSMENT_TIER_VALUES as string[]).includes(v)
    ? (v as AssessmentTier)
    : null;
};

/** True only for genuinely absent values — the legacy "not recorded" state. */
export const isUnknownAssessmentTier = (value?: string | null): boolean =>
  value === null || value === undefined || value.trim() === "";

/**
 * Absent (null / empty) is valid legacy "unknown". An explicit but
 * unrecognised string is REJECTED rather than silently downgraded.
 */
export const isValidAssessmentTierFor = (
  value: string | null | undefined,
  lookup: CourseLookup,
): boolean => {
  if (isUnknownAssessmentTier(value)) return true;
  const tier = normaliseAssessmentTier(value);
  if (tier === null) return false;
  return getAssessmentTierOptions(lookup).includes(tier);
};

export const formatAssessmentTier = (value?: string | null): string | null => {
  const tier = normaliseAssessmentTier(value);
  return tier ? ASSESSMENT_TIER_LABELS[tier] : null;
};
