// Guided Biology papers are written in bounded batches of whole parent groups.
// A single response cannot reliably carry 36 planned parts: it is cut off part
// way through, which used to surface as "Planned Q5(a) is missing". These
// helpers decide the batches, recover a truncated response and merge rows back
// under strict identity rules — nothing is ever renumbered to fill a gap.

import type { PaperPlan, PlannedPart } from './paper-contract-types.ts';

/** Canonical "5(a)" form so plan and model numbering compare reliably. */
export const plannedPartKey = (value: unknown): string => {
  const text = String(value ?? '').trim().replace(/^(?:Question\s+|Q\s*)/i, '');
  // Numeric source subparts (1.1, 1.2) mean (a), (b), not question positions.
  // Only complete explicit labels are adapted; a bare 1 never becomes 1(a).
  const numeric = text.match(/^(\d+)\s*\.\s*([1-9]|1\d|2[0-6])$/);
  if (numeric) return `${Number(numeric[1])}(${String.fromCharCode(96 + Number(numeric[2]))})`;
  const match = text.match(/^(\d+)\s*[.\-]?\s*\(?([a-z])\)?$/i);
  return match ? `${Number(match[1])}(${match[2].toLowerCase()})` : /^\d+$/.test(text) ? String(Number(text)) : text.toLowerCase();
};

/**
 * A response cut off mid-array is a partial transport, not a paper with missing
 * questions. Recover every syntactically complete question object — including
 * ones whose nested resources contain braces or escaped quotes — so the
 * completion pass only has to request the genuine remainder.
 */
export function salvageTruncatedQuestions(content: string): any[] {
  // Only top-level question arrays: never mine nested graph parts, metadata,
  // marking schemes or a later unrelated array for apparent question objects.
  const root = content.trimStart();
  const starts = root.startsWith('[') ? [content.indexOf('[')]
    : root.startsWith('{') ? topLevelQuestionArrays(content) : [];
  // Ambiguous aliases in truncated JSON cannot be compared losslessly.
  if (starts.length !== 1 || starts[0] < 0) return [];
  const arrayStart = starts[0];
  const recovered: any[] = [];
  let depth = 0, objStart = -1, inString = false, escaped = false, expectObject = true;
  for (let i = arrayStart + 1; i < content.length; i++) {
    const ch = content[i];
    if (depth === 0) {
      if (/\s/.test(ch)) continue;
      if (ch === ']') break;
      if (ch === ',' && !expectObject) { expectObject = true; continue; }
      // Do not flatten nested arrays, ignore scalar rows or guess a missing
      // delimiter. Every recovered element must be a direct object row.
      if (ch !== '{' || !expectObject) return [];
      objStart = i; depth = 1; continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') { depth++; continue; }
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try { recovered.push(JSON.parse(content.slice(objStart, i + 1))); } catch { return []; }
        objStart = -1; expectObject = false;
      }
      continue;
    }
  }
  return recovered;
}

function topLevelQuestionArrays(content: string): number[] {
  const starts: number[] = [];
  let depth = 0, inString = false, escaped = false, stringStart = -1, property = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') {
        inString = false;
        if (property && depth === 1 && /^(questions|parts)$/.test(content.slice(stringStart, i))) {
          const tail = content.slice(i + 1).match(/^\s*:\s*\[/);
          starts.push(tail ? i + tail[0].length : -1);
        }
      }
    } else if (ch === '"') {
      inString = true; stringStart = i + 1;
      property = depth === 1 && /[,{]$/.test(content.slice(0, i).trimEnd());
    }
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
  }
  return starts;
}

/**
 * Bounded batches that keep every parent group whole, so related parts and
 * their shared resources are written in the same response. A group larger than
 * the limit is still kept intact rather than split across responses.
 */
export function planGroupBatches(parts: readonly PlannedPart[], maxParts: number): PlannedPart[][] {
  const groups = new Map<string, PlannedPart[]>();
  for (const part of parts) {
    const key = String(part.parentId ?? part.questionNumber);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(part);
  }
  const batches: PlannedPart[][] = [];
  let current: PlannedPart[] = [];
  for (const group of groups.values()) {
    if (current.length && current.length + group.length > Math.max(1, maxParts)) {
      batches.push(current);
      current = [];
    }
    current.push(...group);
  }
  if (current.length) batches.push(current);
  return batches;
}

export interface MergeRejection {
  questionNumber: string;
  code: 'duplicate_part' | 'outside_batch' | 'unplanned_part' | 'missing_identity' | 'conflicting_identity' | 'invalid_identity';
  detail: string;
}

// These are identity aliases, not positional hints. All populated aliases
// must independently identify the SAME saved part. An unknown number cannot
// be rescued by another field, marks, topic, response type or array position.
const NUMBER_FIELDS = ['question_number', 'questionNumber'] as const;
const ID_FIELDS = ['part_id', 'partId'] as const;
const identityValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length <= 160) return value.trim();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
};
const safeLabel = (value: string): string => {
  const label = plannedPartKey(value);
  return /^\d{1,3}(?:\([a-z]\))?$/.test(label) ? label : '<unrecognized identity>';
};

