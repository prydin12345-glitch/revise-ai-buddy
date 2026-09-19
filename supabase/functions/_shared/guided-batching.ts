// Guided Biology papers are written in bounded batches of whole parent groups.
// A single response cannot reliably carry 36 planned parts: it is cut off part
// way through, which used to surface as "Planned Q5(a) is missing". These
// helpers decide the batches, recover a truncated response and merge rows back
// under strict identity rules — nothing is ever renumbered to fill a gap.

import type { PaperPlan, PlannedPart } from './paper-contract-types.ts';

/** Canonical "5(a)" form so plan and model numbering compare reliably. */
export const plannedPartKey = (value: unknown): string => {
  const text = String(value ?? '').trim().replace(/^Q\s*/i, '');
  const match = text.match(/^(\d+)\s*[.\-]?\s*\(?([a-z])\)?$/i);
  return match ? `${Number(match[1])}(${match[2].toLowerCase()})` : text.toLowerCase();
};

/**
 * A response cut off mid-array is a partial transport, not a paper with missing
 * questions. Recover every syntactically complete question object — including
 * ones whose nested resources contain braces or escaped quotes — so the
 * completion pass only has to request the genuine remainder.
 */
export function salvageTruncatedQuestions(content: string): any[] {
  const start = content.indexOf('"questions"');
  if (start < 0) return [];
  const arrayStart = content.indexOf('[', start);
  if (arrayStart < 0) return [];
  const recovered: any[] = [];
  let depth = 0, objStart = -1, inString = false, escaped = false;
  for (let i = arrayStart; i < content.length; i++) {
    const ch = content[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { if (depth === 0) objStart = i; depth++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try { recovered.push(JSON.parse(content.slice(objStart, i + 1))); } catch { /* partial object */ }
        objStart = -1;
      }
      continue;
    }
    if (ch === ']' && depth === 0) break;
  }
  return recovered;
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
  code: 'duplicate_part' | 'outside_batch' | 'unplanned_part';
  detail: string;
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
  const planned = new Set(plan.parts.map(p => plannedPartKey(p.questionNumber)));
  const rejections: MergeRejection[] = [];
  let added = 0;
  for (const row of rows) {
    const number = String(row?.question_number ?? '');
    const key = plannedPartKey(number);
    if (produced.has(key)) {
      rejections.push({ questionNumber: number, code: 'duplicate_part', detail: 'An accepted part with this number already exists; the duplicate was discarded.' });
      continue;
    }
    if (!wanted.has(key)) {
      rejections.push({
        questionNumber: number,
        code: planned.has(key) ? 'outside_batch' : 'unplanned_part',
        detail: planned.has(key) ? 'Part belongs to another batch and was not requested in this response.' : 'Part is not in the saved paper plan.',
      });
      continue;
    }
    produced.set(key, row);
    added += 1;
  }
  return { added, rejections };
}

export const missingPlannedParts = (plan: PaperPlan, produced: Map<string, any>): PlannedPart[] =>
  plan.parts.filter(part => !produced.has(plannedPartKey(part.questionNumber)));

export const describeRejections = (items: readonly MergeRejection[]): string =>
  items.map(item => `Q${item.questionNumber || '?'}: ${item.code}`).join('; ');
