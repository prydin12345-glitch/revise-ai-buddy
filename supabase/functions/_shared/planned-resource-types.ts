/**
 * Plain mapping from a planned resource kind to the canonical payload type the
 * answerability gate accepts. Models often return a results table where the
 * plan needs a graph; the gate (correctly) rejects that, so say it explicitly.
 */
interface PartLike { questionNumber: string; resource?: string | null; }

export function plannedResourceTypeNotes(parts: readonly PartLike[], field: 'chart_data' | 'diagram_config' = 'chart_data'): string {
  const lines = parts.flatMap(part => {
    if (part.resource === 'graph') return [`Q${part.questionNumber}: planned graph -> ${field}.type MUST be "line_chart" with axis labels (units) and datasets of numeric {"x","y"} points. A data_table does NOT satisfy a planned graph, even with the same numbers.`];
    if (part.resource === 'data_table') return [`Q${part.questionNumber}: planned data table -> ${field}.type MUST be "data_table".`];
    return [];
  });
  return lines.length ? `RESOURCE TYPES (mandatory):\n${lines.join('\n')}` : '';
}
