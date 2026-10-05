// Structural completeness only. Scientific truth and the matching private key
// still require review; this helper never invents a missing proposition.
const normal = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const indexOf = (label: string): number => /^\d+$/.test(label) ? Number(label) : ['i','ii','iii','iv','v','vi'].indexOf(label.toLowerCase()) + 1;

export function statementCombinationIssue(stem: string, options: readonly string[] | null, requiredNumbers: readonly number[] = []): string | null {
  if (!options?.length) return null;
  const referenced = new Set<number>(requiredNumbers);
  for (const option of options) {
    const body = option.replace(/[*_]/g, '').trim().replace(/^[A-D][.)]\s*/i, '');
    if (!/\bstatements?\b|\band\b|,|&/i.test(body) && !/\b(?:following|these|which of the) statements\b/i.test(stem)) continue;
    // Complete proposition pairs embedded inside options are legitimate. Only
    // combination-only choices refer to separately supplied statements.
    if (!/^(?:(?:statements?|numbers?)\s+)?(?:\(?\d+\)?|\(?i{1,3}v?\)?|\(?iv\)?)(?:\s*(?:,|and|&)\s*(?:\(?\d+\)?|\(?[iv]+\)?))*(?:\s+only)?[.\s]*$/i.test(body)) continue;
    for (const label of body.match(/\d+|\b[iv]+\b/gi) ?? []) referenced.add(indexOf(label));
  }
  if (!referenced.size) return null;
  const text = stem.replace(/[*_]/g, '').replace(/<br\s*\/?\s*>/gi, '\n');
  const labels = [...text.matchAll(/(?:^|\n|;|[.!?:][ \t]+)[ \t]*(?:[-•][ \t]*)?\(?(\d+|i{1,3}|iv|v|vi)\)?[.):][ \t]*/gim)];
  const bodies = new Map<number, string[]>();
  labels.forEach((label, i) => {
    const n = indexOf(label[1]);
    const body = text.slice(label.index! + label[0].length, labels[i + 1]?.index ?? text.length)
      .split(/\n\s*\n|(?:\n\s*|\.[ \t]+)(?=(?:Which|Select|Tick|Choose)\b)/i)[0].trim();
    bodies.set(n, [...(bodies.get(n) ?? []), body]);
  });
  const missing = [...referenced].filter(n => !bodies.get(n)?.some(body => /\p{L}{2,}/u.test(body) && !/^(?:Which|Select|Tick|Choose)\b/i.test(body) && !/^statement\s*\d*[.\s]*$/i.test(body)));
  if (missing.length) return `Statement-combination MCQ references missing or empty statement(s) ${missing.sort((a,b)=>a-b).join(', ')}. Supply every numbered proposition in the student-visible context, then check all four choices and rewrite the private key.`;
  const duplicateLabels = [...bodies].filter(([, items]) => items.length !== 1).map(([n]) => n);
  const propositions = [...bodies.values()].map(items => normal(items[0]));
  if (duplicateLabels.length || new Set(propositions).size !== propositions.length) return 'Statement-combination MCQ has duplicate labels or duplicate propositions. Return distinct, unambiguous numbered statements and a freshly checked private key.';
  return null;
}

/** A supported model field is public stimulus, never a private truth table. */
export function declaredStatementText(value: unknown): string {
  if (!Array.isArray(value) || !value.length || !value.every(item => typeof item === 'string' && item.trim())) return '';
  const items = value as string[];
  const labelled = items.map(item => item.trim().match(/^\(?(\d+|i{1,3}|iv|v|vi)\)?[.):][ \t]+(.+)$/i));
  if (labelled.every(Boolean)) return labelled.map(match => `${indexOf(match![1])}. ${match![2]}`).join('\n');
  // A partial label set is ambiguous; never silently renumber propositions
  // while retaining a private combination key that referred to old numbers.
  if (labelled.some(Boolean)) return '';
  return items.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n');
}

/** Only canonical public table cells, never captions, keys or truth flags. */
export function statementTableText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const table = value as {headers?: string[]; rows?: unknown[][]};
  if (!Array.isArray(table.headers) || !Array.isArray(table.rows) ||
      !/^(?:statement(?:\s+(?:number|no\.?))?|number|no\.?|#)$/i.test(table.headers[0]?.trim() ?? '')) return '';
  return table.rows.map(row => {
    if (!Array.isArray(row) || typeof row[1] !== 'string') return '';
    const label = String(row[0]).trim().replace(/[().:]/g, '');
    if (!/^(?:\d+|i{1,3}|iv|v|vi)$/i.test(label)) return '';
    return `${indexOf(label)}. ${row[1]}`;
  }).filter(Boolean).join('\n');
}
