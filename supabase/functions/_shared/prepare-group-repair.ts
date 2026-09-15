import { normalizeRepairPart, validateQuestionCandidates } from './question-contract-validator.ts';
import { resolveQuestionResources } from './question-resources.ts';
import type { BiologyScope } from './gcse-biology-scope.ts';

/**
 * Build the usable replacements from a repair response.
 *
 * When `targetNumbers` is empty the replacement is all-or-nothing (every
 * sibling must come back valid). When the caller names the defective parts,
 * a repair is accepted as long as every named part is valid — an untouched or
 * malformed healthy sibling no longer throws away a good fix.
 */
export function prepareGroupRepair(
  group: any[],
  parts: unknown,
  scope: BiologyScope,
  requiredParts: Set<string> = new Set(),
  targetNumbers: Set<string> = new Set(),
): Record<string, any> | null {
  if (!Array.isArray(parts) || !parts.length) return null;
  const strict = targetNumbers.size === 0;
  if (strict && parts.length !== group.length) return null;
  const out: Record<string, any> = {};
  for (const row of group) {
    const number = String(row.question_number);
    const matches = parts.filter(p => String((p as any)?.question_number ?? '').trim() === number);
    const reject = (): null | undefined => { if (strict) return null; return undefined; };
    if (matches.length !== 1) { if (strict) return null; continue; }
    const part: any = matches[0];
    const normalized = normalizeRepairPart(part);
    if (!normalized) { if (strict) return null; continue; }
    if (resolveQuestionResources({ ...part, question_text: normalized.questionText }).issues.length) { if (strict) return null; continue; }
    const needsResource = requiredParts.has(number) || !!row.diagram_config || !!row.table_data;
    const diagram = part.diagram_config ?? part.chart_data ?? null;
    if (needsResource && (!diagram || typeof diagram !== 'object' || Array.isArray(diagram))) { if (strict) return null; continue; }
    if (row.question_type === 'mcq' && normalized.options?.length !== 4) { if (strict) return null; continue; }
    void reject;
    const candidate = {
      ...row, question_text: normalized.questionText, correct_answer: normalized.correctAnswer,
      options: normalized.options ?? (row.question_type === 'mcq' ? null : row.options),
      diagram_config: diagram, table_data: null, question_latex: null,
    };
    if (!validateQuestionCandidates([candidate], { scope }).ok) { if (strict) return null; continue; }
    candidate.question_text = resolveQuestionResources(candidate).text;
    out[number] = candidate;
  }
  if (!strict && ![...targetNumbers].every(n => out[n])) return null;
  return Object.keys(out).length ? out : null;
}
