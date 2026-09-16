// Versioned paper contract for AQA GCSE separate Biology 8461 Paper 1.
//
// The contract is deterministic: the plan (parts, marks, response types and
// resource requirements) is built BEFORE the model is called, and the totals
// are computed from the plan rather than trusted from the model output.
//
// Identity stored on an attempt is course + paper + mode + contract version —
// never a display name such as "AQA_GCSE_BIO_P1".

import { getCourseCapability } from './assessment-tier.ts';

export const BIOLOGY_CONTRACT_VERSION = 1;

export type PaperMode = "full_mock" | "short_practice" | "custom";
export type ResponseType = "mcq_single" | "short_answer" | "long_form";
export type ResourceKind = "data_table" | "graph" | "diagram" | "none";

export const AQA_BIOLOGY_P1 = {
  courseId: "aqa_gcse_biology_8461",
  paperId: "paper_1",
  displayName: "AQA GCSE Biology (8461) Paper 1",
  fullMockMarks: 100,
  fullMockMinutes: 105,
  /** Paper 1 content areas only — Paper 2 topics are out of scope. */
  topics: [
    "Cell biology",
    "Organisation",
    "Infection and response",
    "Bioenergetics",
  ],
  tiers: ["foundation", "higher"] as const,
} as const;

export interface PlannedPart {
  partId: string;
  parentId: string;
  questionNumber: string;
  topic: string;
  responseType: ResponseType;
  marks: number;
  /** AO target — cognitive demand, tracked separately from response type. */
  demand: "AO1" | "AO2" | "AO3";
  resource: ResourceKind;
  resourceId?: string;
}

export interface PaperPlan {
  courseId: string;
  paperId: string;
  mode: PaperMode;
  contractVersion: number;
  tier: "foundation" | "higher" | null;
  parts: PlannedPart[];
  /** Distinct parent groups. */
  parentCount: number;
  /** Scored, answerable parts. */
  partCount: number;
  totalMarks: number;
  durationMinutes: number;
  label: string;
}

const finalise = (
  mode: PaperMode,
  tier: PaperPlan["tier"],
  parts: PlannedPart[],
  durationMinutes: number,
  label: string,
): PaperPlan => ({
  courseId: AQA_BIOLOGY_P1.courseId,
  paperId: AQA_BIOLOGY_P1.paperId,
  mode,
  contractVersion: BIOLOGY_CONTRACT_VERSION,
  tier,
  parts,
  parentCount: new Set(parts.map((p) => p.parentId)).size,
  partCount: parts.length,
  totalMarks: parts.reduce((sum, p) => sum + p.marks, 0),
  durationMinutes,
  label,
});

const part = (
  parent: number,
  letter: string,
  topic: string,
  responseType: ResponseType,
  marks: number,
  demand: PlannedPart["demand"],
  resource: ResourceKind = "none",
): PlannedPart => ({
  partId: `p${parent}${letter}`,
  parentId: `q${parent}`,
  questionNumber: letter ? `${parent}(${letter})` : String(parent),
  topic,
  responseType,
  marks,
  demand,
  resource,
  resourceId: resource === "none" ? undefined : `r_${parent}${letter}`,
});

/**
 * Short development template: 8 scored parts, two 1-mark single-select MCQs,
 * one meaningful data table, one supported graph, an easy 1-mark part early.
 * This is an internal test fixture, NOT an official AQA distribution rule.
 */
export function buildShortPracticePlan(tier: PaperPlan["tier"]): PaperPlan {
  const T = AQA_BIOLOGY_P1.topics;
  const parts: PlannedPart[] = [
    part(1, "a", T[0], "mcq_single", 1, "AO1"),
    part(1, "b", T[0], "short_answer", 2, "AO2", "data_table"),
    part(2, "a", T[1], "short_answer", 2, "AO2", "graph"),
    part(2, "b", T[1], "long_form", 4, "AO3"),
    part(3, "a", T[2], "mcq_single", 1, "AO1"),
    part(3, "b", T[2], "short_answer", 3, "AO2", "data_table"),
    part(4, "a", T[3], "short_answer", 2, "AO2"),
    part(4, "b", T[3], "long_form", 4, "AO3"),
  ];
  return finalise(
    "short_practice",
    tier,
    parts,
    Math.max(15, Math.round(parts.reduce((s, p) => s + p.marks, 0) * 1.05)),
    "Paper 1 short practice",
  );
}

/** Full mock: exactly 100 marks / 105 minutes across the four Paper 1 topics. */
export function buildFullMockPlan(tier: PaperPlan["tier"]): PaperPlan {
  const T = AQA_BIOLOGY_P1.topics;
  const parts: PlannedPart[] = [];
  // Examly's four-group layout covers the Paper 1 topics. AQA does NOT mandate
  // four questions or equal 25-mark topic allocations; these are our choices.
  T.forEach((topic, i) => {
    const n = i + 1;
    parts.push(part(n, "a", topic, "mcq_single", 1, "AO1"));
    parts.push(part(n, "b", topic, "mcq_single", 1, "AO1"));
    parts.push(part(n, "c", topic, "short_answer", 2, "AO1"));
    parts.push(part(n, "d", topic, "short_answer", 3, "AO2", i % 2 === 0 ? "data_table" : "graph"));
    parts.push(part(n, "e", topic, "short_answer", 4, "AO2"));
    parts.push(part(n, "f", topic, "short_answer", 4, "AO3"));
    parts.push(part(n, "g", topic, "long_form", 6, "AO3"));
    parts.push(part(n, "h", topic, "short_answer", 4, "AO2", "data_table"));
  });
  const plan = finalise(
    "full_mock",
    tier,
    parts,
    AQA_BIOLOGY_P1.fullMockMinutes,
    "AQA GCSE Biology Paper 1 full mock",
  );
  if (plan.totalMarks !== AQA_BIOLOGY_P1.fullMockMarks) {
    throw new Error(
      `Full mock plan totals ${plan.totalMarks} marks, expected ${AQA_BIOLOGY_P1.fullMockMarks}`,
    );
  }
  return plan;
}

export function buildPaperPlan(
  mode: PaperMode,
  tier: PaperPlan["tier"],
): PaperPlan | null {
  if (mode === "full_mock") return buildFullMockPlan(tier);
  if (mode === "short_practice") return buildShortPracticePlan(tier);
  return null; // custom keeps the user's manual counts and media choices
}

/** Is this subject/board/level combination covered by the guided contract? */
export function supportsBiologyPaperContract(input: {
  subject?: string | null;
  examBoard?: string | null;
  educationalLevel?: string | null;
}): boolean {
  return getCourseCapability({
    subject: input.subject,
    examBoard: input.examBoard,
    educationalTier: input.educationalLevel,
  })?.id === 'aqa_gcse_biology';
}

/** Human-readable summary used by the conversion preview in the UI. */
export const describePlan = (plan: PaperPlan): string =>
  `${plan.label} — ${plan.partCount} parts across ${plan.parentCount} questions, ` +
  `${plan.totalMarks} marks, ${plan.durationMinutes} minutes` +
  (plan.tier ? ` (${plan.tier})` : "");
