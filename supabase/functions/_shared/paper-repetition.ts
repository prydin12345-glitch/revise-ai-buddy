// Whole-paper repetition checks for generated exams. Deterministic and
// deliberately narrow: only flags cases that are unambiguous repeats, so a
// healthy paper is never sent for repair by a fuzzy word-overlap guess.

export interface RepetitionDefect {
  partId: string;
  parentId: string | null;
  code: 'repeated_concept';
  detail: string;
}

type Row = Record<string, any>;

const rootOf = (r: Row): string =>
  String(r.root_question_number ?? r.parent_question_number ?? String(r.question_number ?? '').match(/^\d+/)?.[0] ?? r.question_number ?? '');
const idOf = (r: Row): string => String(r.id ?? r.question_number);
const label = (r: Row): string => `Q${String(r.question_number ?? '').replace(/^Q/i, '')}`;

const plain = (t: string): string =>
  t.replace(/\\[a-zA-Z]+/g, ' ').replace(/[${}]/g, ' ').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The concept a part asks students to define, e.g. "electric potential". */
export function definedConcept(text: string): string | null {
  const t = plain(text);
  const m = t.match(/\b(?:define|defines|definition of)\s+(?:the\s+|a\s+|an\s+)?([a-z][a-z ]{2,60}?)(?=\s+(?:at|of a|of an|in|for|as|and|is|when)\b|$)/);
  if (!m) return null;
  const concept = m[1].trim();
  return concept.split(' ').length <= 5 ? concept : null;
}

const chartKey = (r: Row): string | null => {
  const c = r.diagram_config ?? r.chart_data;
  if (!c || typeof c !== 'object') return null;
  if (c.type === 'line_chart' && Array.isArray(c.datasets)) return 'g:' + JSON.stringify(c.datasets.map((d: any) => d?.data));
  if (c.type === 'data_table' && Array.isArray(c.rows) && c.rows.length) return 't:' + JSON.stringify(c.rows);
  return null;
};

/** A sentence written twice inside one part (e.g. a question restated in maths form). */
export function repeatedSentence(text: string): string | null {
  const seen = new Set<string>();
  for (const s of String(text ?? '').split(/(?<=[.?!])\s+|\n+/)) {
    const k = plain(s);
    if (k.split(' ').length < 6) continue;
    if (seen.has(k)) return s.trim();
    seen.add(k);
  }
  return null;
}

export function repeatedConceptDefects(parts: Row[]): RepetitionDefect[] {
  const out: RepetitionDefect[] = [];
  const concepts = new Map<string, Row>();
  const charts = new Map<string, Row>();
  for (const r of parts) {
    if (!(Number(r.marks ?? 0) > 0)) continue;
    const text = String(r.question_text ?? '');
    const push = (detail: string) => out.push({ partId: idOf(r), parentId: r.parent_question_number ?? r.root_question_number ?? null, code: 'repeated_concept', detail });
    const dup = repeatedSentence(text);
    if (dup) push(`The stem states the same sentence twice ("${dup.slice(0, 80)}"). Keep one clear wording.`);
    const concept = definedConcept(text);
    if (concept) {
      const first = concepts.get(concept);
      if (first && rootOf(first) !== rootOf(r)) push(`${label(first)} already asks for the definition of "${concept}". Assess a different concept from the same topic instead, with a new key.`);
      else if (!first) concepts.set(concept, r);
    }
    const key = chartKey(r);
    if (key) {
      const first = charts.get(key);
      if (first && rootOf(first) !== rootOf(r)) push(`${label(first)} already uses exactly the same graph/table data. Use a different scenario with new data and recalculate the key.`);
      else if (!first) charts.set(key, r);
    }
  }
  return out;
}

/** Short list of tasks already written, so later batches avoid re-assessing them. */
export function coveredTasksNote(rows: Row[], max = 40): string {
  const lines = rows.filter(r => Number(r.marks ?? 0) > 0).slice(0, max).map(r => {
    const segs = String(r.question_text ?? '').split('\n').map(s => s.trim()).filter(Boolean);
    return `${label(r)}: ${(segs[segs.length - 1] ?? '').slice(0, 140)}`;
  });
  if (!lines.length) return '';
  return 'ALREADY WRITTEN ELSEWHERE IN THIS PAPER (do not re-assess the same definition, law, fact or calculation, and do not reuse the same graph/table data; choose a different concept from the planned topic):\n' + lines.join('\n');
}
