/** One output schema shared by A-level generation and group repair. */
export function questionResourceInstructions(field: 'chart_data' | 'diagram_config'): string {
  return [
    `QUESTION-LOCAL RESOURCE CONTRACT (${field}): a label such as Figure 5, a caption or a reference to another part is NOT a resource payload.`,
    `If this part asks the student to read data/see a figure, put that complete resource in this part's ${field}. The app does not automatically attach another part's graph or table.`,
    'For a planned resource=none part, prefer a self-contained knowledge/application task with all necessary givens stated. Do not introduce an unsupported figure/table dependency. Do not just remove the reference words from a task which still needs unseen data.',
    'Results table schema: {"type":"data_table","headers":["Sample","Count"],"rows":[["A",2],["B",4]],"caption":"Results"}. This illustrates shape only, not data to copy.',
    'Every results-table row must have exactly headers.length scalar cells, in header order. Include a header for a row-label column. No merged cells, nested arrays/objects, nulls or omitted values; use separate columns for replicate readings and put each unit in its column header.',
    'Line graph schema: {"type":"line_chart","xLabel":"Time (min)","yLabel":"Measurement (unit)","datasets":[{"label":"Trial","data":[{"x":0,"y":2},{"x":2,"y":4}]}]}. Use actual finite numeric x/y observations, units and distinct x values per series.',
    'Keep the assessed measurements identical across the task, resource and private worked key. Do not copy tables into Markdown/HTML or reveal calculated answers in captions. Check the resource against the task before returning JSON.',
  ].join('\n');
}
