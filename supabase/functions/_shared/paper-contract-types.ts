// Shared paper shapes for frontend previews and backend generation.

export type PaperMode = "full_mock" | "short_practice" | "custom";
export type ResponseType = "mcq_single" | "short_answer" | "long_form";
export type ResourceKind = "data_table" | "graph" | "diagram" | "none";

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
  section?: 'A' | 'B';
  specRefs?: string[];
  mathsMarks?: number;
  practicalMarks?: number;
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
  componentCode?: string;
}

/** Human-readable summary used by the conversion preview in the UI. */
export const describePlan = (plan: PaperPlan): string =>
  `${plan.label}${plan.componentCode ? ` (${plan.componentCode})` : ''} — ${plan.partCount} parts across ${plan.parentCount} questions, ` +
  `${plan.totalMarks} marks, ${plan.durationMinutes} minutes` +
  (plan.tier ? ` (${plan.tier})` : "");
