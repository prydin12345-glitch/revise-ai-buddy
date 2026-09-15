import { normalizeRepairPart, validateQuestionCandidates } from './question-contract-validator.ts';
import { resolveQuestionResources } from './question-resources.ts';
import type { BiologyScope } from './gcse-biology-scope.ts';

export interface GroupRepairOutcome {
  /** Usable replacements keyed by question number. */
  accepted: Record<string, any>;
  /** Why a returned part was refused, keyed by question number. */
  rejections: Record<string, string>;
  /** Targeted parts that are still not repaired. */
  unresolved: string[];
}

/**
 * Build the usable replacements from a repair response.
 *
 * Every accepted part is kept even when a sibling is refused, so a good fix is
 * never discarded. Each refusal records a precise reason so the caller can log
 * why a repair attempt made no progress instead of silently burning budget.
 */
export function prepareGroupRepairDetailed(
  group: any[],
  parts: unknown,
  scope: BiologyScope,
  requiredParts: Set<string> = new Set(),
  targetNumbers: Set<string> = new Set(),
): GroupRepairOutcome {
  const accepted: Record<string, any> = {};
  const rejections: Record<string, string> = {};
  const targets = [...targetNumbers];
  const unresolved = () => (targets.length ? targets.filter(n => !accepted[n]) : Object.keys(rejections));

  if (!Array.isArray(parts) || !parts.length) {
    for (const n of targets) rejections[n] = 'model returned no parts';
    return { accepted, rejections, unresolved: unresolved() };
  }

  for (const row of group) {
    const number = String(row.question_number);
    const reject = (reason: string) => { rejections[number] = reason; };
    const matches = parts.filter(p => String((p as any)?.question_number ?? '').trim() === number);
    if (matches.length !== 1) { reject(matches.length ? 'duplicate parts returned for this number' : 'part missing from repair response'); continue; }
    const part: any = matches[0];
    const normalized = normalizeRepairPart(part);
    if (!normalized) { reject('no explicit task and/or answer key returned'); continue; }
    const resourceIssues = resolveQuestionResources({ ...part, question_text: normalized.questionText }).issues;
    if (resourceIssues.length) { reject('resource invalid: ' + resourceIssues.join('; ')); continue; }
    const needsResource = requiredParts.has(number) || !!row.diagram_config || !!row.table_data;
    const diagram = part.diagram_config ?? part.chart_data ?? null;
    if (needsResource && (!diagram || typeof diagram !== 'object' || Array.isArray(diagram))) { reject('required resource dropped by the repair'); continue; }
    if (row.question_type === 'mcq' && normalized.options?.length !== 4) { reject('MCQ did not return exactly 4 options'); continue; }
    const candidate = {
      ...row, question_text: normalized.questionText, correct_answer: normalized.correctAnswer,
      options: normalized.options ?? (row.question_type === 'mcq' ? null : row.options),
      diagram_config: diagram, table_data: null, question_latex: null,
    };
    const validation = validateQuestionCandidates([candidate], { scope });
    if (!validation.ok) { reject('still failed the contract: ' + validation.defects.map(d => d.code).join(', ')); continue; }
    candidate.question_text = resolveQuestionResources(candidate).text;
    accepted[number] = candidate;
  }

  return { accepted, rejections, unresolved: unresolved() };
}

/**
 * Backwards-compatible wrapper: all-or-nothing when no targets are named,
 * otherwise every named part must be repaired.
 */
export function prepareGroupRepair(
  group: any[],
  parts: unknown,
  scope: BiologyScope,
  requiredParts: Set<string> = new Set(),
  targetNumbers: Set<string> = new Set(),
): Record<string, any> | null {
  const strict = targetNumbers.size === 0;
  if (strict && (!Array.isArray(parts) || parts.length !== group.length)) return null;
  const { accepted, rejections, unresolved } = prepareGroupRepairDetailed(group, parts, scope, requiredParts, targetNumbers);
  if (strict && Object.keys(rejections).length) return null;
  if (!strict && unresolved.length) return null;
  return Object.keys(accepted).length ? accepted : null;
}
