import type { PaperPlan } from "./paper-contract-types.ts";
import type {
  CandidatePart,
  QuestionDefect,
} from "./question-contract-validator.ts";
import { resolveQuestionResources } from "./question-resources.ts";
import { coerceMcqOptions, isMcqType } from "./model-question-normalization.ts";
export function unsupportedTemplateResource(row: CandidatePart): boolean {
  const resources = resolveQuestionResources(row);
  return (
    !!resources.passage ||
    !!resources.essay ||
    [row.diagram_config, row.diagramConfig, row.chart_data].some(
      (config) =>
        config &&
        typeof config === "object" &&
        ![
          "data_table",
          "line_chart",
          "bar_chart",
          "scatter_plot",
          "histogram",
          "pie_chart",
          "box_plot",
        ].includes((config as any).type),
    )
  );
}
export function validateGenericPlan(
  rows: CandidatePart[],
  plan: PaperPlan,
): QuestionDefect[] {
  const defects: QuestionDefect[] = [],
    seen = new Set<string>();
  for (const r of rows) {
    const number = String(r.question_number),
      p = plan.parts.find((p) => p.questionNumber === number);
    const fail = (
      detail: string,
      code: QuestionDefect["code"] = "plan_mismatch",
    ) =>
      defects.push({
        partId: String(r.id ?? number),
        parentId: r.parent_question_number ?? null,
        code,
        detail,
      });
    if (!p || seen.has(number)) {
      fail("Unexpected or duplicate template part.");
      continue;
    }
    seen.add(number);
    if (
      Number(r.marks) !== p.marks ||
      (r as CandidatePart & { topic_tag?: string }).topic_tag !== p.topic
    )
      fail("Marks/topic differ from the saved template.");
    if (isMcqType(r.question_type) !== (p.responseType === "mcq_single"))
      fail("Response format differs from template.");
    if (p.responseType === "mcq_single" && coerceMcqOptions(r)?.length !== 4)
      fail("Four distinct choices required.", "invalid_options");
    if (unsupportedTemplateResource(r))
      fail(
        "A reviewed course/asset adapter is required for this resource.",
        "invalid_resource",
      );
    const resource = resolveQuestionResources(r);
    if (p.resource === "data_table" && !resource.table)
      fail("Planned table is missing.", "missing_required_resource");
    if (
      p.resource === "graph" &&
      (!resource.chart || resource.chart.type === "data_table")
    )
      fail("Planned graph is missing.", "missing_required_resource");
  }
  for (const p of plan.parts)
    if (!seen.has(p.questionNumber))
      defects.push({
        partId: p.partId,
        parentId: p.parentId,
        code: "plan_mismatch",
        detail: "Missing planned part " + p.questionNumber,
      });
  return defects;
}
