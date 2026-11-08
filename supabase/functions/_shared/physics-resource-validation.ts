import { chartAxisLabels, conflictingAxisLabels } from "./chart-axis-labels.ts";
import type { ResourceIssue, ResourceQuestion } from "./question-resources.ts";

/**
 * Circuit figures need a topology-dependent task. Mentioning a capacitor,
 * induced emf or a power supply is not enough to invent a circuit schematic.
 * This controls optional automatic rendering; it supplies no missing resource.
 */
export function needsCircuitTopology(questionText: string): boolean {
  const text = String(questionText ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return false;
  if (
    /\b(?:draw|sketch|design|construct|set up|complete|connect|wire)\b[^.!?]{0,75}\b(?:circuit|connections?|ammeter|voltmeter)\b/i.test(
      text,
    )
  )
    return true;
  const visualCircuit =
    /\b(?:circuit|circuit diagram|network)\s+(?:shown|illustrated|displayed|given|below|above)|\b(?:shown|illustrated|displayed)\s+(?:in|on)\s+(?:the\s+)?circuit\b/i.test(
      text,
    );
  const topology =
    /\b(?:connected|arranged)\s+(?:in\s+)?(?:series|parallel)|\b(?:series|parallel)\s+(?:circuit|network|combination|arrangement)|\b(?:potential|voltage) divider|\b(?:wheatstone|bridge circuit)|\b(?:junction|branch)\s+(?:current|voltage)|\b(?:kirchhoff|kirchoff)/i.test(
      text,
    );
  const graphOnlyTask =
    /\b(?:from|using|use|on|interpret|read|sketch|plot|draw|gradient|area under)\b[^.!?]{0,65}\b(?:graph|curve|plot)\b|\b(?:graph|curve|plot)\b[^.!?]{0,65}\b(?:gradient|area|time constant|decay|discharge|flux|induced)/i.test(
      text,
    );
  if (
    graphOnlyTask &&
    !visualCircuit &&
    !/\b(?:compare|explain|predict|determine|calculate)\b[^.!?]{0,60}\b(?:switch|branch|junction|series|parallel)\b/i.test(
      text,
    )
  )
    return false;
  return visualCircuit || topology;
}

const object = (value: unknown): Record<string, any> | null => {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
};

/** Physics-specific resource relevance checks; callers supply trusted course scope. */
export function physicsResourceIssues(
  question: ResourceQuestion,
): ResourceIssue[] {
  const issues: ResourceIssue[] = [];
  const text = String(question.question_text ?? "");
  const configs = [
    question.diagram_config,
    question.diagramConfig,
    question.chart_data,
    question.options,
  ]
    .map(object)
    .filter(Boolean) as Record<string, any>[];
  for (const config of configs) {
    if (
      ["circuit", "circuit_diagram"].includes(config.type) &&
      !needsCircuitTopology(text)
    )
      issues.push({
        code: "invalid_resource",
        detail:
          "A circuit schematic is attached to a task that does not assess circuit topology. Remove this decorative circuit and retain the required graph/table or provide a topology-dependent task with a matching private key.",
      });
    if (config.type !== "line_chart") continue;
    const labels = chartAxisLabels(config);
    if (!labels.xLabel || !labels.yLabel)
      issues.push({
        code: "invalid_resource",
        detail:
          "The Physics graph requires both visible axis labels, including the stated quantity and units where applicable. Do not infer labels in the renderer.",
      });
    if (conflictingAxisLabels(config))
      issues.push({
        code: "conflicting_resource_data",
        detail:
          "The graph axis-label aliases disagree. Return one consistent quantity and unit for each axis.",
      });
    if (config.xKind === "categorical")
      issues.push({
        code: "inappropriate_graph",
        detail:
          "Use a bar chart for discrete categories; a Physics line graph needs a continuous numeric horizontal variable.",
      });
    for (const axis of ["X", "Y"] as const) {
      const domain = config[`domain${axis}`];
      if (domain === undefined) continue;
      if (
        !Array.isArray(domain) ||
        domain.length !== 2 ||
        !domain.every(
          (value) => typeof value === "number" && Number.isFinite(value),
        ) ||
        domain[0] >= domain[1]
      ) {
        issues.push({
          code: "invalid_resource",
          detail: `The graph ${axis.toLowerCase()}-axis range must contain two finite increasing bounds.`,
        });
        continue;
      }
      const coordinate = axis.toLowerCase();
      if (
        Array.isArray(config.datasets) &&
        config.datasets.some(
          (series: any) =>
            Array.isArray(series?.data) &&
            series.data.some(
              (point: any) =>
                typeof point?.[coordinate] === "number" &&
                (point[coordinate] < domain[0] ||
                  point[coordinate] > domain[1]),
            ),
        )
      )
        issues.push({
          code: "invalid_resource",
          detail: `The graph ${axis.toLowerCase()}-axis range clips supplied data points. Repair the axis and source data together.`,
        });
    }
  }
  return issues.filter(
    (issue, index) =>
      issues.findIndex(
        (other) => other.code === issue.code && other.detail === issue.detail,
      ) === index,
  );
}
