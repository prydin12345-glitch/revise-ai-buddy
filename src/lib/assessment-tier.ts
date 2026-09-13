// Assessment tier (Foundation / Higher / Not tiered).
//
// This is INDEPENDENT of `educational_tier`, which stays the qualification
// level field (GCSE, A-Level, ...). A profile with no stored assessment tier
// is "unknown" (legacy) — we never guess a tier for it, and we never turn a
// GCSE into "Higher" by inference.
//
// Tier choices are only offered for courses we explicitly support. Batch 1
// ships AQA GCSE Biology only.

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

/** Qualification-level ids that represent a UK GCSE across our level tables. */
const GCSE_LEVEL_IDS = [
  "level2",
  "level2_gcse",
  "gcse",
  "gcse_9_1",
  "ks4",
  "secondary_14_16",
];

export interface CourseCapability {
  /** Stable id stored inside the resolved generation context. */
  id: string;
  label: string;
  /** Lower-cased subject names that match this course. */
  subjects: string[];
  /** Lower-cased exam board ids that match this course. */
  boards: string[];
  /** Qualification level ids (educational_tier) this course covers. */
  levels: string[];
  /** Tier options offered for this course. */
  tiers: AssessmentTier[];
}

/**
 * Supported courses. Deliberately small: adding a course here is what makes
 * the Foundation/Higher control appear. Nothing else infers tiering.
 */
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

/**
 * Users name their own subjects ("Biology Higher", "GCSE Biology"). Strip the
 * qualification and tier words people append, so the subject still matches the
 * catalogue. This only removes decoration — it never maps one subject onto a
 * different one, and it never infers a tier.
 */
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
  /** The qualification level, i.e. the existing `educational_tier` field. */
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

/** Returns a valid tier, or null for "unknown / not recorded". */
export const normaliseAssessmentTier = (
  value?: string | null,
): AssessmentTier | null => {
  const v = norm(value);
  return (ASSESSMENT_TIER_VALUES as string[]).includes(v)
    ? (v as AssessmentTier)
    : null;
};

/** True only for genuinely absent values — the legacy "not recorded" state. */
export const isUnknownAssessmentTier = (
  value?: string | null,
): boolean => value === null || value === undefined || value.trim() === "";

/**
 * A tier is valid for a course only when that course offers it. Absent (null /
 * empty) is always valid — it is the legacy "not recorded" state. An explicit
 * but unrecognised string is REJECTED rather than silently downgraded.
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

export const formatAssessmentTier = (
  value?: string | null,
): string | null => {
  const tier = normaliseAssessmentTier(value);
  return tier ? ASSESSMENT_TIER_LABELS[tier] : null;
};
