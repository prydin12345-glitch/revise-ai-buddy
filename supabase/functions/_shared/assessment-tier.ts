// Mirror of src/lib/assessment-tier.ts for the Deno edge runtime.
// Keep both files in step — the frontend offers the tier, the backend
// validates it. See the frontend file for the full rationale.

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
];

export interface CourseCapability {
  id: string;
  label: string;
  subjects: string[];
  boards: string[];
  levels: string[];
  tiers: AssessmentTier[];
}

export const COURSE_CAPABILITIES: CourseCapability[] = [
  {
    id: "aqa_gcse_biology",
    label: "AQA GCSE Biology",
    subjects: ["biology", "gcse biology", "biology (single science)"],
    boards: ["aqa"],
    levels: GCSE_LEVEL_IDS,
    tiers: ["foundation", "higher"],
  },
];

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

const DECORATION = /\b(aqa|edexcel|ocr|wjec|eduqas|gcse|igcse|ks4|paper\s*\d+|higher|foundation|tier|hl|sl)\b/g;

const subjectForms = (value?: string | null): string[] => {
  const base = norm(value);
  if (!base) return [];
  const stripped = base
    .replace(DECORATION, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped && stripped !== base ? [base, stripped] : [base];
};

export interface CourseLookup {
  subject?: string | null;
  examBoard?: string | null;
  educationalTier?: string | null;
}

export const getCourseCapability = (
  lookup: CourseLookup,
): CourseCapability | null => {
  const subjects = subjectForms(lookup.subject);
  const board = norm(lookup.examBoard);
  const level = norm(lookup.educationalTier);
  if (subjects.length === 0 || !board || !level) return null;
  return (
    COURSE_CAPABILITIES.find(
      (c) =>
        subjects.some((s) => c.subjects.includes(s)) &&
        c.boards.includes(board) &&
        c.levels.includes(level),
    ) ?? null
  );
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
