/** Shared resource checks. Contradictory measurements must never be hidden by precedence. */
export interface ResourceQuestion {
  question_text?: unknown; chart_data?: unknown; diagram_config?: unknown;
  diagramConfig?: unknown; options?: unknown; table_data?: unknown;
}
export interface ResourceIssue {
  code: 'conflicting_resource_data' | 'invalid_resource' | 'inappropriate_graph';
  detail: string;
}
export interface DataTable {
  type: 'data_table'; headers: string[]; rows: (string | number)[][];
  units?: string[]; caption?: string; [key: string]: unknown;
}
const CHART_TYPES = new Set(['data_table', 'line_chart', 'bar_chart', 'pie_chart', 'climate_chart', 'cumulative_frequency', 'frequency_polygon', 'histogram', 'boxplot', 'boxplot_comparison']);
const object = (v: unknown): Record<string, any> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
export const isResourceChart = (v: unknown): boolean => !!object(v) && CHART_TYPES.has(object(v)!.type);
const plain = (v: unknown): string => String(v ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&minus;/gi, '-').replace(/[−–]/g, '-').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const comparable = (v: unknown): string => {
  const s = plain(v);
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s) ? String(Number(s)) : s.toLowerCase();
};
/** Only deduplicate the exact declared unit, never unrelated units or prose. */
export function formatHeaderUnit(header: unknown, unit?: unknown): string {
  let h = String(header ?? '').trim();
  const u = String(unit ?? '').trim();
  if (!u) return h;
  const escaped = u.replace(/[.*+?^{}()|[\]\\$]/g, '\\$&').replace(/\s+/g, '\\s*');
  const suffix = new RegExp('\\(\\s*' + escaped + '\\s*\\)\\s*$', 'i');
  while (suffix.test(h)) {
    const previous = h.replace(suffix, '').trim();
    if (!suffix.test(previous)) return h;
    h = previous;
  }
  return h + ' (' + u + ')';
}
function asTable(value: unknown): DataTable | null {
  let v = value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  if (Array.isArray(v) && v.length > 1 && v.every(Array.isArray)) v = { headers: v[0], rows: v.slice(1) };
  const t = object(v);
  return t && Array.isArray(t.headers) && Array.isArray(t.rows) ? { ...t, type: 'data_table', headers: t.headers.map(String), rows: t.rows } as DataTable : null;
}
function validTable(t: DataTable): boolean {
  return t.headers.length > 0 && t.rows.length > 0 && t.rows.every(row => Array.isArray(row) && row.length === t.headers.length && row.every(cell => typeof cell === 'string' || (typeof cell === 'number' && Number.isFinite(cell))));
}
const headerKey = (t: DataTable) => t.headers.map((h, i) => comparable(formatHeaderUnit(h, t.units?.[i]))).join('|');
const rowKey = (t: DataTable) => JSON.stringify(t.rows.map(row => row.map(comparable)));
const sameTable = (a: DataTable, b: DataTable) => headerKey(a) === headerKey(b) && rowKey(a) === rowKey(b);
interface EmbeddedTable { start: number; end: number; table: DataTable; }
function embeddedTables(text: string): EmbeddedTable[] {
  const found: EmbeddedTable[] = [];
  for (const m of text.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const rows = [...m[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row => [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(cell => plain(cell[1]))).filter(row => row.length);
    if (rows.length > 1) found.push({ start: m.index!, end: m.index! + m[0].length, table: { type: 'data_table', headers: rows[0], rows: rows.slice(1) } });
  }
  for (const m of text.matchAll(/^[ \t]*\|[^\r\n]*\|[ \t]*(?:\r?\n[ \t]*\|[^\r\n]*\|[ \t]*)+/gm)) {
    if (found.some(t => m.index! >= t.start && m.index! < t.end)) continue;
    const rows = m[0].split(/\r?\n/).map(line => line.trim().slice(1, -1).split('|').map(plain)).filter(row => !row.every(cell => /^:?-{2,}:?$/.test(cell.replace(/\s/g, ''))));
    if (rows.length > 1) found.push({ start: m.index!, end: m.index! + m[0].length, table: { type: 'data_table', headers: rows[0], rows: rows.slice(1) } });
  }
  return found;
}
const numeric = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.replace(/[−–]/g, '-').trim();
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s) && Number.isFinite(Number(s))) return Number(s);
  }
  return null;
};
/**
 * Deterministically repair trivially fixable line-graph payloads: numeric
 * strings become numbers and an exactly repeated reading is dropped. Anything that is
 * genuinely unusable is left untouched so the validator still reports it.
 */
