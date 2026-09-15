import { normalizeRepairPart, validateQuestionCandidates } from './question-contract-validator.ts';
import { resolveQuestionResources } from './question-resources.ts';
import type { BiologyScope } from './gcse-biology-scope.ts';

/** A replacement is all-or-nothing: every sibling, its key and required data. */
export function prepareGroupRepair(group: any[], parts: unknown, scope: BiologyScope, requiredParts: Set<string> = new Set()): Record<string, any> | null {
  if (!Array.isArray(parts) || parts.length !== group.length) return null;
  const out: Record<string, any> = {};
  for (const row of group) {
    const number = String(row.question_number);
    const matches = parts.filter(p => String(p?.question_number ?? '').trim() === number);
    if (matches.length !== 1) return null;
    const part = matches[0];
    const normalized = normalizeRepairPart(part);
    if (!normalized) return null;
    if (resolveQuestionResources({ ...part, question_text: normalized.questionText }).issues.length) return null;
    const needsResource = requiredParts.has(number) || !!row.diagram_config || !!row.table_data;
    const diagram = part.diagram_config ?? part.chart_data ?? null;
    if (needsResource && (!diagram || typeof diagram !== 'object' || Array.isArray(diagram))) return null;
    if (row.question_type === 'mcq' && normalized.options?.length !== 4) return null;
    const candidate = {
      ...row, question_text: normalized.questionText, correct_answer: normalized.correctAnswer,
      options: normalized.options ?? (row.question_type === 'mcq' ? null : row.options),
      diagram_config: diagram, table_data: null, question_latex: null,
    };
    if (!validateQuestionCandidates([candidate], { scope }).ok) return null;
    candidate.question_text = resolveQuestionResources(candidate).text;
    out[number] = candidate;
  }
  return out;
}
