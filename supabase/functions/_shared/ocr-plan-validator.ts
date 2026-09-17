import { OCR_GATEWAY_BIOLOGY_ID } from './assessment-tier.ts';
import type { PaperPlan } from './biology-paper-contract.ts';
import type { CandidatePart, QuestionDefect } from './question-contract-validator.ts';
import { resolveQuestionResources } from './question-resources.ts';

export const canonicalPartNumber = (value: unknown): string => {
  const text = String(value ?? '').trim().replace(/^Q\s*/i, '');
  const match = text.match(/^(\d+)\s*(?:\(?([a-z])\)?)?$/i);
  return match ? `${Number(match[1])}${match[2] ? `(${match[2].toLowerCase()})` : ''}` : text;
};
/** Structural checks only: live scientific accuracy still needs a paper audit. */
export function validateGatewayPlan(rows: CandidatePart[], plan?: PaperPlan | null): QuestionDefect[] {
  if (plan?.courseId !== OCR_GATEWAY_BIOLOGY_ID) return [];
  const defects: QuestionDefect[] = [];
  const byNumber = new Map(plan.parts.map(p => [canonicalPartNumber(p.questionNumber), p]));
  const seen = new Set<string>();
  for (const row of rows) {
    const number = canonicalPartNumber(row.question_number);
    const expected = byNumber.get(number);
    const push = (detail: string, code: QuestionDefect['code'] = 'plan_mismatch') => defects.push({partId: String(row.id ?? row.question_number ?? 'paper'),
      parentId: row.root_question_number ?? row.parent_question_number ?? null, code, detail});
    if (!expected || seen.has(number)) { push(`Unexpected or duplicate scored row ${number}; do not silently renumber or discard it.`); continue; }
    seen.add(number);
    if (Number(row.marks) !== expected.marks) push(`Q${number} requires ${expected.marks} marks and a matching scheme.`);
    const isMcq = /^(mcq|mcq_single|multiple.choice)$/.test(String(row.question_type));
    if (isMcq !== (expected.responseType === 'mcq_single')) push(`Q${number} must be ${expected.responseType}.`);
    if (expected.responseType === 'mcq_single') {
      const options = coerceMcqOptions(row) ?? [];
      const values = options.map(o => o.trim().toLowerCase());
      if (options.length !== 4 || new Set(values).size !== 4 || values.some(v => !v)) push('OCR Section A requires four distinct choices A–D.', 'invalid_options');
    }

    const resources = resolveQuestionResources(row);
    if (expected.resource === 'data_table' && !resources.table) push(`Q${number} requires the planned data table.`, "missing_required_resource");
    if (expected.resource === 'graph' && (!resources.chart || resources.chart.type === 'data_table')) push(`Q${number} requires the planned graph.`, "missing_required_resource");
    if (expected.marks === 6) {
      const key = typeof row.correct_answer === 'string' ? row.correct_answer : JSON.stringify(row.correct_answer ?? '');
      if (![1, 2, 3].every(level => new RegExp(`level\\s*${level}`, 'i').test(key))) push(`Q${number} requires a private three-level response scheme, not only a model answer.`, "missing_answer");
    }
  }
  for (const [number] of byNumber) if (!seen.has(number)) defects.push({partId: 'paper', parentId: null,
    code: 'plan_mismatch', detail: `Planned Q${number} is missing. Generate a fresh draft; a different question cannot be relabelled to fill it.`});
  return defects;
}
