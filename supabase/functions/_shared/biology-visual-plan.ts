/** Browser-safe plan binding. Never import the internal evidence or answer ledger. */
import type { PaperPlan } from "./paper-contract-types.ts";
import type {
  SavedVisualAssessment,
  VisualAssignment,
} from "./biology-visual-types.ts";
import {
  parseVisualResource,
  publicVisualFile,
} from "./biology-visual-public.ts";
export const VISUAL_POLICY = "ocr_h420_03_visual_v1";
const slots = {
  full_mock: [
    ["2(a)", "label", 1],
    ["4(d)", "compare", 3],
    ["5(a)", "observe", 1],
  ],
  short_practice: [
    ["1(a)", "label", 1],
    ["2(a)", "observe", 1],
  ],
} as const;
export function bindPublicVisualPlan(
  plan: PaperPlan | null,
  saved: unknown,
): PaperPlan | null {
  if (saved == null) return plan;
  if (
    !plan ||
    plan.courseId !== "ocr_alevel_biology_a_h420" ||
    plan.paperId !== "paper_3" ||
    plan.tier !== "not_tiered" ||
    !["full_mock", "short_practice"].includes(plan.mode)
  )
    throw new Error("Visual assessment requires explicit guided H420/03.");
  const s = saved as SavedVisualAssessment,
    expected = slots[plan.mode as keyof typeof slots];
  if (
    !s ||
    s.version !== 1 ||
    s.configId !== VISUAL_POLICY ||
    Object.keys(s).some(
      (k) => !["version", "configId", "assignments"].includes(k),
    ) ||
    !Array.isArray(s.assignments) ||
    s.assignments.length !== expected.length
  )
    throw new Error("Invalid frozen visual assessment.");
  for (const [i, a] of s.assignments.entries()) {
    const [number, role, count] = expected[i];
    if (
      a.questionNumber !== number ||
      a.configId !== `${s.configId}_${role}` ||
      Object.keys(a).some(
        (k) => !["questionNumber", "configId", "resource"].includes(k),
      )
    )
      throw new Error("Changed frozen visual assignment.");
    const r = parseVisualResource(a.resource);
    if (r.panels.length !== count) throw new Error("Wrong visual panel count.");
    for (const panel of r.panels) {
      if (publicVisualFile(panel.asset).usage !== "production")
        throw new Error("Synthetic assets cannot be used in an assessment.");
      if (
        role === "label"
          ? panel.targets.length !== 2
          : panel.targets.length !== 0
      )
        throw new Error("Wrong public overlay.");
    }
  }
  return {
    ...plan,
    parts: plan.parts.map((p) => ({
      ...p,
      ...(s.assignments.find((a) => a.questionNumber === p.questionNumber)
        ? {
            visualAssignment: structuredClone(
              s.assignments.find((a) => a.questionNumber === p.questionNumber),
            ),
          }
        : {}),
    })),
  };
}
export function visualTask(assignment: VisualAssignment): string {
  const role = assignment.configId.split("_").at(-1);
  return role === "label"
    ? "Researchers examine the supplied biological section.\n\nIdentify the structures indicated by letters A and B."
    : role === "compare"
      ? "Researchers compare the three supplied biological specimens in one investigation.\n\nIdentify each specimen in panels A, B and C. Explain one identification using visible evidence."
      : "Researchers examine the supplied biological specimen.\n\nIdentify the specimen and explain your identification using visible evidence.";
}
export function visualPublicIssue(
  row: any,
  expected: VisualAssignment | undefined,
): string | null {
  try {
    if (!expected) {
      if (row.diagram_config?.kind === "biology_visual")
        throw new Error("Unplanned visual asset.");
      return null;
    }
    for (const field of [
      "figure_urls",
      "chart_data",
      "table_data",
      "diagramConfig",
      "question_latex",
      "graph_description",
      "generated_diagram_url",
      "options",
    ]) {
      const value = row[field];
      if (
        value != null &&
        (Array.isArray(value)
          ? value.length > 0
          : typeof value === "string"
            ? value.trim().length > 0
            : true)
      )
        throw new Error(
          "Additional or hidden resources are forbidden on a frozen visual task.",
        );
    }
    if (
      row.question_text !== visualTask(expected) ||
      JSON.stringify(parseVisualResource(row.diagram_config)) !==
        JSON.stringify(expected.resource)
    )
      throw new Error("Visual claims, asset version or overlay changed.");
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