export function coerceChart(chart: unknown): { chart: unknown; changed: boolean } {
  const c = object(chart);
  if (!c || c.type !== 'line_chart' || !Array.isArray(c.datasets)) return { chart, changed: false };
  let changed = false;
  const datasets = c.datasets.map((ds: any) => {
    if (!ds || !Array.isArray(ds.data)) return ds;
    const seen = new Map<number, number>();
    const data: any[] = [];
    for (const pt of ds.data) {
      if (!pt || typeof pt !== 'object') { data.push(pt); continue; }
      const x = numeric((pt as any).x);
      const y = numeric((pt as any).y);
      if (x === null || y === null) { data.push(pt); continue; }
      // Conflicting y values at one x are evidence of a data defect. Keep them
      // so validation can reject them, rather than silently choosing a value.
      if (seen.has(x) && seen.get(x) === y) { changed = true; continue; }
      seen.set(x, y);
      if (x !== (pt as any).x || y !== (pt as any).y) changed = true;
      data.push({ ...pt, x, y });
    }
    return { ...ds, data };
  });
  return changed ? { chart: { ...c, datasets }, changed: true } : { chart, changed: false };
}
export function chartIssues(chart: unknown): ResourceIssue[] {
  const c = object(coerceChart(chart).chart);
  if (!c) return [];
  const invalid = (detail: string): ResourceIssue[] => [{ code: 'invalid_resource', detail }];
  if (c.type === 'data_table') {
    const table = asTable(c);
    return table && validTable(table) ? [] : invalid('Table row widths and finite values must match the headers.');
  }
  if (c.type === 'line_chart') {
    if (!Array.isArray(c.datasets) || !c.datasets.length) return invalid('Line graph needs data series.');
    const labels = new Set<string>();
    for (const ds of c.datasets) {
      if (!ds || typeof ds.label !== 'string' || !ds.label.trim() || labels.has(ds.label) || !Array.isArray(ds.data) || ds.data.length < 2) return invalid('Line graph needs unique series names and at least two points.');
      labels.add(ds.label);
      const xs = new Set<number>();
      for (const pt of ds.data) {
        if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number' || !Number.isFinite(pt.x) || !Number.isFinite(pt.y) || xs.has(pt.x)) return invalid('Line graph needs finite numeric coordinates and unique x values per series.');
        xs.add(pt.x);
      }
    }
  }
  if (c.type === 'bar_chart' && Array.isArray(c.bars)) {
    const clockLabels = c.bars.length > 0 && c.bars.every((b: any) => /^\d{1,2}:\d{2}(?:\s*[-–—]\s*\d{1,2}:\d{2})?$/.test(String(b?.label).trim()));
    const timeAxis = c.xKind === 'time' || (clockLabels && /\b(time|hours?|minutes?|seconds?)\b/i.test(String(c.xLabel ?? '')));
    const explicitIntervals = c.measurementType === 'interval_mean' || c.measurementType === 'interval_total';
    if (c.xKind === 'continuous' || c.measurementType === 'point' || (timeAxis && !explicitIntervals)) return [{ code: 'inappropriate_graph', detail: 'Use numeric line-graph points for continuous/time observations. Interval summaries require explicit interval_mean/interval_total semantics; never invent point timestamps for time bins.' }];
  }
  return [];
}
export function stripResourcePlaceholders(text: string, hasPayload: boolean): string {
  if (!hasPayload) return text;
  return text.replace(/\[(?:graph|chart|diagram|table|figure)\s+(?:showing|of|depicting|illustrating)\b[^\]\r\n]*\]/gi, '').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').trim();
}
export function resolveQuestionResources(q: ResourceQuestion) {
  const text = typeof q.question_text === 'string' ? q.question_text : '';
  const issues: ResourceIssue[] = [];
  const charts = [q.chart_data, q.diagram_config, q.diagramConfig, q.options].filter(isResourceChart);
  let chart: any = charts[0] ?? null;
  const tables = charts.map(asTable).filter((t): t is DataTable => !!t);
  const separate = asTable(q.table_data);
  if (separate) tables.push(separate);
  else if (typeof q.table_data === 'string') tables.push(...embeddedTables(q.table_data).map(t => t.table));
  const table = tables[0] ?? null;
  if (!chart && table) chart = table;
  for (const t of tables) {
    if (!validTable(t)) issues.push({ code: 'invalid_resource', detail: 'Table rows do not match the column headers.' });
    else if (table && validTable(table) && !sameTable(table, t)) issues.push({ code: 'conflicting_resource_data', detail: 'Stored copies of the data table disagree. Regenerate the question and mark scheme together.' });
  }
  const remove: EmbeddedTable[] = [];
  if (table && validTable(table)) for (const entry of embeddedTables(text)) {
    // Preserve input tables with blanks, and independently headed tables.
    if (!validTable(entry.table) || entry.table.rows.some(row => row.some(cell => !plain(cell))) || headerKey(entry.table) !== headerKey(table)) continue;
    if (sameTable(entry.table, table)) remove.push(entry);
    else issues.push({ code: 'conflicting_resource_data', detail: 'The table in the stem disagrees with the structured figure. Neither copy is automatically authoritative.' });
  }
  if (chart) issues.push(...chartIssues(chart));
  if (chart) chart = coerceChart(chart).chart;
  let clean = text;
  if (!issues.length) for (const entry of remove.sort((a, b) => b.start - a.start)) clean = clean.slice(0, entry.start) + clean.slice(entry.end);
  clean = stripResourcePlaceholders(clean, !!chart || !!object(q.diagram_config) || !!object(q.diagramConfig));
  return { text: clean, chart, table, issues };
}
export function requireConsistentResources(q: ResourceQuestion) {
  const result = resolveQuestionResources(q);
  if (result.issues.length) throw new Error(result.issues.map(i => i.detail).join(' '));
  return result;
}