function resolveBatchPart(row: any, plan: PaperPlan): {part?: PlannedPart; rejection?: MergeRejection} {
  const numbers = new Map(plan.parts.map(p => [plannedPartKey(p.questionNumber), p]));
  const ids = new Map(plan.parts.filter(p => typeof p.partId === 'string' && p.partId.length).map(p => [p.partId, p]));
  const fields = [...NUMBER_FIELDS, ...ID_FIELDS].filter(field => row?.[field] != null && row[field] !== '');
  const reject = (code: MergeRejection['code'], detail: string, label = '') => ({rejection:{code,detail,questionNumber:label}});
  if (!fields.length) return reject('missing_identity', 'No question_number or part_id was returned.');
  let selected: PlannedPart | undefined;
  for (const field of fields) {
    const value = identityValue(row[field]);
    if (!value) return reject('invalid_identity', `The ${field} field is not an explicit supported identity.`);
    // Some models put the exact immutable plan ID in question_number. Its
    // lookup remains exact and case-sensitive, just like a part_id field.
    const part = ID_FIELDS.some(id => id === field) ? ids.get(value) : numbers.get(plannedPartKey(value)) ?? ids.get(value);
    if (!part) return reject('unplanned_part', `${field} does not identify any saved part.`, safeLabel(value));
    if (selected && selected !== part) return reject('conflicting_identity', 'Populated number/part ID fields identify different saved parts.', selected.questionNumber);
    selected = part;
  }
  return {part:selected};
}

/** Public plan identities only; no text, resources or private keys in feedback. */
export function batchIdentityInstructions(batch: readonly PlannedPart[], previous: readonly MergeRejection[] = []): string {
  const mapping = batch.map(p => ({part_id:p.partId,question_number:p.questionNumber,marks:p.marks}));
  const feedback = [...new Map(previous.map(r => [JSON.stringify(r),r])).values()].slice(0,10);
  return [
    'SAVED PART IDENTITY MAP: Return one row for each listed identity with both part_id and question_number copied exactly. Never number subparts as standalone questions or choose a slot by position. These rows still need every task, resource and private key requested above.',
    JSON.stringify(mapping),
    ...(feedback.length ? ['PREVIOUS IDENTITY REJECTIONS: The last response did not match the requested identities. Correct the fields using the map; retain the full required tasks, resources and marking material. Do not repeat the rejected numbering.',
      JSON.stringify(feedback.map(r => ({question_number:r.questionNumber,code:r.code,detail:r.detail})))] : []),
  ].join('\n');
}

export function batchIdentityDiagnostic(batch: readonly PlannedPart[], rejections: readonly MergeRejection[]): string {
  return `Expected question_number: ${batch.map(p => p.questionNumber).join(', ')}. Identity rejections: `+
    rejections.slice(0,6).map(r => `${r.questionNumber || '<missing>'} ${r.code}: ${r.detail}`).join('; ');
}

/**
 * Accept only rows the batch actually asked for. A repeated identity never
 * overwrites an accepted part, and a row outside the batch is refused rather
 * than quietly replacing planned work from another response.
 */
export function mergeBatchRows(
  produced: Map<string, any>,
  rows: readonly any[],
  batch: readonly PlannedPart[],
  plan: PaperPlan,
): { added: number; rejections: MergeRejection[] } {
  const wanted = new Set(batch.map(p => plannedPartKey(p.questionNumber)));
  const rejections: MergeRejection[] = [];
  let added = 0;
  for (const row of rows) {
    const identity = resolveBatchPart(row, plan);
    if (identity.rejection) {rejections.push(identity.rejection);continue;}
    const part = identity.part!;
    const number = part.questionNumber;
    const key = plannedPartKey(number);
    if (produced.has(key)) {
      rejections.push({ questionNumber: number, code: 'duplicate_part', detail: 'An accepted part with this number already exists; the duplicate was discarded.' });
      continue;
    }
    if (!wanted.has(key)) {
      rejections.push({
        questionNumber: number,
        code: 'outside_batch',
        detail: 'Part belongs to another batch and was not requested in this response.',
      });
      continue;
    }
    const root = part.questionNumber.match(/^\d+/)?.[0];
    // The explicit model number already matches this authored part. Store its
    // exact plan label before any draft ID exists, so Q1 cannot sort after Q15
    // or lose its plan/resource requirements during repair. Never fill a gap
    // by assigning an unplanned row to a position.
    produced.set(key, {...row, question_number: part.questionNumber,
      ...(root ? {root_question_number: root, parent_question_number: row.parent_question_number == null ? null : root} : {})});
    added += 1;
  }
  return { added, rejections };
}

export const missingPlannedParts = (plan: PaperPlan, produced: Map<string, any>): PlannedPart[] =>
  plan.parts.filter(part => !produced.has(plannedPartKey(part.questionNumber)));

export const describeRejections = (items: readonly MergeRejection[]): string =>
  items.map(item => `Q${item.questionNumber || '?'}: ${item.code}`).join('; ');
