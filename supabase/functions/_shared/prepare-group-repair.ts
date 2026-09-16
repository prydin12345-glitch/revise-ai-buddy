import { assembleQuestionText, hasAssessedTask, normalizeRepairPart, validateQuestionCandidates } from './question-contract-validator.ts';
import { resolveQuestionResources, isResourceChart } from './question-resources.ts';
import type { BiologyScope } from './gcse-biology-scope.ts';

export type RepairMode = 'task_only' | 'full_group';
export interface RepairDiagnostic { code: string; partNumber?: string; detail: string; }
export interface RepairResult {
  ok: boolean;
  replacements: Record<string, any>;
  diagnostics: RepairDiagnostic[];
}
export interface GroupRepairOutcome {
  accepted: Record<string, any>;
  rejections: Record<string, string>;
  unresolved: string[];
}

/** Compare common numbering variants without changing stored identities. */
export const repairNumberKey = (value: unknown): string => String(value ?? '').trim()
  .replace(/^(?:question\s*|q(?=\s*\d))/i, '').replace(/\s+/g, '')
  .replace(/^0+(?=\d)/, '').replace(/[()]/g, '').replace(/\.(?=[a-z])/gi, '').toLowerCase();

const stable = (value: any): string => JSON.stringify(value === undefined ? null : value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

/** Models label the instruction inconsistently; accept the usual aliases. */
const readRepairTask = (part: any, originalText = ''): string => {
  for (const field of ['task', 'instruction', 'command', 'assessed_task', 'question_task', 'question']) {
    const value = part?.[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const text = typeof part?.question_text === 'string' ? part.question_text.trim() : '';
  if (text && originalText && text.startsWith(originalText.trim())) {
    const suffix = text.slice(originalText.trim().length).trim();
    if (suffix) return suffix;
  }
  return '';
};


/**
 * Missing commands can be repaired independently only while their original
 * context, figures and options remain intact. Changing shared source material
 * requires a complete group repair and rewritten keys for every scored part.
 * Every rejection reports a code; no model response is silently discarded.
 */
export function analyseGroupRepair(
  group: any[], parts: unknown, scope: BiologyScope,
  requiredParts: Set<string> = new Set(), targetNumbers: Set<string> = new Set(),
  mode: RepairMode = targetNumbers.size ? 'task_only' : 'full_group',
): RepairResult {
  const diagnostics: RepairDiagnostic[] = [];
  const replacements: Record<string, any> = {};
  const fail = (code: string, detail: string, partNumber?: string) => diagnostics.push({ code, partNumber, detail });
  const result = (): RepairResult => {
    // Safe independent task fixes may make partial progress. Group rewrites
    // remain atomic at acceptance because sibling keys can share source data.
    const allowPartial = mode === 'task_only' && diagnostics.every(d => !!d.partNumber);
    const accepted = diagnostics.length && !allowPartial ? {} : replacements;
    return { ok: Object.keys(accepted).length > 0, replacements: accepted, diagnostics };
  };
  if (!Array.isArray(parts) || !parts.length) {
    fail('invalid_response_shape', 'Expected a non-empty parts array.');
    return result();
  }
  const byKey = new Map(group.map(row => [repairNumberKey(row.question_number), row]));
  if (byKey.size !== group.length) {
    fail('ambiguous_original_number', 'Original part numbers are not unique.');
    return result();
  }
  const targets = mode === 'full_group' ? new Set(byKey.keys())
    : new Set([...targetNumbers].map(repairNumberKey));
  if (!targets.size || [...targets].some(key => !byKey.has(key))) {
    fail('invalid_target', 'Repair targets must identify existing group members.');
    return result();
  }
  const received = new Map<string, any>();
  for (const part of parts) {
    const key = repairNumberKey(part?.question_number);
    if (!key || !byKey.has(key)) { fail('unknown_part', 'Response contains an unrecognised part number.'); continue; }
    // Healthy siblings are never rewritten by a task-only repair.
    if (!targets.has(key)) continue;
    if (received.has(key)) { fail('duplicate_part', 'Response repeats the same part.', String(byKey.get(key).question_number)); continue; }
    received.set(key, part);
  }
  for (const key of targets) {
    const row = byKey.get(key);
    const number = String(row.question_number);
    if (diagnostics.some(d => d.partNumber === number)) continue;
    const part = received.get(key);
    if (!part) { fail('missing_part', 'Required repaired part was not returned.', number); continue; }
    const scored = Number(row.marks ?? 0) > 0;
    const task = readRepairTask(part);
    if (scored && !hasAssessedTask(task)) {
      fail('missing_task', `Return a separately stated task with an assessed instruction. Received: "${task.slice(0, 120)}"`, number); continue;
    }

    const normalized = scored ? normalizeRepairPart(part) : null;
    if (scored && !normalized) {
      fail('missing_answer', 'Scored repair requires a rewritten non-empty answer key.', number); continue;
    }
    let candidate: any;
    if (mode === 'task_only') {
      const originalText = assembleQuestionText(row);
      const contextChanged = typeof part.context === 'string' && part.context.trim() && part.context.trim() !== originalText.trim();
      const textChanged = typeof part.question_text === 'string' && part.question_text.trim()
        && ![originalText.trim(), `${originalText}\n\n${task}`.trim()].includes(part.question_text.trim());
      const resourceChanged = ['diagram_config', 'chart_data', 'diagramConfig', 'table_data', 'options'].some(field =>
        part[field] !== undefined && part[field] !== null && stable(part[field]) !== stable(row[field]));
      if (contextChanged || textChanged || resourceChanged) {
        fail('source_changed', 'Task-only repair must preserve the original context, resources and choices.', number); continue;
      }
      candidate = { ...row, question_text: `${originalText}\n\n${task}`.trim(), correct_answer: normalized!.correctAnswer,
        context: null, task: null, question_latex: null };
    } else {
      const text = normalized?.questionText ?? assembleQuestionText(part);
      if (!text) { fail('empty_context', 'An unmarked parent still needs context.', number); continue; }
      const resources = resolveQuestionResources({ ...part, question_text: text });
      if (resources.issues.length) {
        for (const issue of resources.issues) fail(issue.code, issue.detail, number);
        continue;
      }
      const needsResource = requiredParts.has(number) || !!row.diagram_config || !!row.table_data;
      const diagram = part.diagram_config ?? part.chart_data ?? resources.chart ?? null;
      if (needsResource && (!diagram || typeof diagram !== 'object' || Array.isArray(diagram))) {
        fail('missing_required_resource', 'Complete group repairs must return every required resource.', number); continue;
      }
      candidate = { ...row, question_text: resources.text, correct_answer: normalized?.correctAnswer ?? row.correct_answer,
        options: normalized?.options ?? (row.question_type === 'mcq' || isResourceChart(row.options) ? null : row.options),
        diagram_config: diagram, table_data: null, question_latex: null, context: null, task: null };
    }
    const validation = validateQuestionCandidates([candidate], { scope });
    if (!validation.ok) {
      for (const defect of validation.defects) fail(defect.code, defect.detail, number);
      continue;
    }
    candidate.question_text = resolveQuestionResources(candidate).text;
    replacements[number] = candidate;
  }
  return result();
}

/** Compatibility wrapper for callers that only need the accepted replacements. */
export function prepareGroupRepair(
  group: any[], parts: unknown, scope: BiologyScope,
  requiredParts: Set<string> = new Set(), targetNumbers: Set<string> = new Set(),
): Record<string, any> | null {
  const result = analyseGroupRepair(group, parts, scope, requiredParts, targetNumbers);
  return result.ok && !result.diagnostics.length ? result.replacements : null;
}

/** Preserve the detailed interface introduced by the latest Lovable change. */
export function prepareGroupRepairDetailed(
  group: any[], parts: unknown, scope: BiologyScope,
  requiredParts: Set<string> = new Set(), targetNumbers: Set<string> = new Set(),
): GroupRepairOutcome {
  const result = analyseGroupRepair(group, parts, scope, requiredParts, targetNumbers);
  const targets = targetNumbers.size ? [...targetNumbers] : group.map(row => String(row.question_number));
  return {
    accepted: result.replacements,
    rejections: Object.fromEntries(result.diagnostics.map(d => [d.partNumber ?? 'response', `${d.code}: ${d.detail}`])),
    unresolved: targets.filter(number => !result.replacements[number]),
  };
}
