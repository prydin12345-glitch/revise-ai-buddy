import { parseResponseDefinition, parseResponseEnvelope, parsePrivateResponseKey, type ResponseDefinition, type ResponseEnvelope, type PrivateResponseKey } from './response-contract.ts';

export type ResponseUnitResult = { unitId: string; targetIds: string[]; score: number; maxMarks: number; feedback: string };
export type ResponseMarkResult = { version: 1; definitionRevision: string; score: number; maxMarks: number; isCorrect: boolean; feedback: string; units: ResponseUnitResult[] };
export type RubricRequest = { unitId: string; maxMarks: number; guidance: string; answers: Record<string, string> };
export type RubricMarker = (units: RubricRequest[]) => Promise<unknown>;

export function emptyResponse(definition: ResponseDefinition, questionId: string): ResponseEnvelope {
  const base = { version: 1 as const, questionId, definitionRevision: definition.revision };
  switch (definition.kind) {
    case 'text': return { ...base, kind: 'text', value: { text: '', working: '' } };
    case 'choice': return { ...base, kind: 'choice', value: { selectedIds: [] } };
    case 'grid': return { ...base, kind: 'grid', value: { rows: {} } };
    default: return { ...base, kind: definition.kind, value: { fields: {} } };
  }
}

const normalise = (value: string, caseSensitive = false): string => {
  const text = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return caseSensitive ? text : text.toLocaleLowerCase('en-GB');
};
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));

/** One result per scored question. Exact rules never call a model. */
export async function markResponse(input: {
  questionId: string; marks: number; definition: unknown; key: unknown; response: unknown;
}, markRubrics: RubricMarker): Promise<ResponseMarkResult> {
  const definition = parseResponseDefinition(input.definition);
  const key = parsePrivateResponseKey(input.key, definition, input.marks);
  const response = input.response == null ? emptyResponse(definition, input.questionId)
    : parseResponseEnvelope(input.response, definition, input.questionId);
  const rubricRequests: RubricRequest[] = [];
  const units: ResponseUnitResult[] = key.units.map(unit => {
    let correct = false;
    const target = unit.targetIds[0];
    const fieldValue = response.kind === 'fields' || response.kind === 'cloze' ? response.value.fields[target] ?? '' : '';
    switch (unit.rule.kind) {
      case 'exact_set': {
        const selected = response.kind === 'choice' ? response.value.selectedIds
          : response.kind === 'grid' ? response.value.rows[target] : undefined;
        // An untouched row never earns an empty-set mark by accident.
        correct = selected !== undefined && sameSet(selected, unit.rule.expectedIds);
        break;
      }
      case 'text': {
        const rule = unit.rule;
        const field = definition.kind === 'fields' || definition.kind === 'cloze' ? definition.fields.find(f => f.id === target) : undefined;
        // Dropdown values are stable identifiers, not case-insensitive words.
        correct = field?.input === 'select' ? rule.accepted.includes(fieldValue)
          : Boolean(fieldValue.trim()) && rule.accepted.some(expected => normalise(expected, rule.caseSensitive) === normalise(fieldValue, rule.caseSensitive));
        break;
      }
      case 'number': correct = Boolean(fieldValue.trim()) && Number.isFinite(Number(fieldValue)) && Math.abs(Number(fieldValue) - unit.rule.expected) <= unit.rule.tolerance + Number.EPSILON * Math.max(1, Math.abs(unit.rule.expected)); break;
      case 'rubric': {
        const answers = Object.fromEntries(unit.targetIds.map(id => [id, response.kind === 'text'
          ? [response.value.working, response.value.text].filter(Boolean).join('\n')
          : response.kind === 'fields' || response.kind === 'cloze' ? response.value.fields[id] ?? '' : '']));
        if (Object.values(answers).some(value => value.trim())) rubricRequests.push({ unitId: unit.id, maxMarks: unit.marks, guidance: unit.rule.guidance, answers });
        break;
      }
    }
    return { unitId: unit.id, targetIds: unit.targetIds, score: correct ? unit.marks : 0, maxMarks: unit.marks, feedback: correct ? 'Correct.' : 'No marks awarded for this part.' };
  });
  if (rubricRequests.length) {
    const raw: any = await markRubrics(rubricRequests);
    if (!raw || !Array.isArray(raw.units) || raw.units.length !== rubricRequests.length) throw new Error('Incomplete structured marking response');
    const seen = new Set<string>();
    for (const result of raw.units) {
      const request = rubricRequests.find(unit => unit.unitId === result?.unitId);
      if (!request || seen.has(result.unitId) || typeof result.score !== 'number' || !Number.isFinite(result.score) || result.score < 0 || result.score > request.maxMarks || typeof result.feedback !== 'string' || !result.feedback.trim() || result.feedback.length > 6000) throw new Error('Invalid structured marking result');
      seen.add(result.unitId);
      Object.assign(units.find(unit => unit.unitId === result.unitId)!, { score: result.score, feedback: result.feedback });
    }
  }
  const score = units.reduce((sum, unit) => sum + unit.score, 0);
  return { version: 1, definitionRevision: definition.revision, score, maxMarks: key.maxMarks, isCorrect: score === key.maxMarks, feedback: `${score}/${key.maxMarks} marks.`, units };
}

/** Validate persisted results too; malformed grades must never become zero. */
export function parseResponseResult(value: unknown, definition: ResponseDefinition, key: PrivateResponseKey): ResponseMarkResult {
  const v = value as ResponseMarkResult;
  if (!v || v.version !== 1 || v.definitionRevision !== definition.revision || v.maxMarks !== key.maxMarks || !Array.isArray(v.units) || v.units.length !== key.units.length || !Number.isFinite(v.score) || v.score < 0 || v.score > key.maxMarks || typeof v.feedback !== 'string') throw new Error('Invalid stored response result');
  const seen = new Set<string>();
  for (const unit of v.units) {
    const expected = key.units.find(x => x.id === unit.unitId);
    if (!expected || seen.has(unit.unitId) || unit.maxMarks !== expected.marks || !Number.isFinite(unit.score) || unit.score < 0 || unit.score > expected.marks || !sameSet(unit.targetIds, expected.targetIds) || typeof unit.feedback !== 'string') throw new Error('Invalid stored marking unit');
    seen.add(unit.unitId);
  }
  if (Math.abs(v.units.reduce((sum, unit) => sum + unit.score, 0) - v.score) > 1e-8 || v.isCorrect !== (v.score === v.maxMarks)) throw new Error('Stored response marks do not add up');
  return v;
}
