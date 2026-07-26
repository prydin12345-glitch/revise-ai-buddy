/**
 * Grade scales and projection.
 *
 * Replaces the old scoreToGradeTier(), which returned a *number and a letter*
 * together ("9" / "A**") — two different qualifications' scales fused into one
 * label, including a band that doesn't exist. It also applied a single fixed
 * percentage table to every subject regardless of qualification or tier.
 *
 * Real grade boundaries are set per board, per subject, per series, and move
 * every year. Nothing here can know them. The defaults below are rough
 * published averages and must always be presented to the student as an
 * estimate they can override with boundaries from their own past papers.
 */

export type GradeScaleId =
  | "gcse_9_1"
  | "alevel_a_e"
  | "ib_1_7"
  | "us_letter"
  | "percentage";

export interface GradeTier {
  id: string;
  label: string;
  /** Highest grade attainable on this tier. */
  maxGrade: string;
}

export interface GradeScale {
  id: GradeScaleId;
  label: string;
  /** Grades best → worst. The last entry is the ungraded floor. */
  grades: string[];
  /** Minimum percentage for each grade above the floor. */
  defaultBoundaries: Record<string, number>;
  tiers?: GradeTier[];
}

const SCALES: Record<GradeScaleId, GradeScale> = {
  gcse_9_1: {
    id: "gcse_9_1",
    label: "GCSE (9–1)",
    grades: ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"],
    defaultBoundaries: { "9": 80, "8": 71, "7": 62, "6": 53, "5": 44, "4": 35, "3": 26, "2": 17, "1": 8 },
    tiers: [
      { id: "higher", label: "Higher tier", maxGrade: "9" },
      // Foundation tier cannot award above a 5 — projecting a 9 is impossible.
      { id: "foundation", label: "Foundation tier", maxGrade: "5" },
    ],
  },
  alevel_a_e: {
    id: "alevel_a_e",
    label: "A-Level (A*–E)",
    grades: ["A*", "A", "B", "C", "D", "E", "U"],
    defaultBoundaries: { "A*": 80, A: 70, B: 60, C: 50, D: 40, E: 30 },
  },
  ib_1_7: {
    id: "ib_1_7",
    label: "IB (7–1)",
    grades: ["7", "6", "5", "4", "3", "2", "1"],
    defaultBoundaries: { "7": 80, "6": 70, "5": 60, "4": 50, "3": 40, "2": 25 },
  },
  us_letter: {
    id: "us_letter",
    label: "Letter (A–F)",
    grades: ["A", "B", "C", "D", "F"],
    defaultBoundaries: { A: 90, B: 80, C: 70, D: 60 },
  },
  percentage: {
    id: "percentage",
    label: "Percentage",
    grades: [],
    defaultBoundaries: {},
  },
};

export const ALL_SCALES = Object.values(SCALES);

export const getScale = (id: GradeScaleId | undefined | null): GradeScale =>
  SCALES[(id as GradeScaleId) ?? "percentage"] ?? SCALES.percentage;

/**
 * Best guess at the right scale from a subject's educational tier and the
 * user's curriculum region. Always overridable — this is a starting point,
 * not a verdict.
 */
export const resolveScaleId = (
  tier?: string | null,
  region?: string | null
): GradeScaleId => {
  const t = (tier ?? "").toLowerCase();
  const r = (region ?? "").toLowerCase();

  if (t.includes("ib") || t.includes("diploma")) return "ib_1_7";
  if (t.includes("a_level") || t.includes("a-level") || t.includes("alevel") || t.includes("level3") || t.includes("college_16_18"))
    return "alevel_a_e";
  if (t.includes("gcse") || t.includes("igcse") || t.includes("level2")) return "gcse_9_1";
  if (t.includes("undergrad") || t.includes("postgrad") || t.includes("doctoral") || t.includes("degree"))
    return "percentage";
  if (t.includes("high_school") || t.includes("middle_school")) return "us_letter";

  if (r.includes("us") || r.includes("america")) return "us_letter";
  if (r.includes("uk") || r.includes("britain") || r.includes("england")) return "gcse_9_1";
  return "percentage";
};

export const boundariesFor = (
  scale: GradeScale,
  overrides?: Record<string, number>
): Record<string, number> => ({ ...scale.defaultBoundaries, ...(overrides ?? {}) });

/** Index in scale.grades — lower is better. -1 if unknown. */
export const gradeRank = (scale: GradeScale, grade: string): number =>
  scale.grades.indexOf(grade);

export interface Projection {
  /** null when the scale is "percentage" — show the raw figure instead. */
  grade: string | null;
  /** The next grade up, or null when already at the cap. */
  nextGrade: string | null;
  /** Percentage points needed to reach nextGrade, rounded. */
  pointsToNext: number | null;
  /** True when the tier ceiling prevented a higher grade. */
  cappedByTier: boolean;
}

export const projectGrade = (
  pct: number,
  scale: GradeScale,
  opts?: { overrides?: Record<string, number>; tierId?: string }
): Projection => {
  if (scale.grades.length === 0) {
    return { grade: null, nextGrade: null, pointsToNext: null, cappedByTier: false };
  }

  const bounds = boundariesFor(scale, opts?.overrides);
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));

  const tier = scale.tiers?.find((t) => t.id === opts?.tierId);
  const capIndex = tier ? gradeRank(scale, tier.maxGrade) : 0;

  // grades are best → worst, so walk down until the score clears a boundary.
  let index = scale.grades.length - 1; // floor
  for (let i = 0; i < scale.grades.length - 1; i++) {
    const g = scale.grades[i];
    const min = bounds[g];
    if (min !== undefined && safe >= min) {
      index = i;
      break;
    }
  }

  const cappedByTier = index < capIndex;
  if (cappedByTier) index = capIndex;

  const grade = scale.grades[index];
  const nextIndex = index - 1;
  const nextGrade = nextIndex >= capIndex ? scale.grades[nextIndex] : null;
  const nextMin = nextGrade ? bounds[nextGrade] : undefined;

  return {
    grade,
    nextGrade,
    pointsToNext:
      nextGrade && nextMin !== undefined ? Math.max(0, Math.round(nextMin - safe)) : null,
    cappedByTier,
  };
};

/** "on target" | "close" | "behind" against a chosen target grade. */
export const targetStatus = (
  scale: GradeScale,
  predicted: string | null,
  target: string | null
): "met" | "close" | "behind" | "unset" => {
  if (!predicted || !target) return "unset";
  const p = gradeRank(scale, predicted);
  const t = gradeRank(scale, target);
  if (p < 0 || t < 0) return "unset";
  if (p <= t) return "met";
  if (p - t === 1) return "close";
  return "behind";
};
