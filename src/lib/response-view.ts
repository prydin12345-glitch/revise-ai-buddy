import { parseResponseEnvelope, type ResponseDefinition, type ResponseEnvelope, type PrivateResponseKey } from './response-contract';
import type { ResponseMarkResult, ResponseResource } from './response-marking';
export interface ResponseQuestionView {
  id: string;
  response_definition?: ResponseDefinition;
  response_resources?: ResponseResource[];
  response_snapshot?: { response: ResponseEnvelope | null; revision: number };
  /** Only included by the server after its release/manager check. */
  response_key?: PrivateResponseKey;
  response_result?: ResponseMarkResult;
}
export function readResponseAnswer(question: ResponseQuestionView, text?: string | null): ResponseEnvelope | null {
  if (!question.response_definition) return null;
  if (text) {
    try { return parseResponseEnvelope(JSON.parse(text), question.response_definition, question.id); }
    catch { throw new Error('The saved structured answer could not be read.'); }
  }
  return question.response_snapshot?.response ?? null;
}
export function responseTargetLabel(definition: ResponseDefinition, ids: string[]): string {
  if (definition.kind === 'grid') return ids.map(id => definition.rows.find(row => row.id === id)?.label ?? id).join(', ');
  if (definition.kind === 'fields' || definition.kind === 'cloze') return ids.map(id => definition.fields.find(field => field.id === id)?.label ?? id).join(', ');
  return 'Answer';
}
export function responseKeyLines(definition: ResponseDefinition, key: PrivateResponseKey): string[] {
  return key.units.map(unit => {
    const rule = unit.rule;
    let expected: string;
    if (rule.kind === 'exact_set') {
      const labels = definition.kind === 'choice' ? definition.options : definition.kind === 'grid' ? definition.columns : [];
      expected = rule.expectedIds.map(id => labels.find(label => label.id === id)?.label ?? id).join('; ') || 'No boxes selected';
    } else if (rule.kind === 'number') expected = `${rule.expected}${rule.tolerance ? ` (tolerance ${rule.tolerance})` : ''}`;
    else if (rule.kind === 'text') {
      const fields = definition.kind === 'cloze' || definition.kind === 'fields' ? definition.fields : [];
      const field = fields.find(f => f.id === unit.targetIds[0]);
      expected = rule.accepted.map(value => field?.input === 'select' ? field.options?.find(o => o.id === value)?.label ?? value : value).join(' / ');
    } else expected = rule.guidance;
    return `${responseTargetLabel(definition, unit.targetIds)}: ${expected} [${unit.marks} ${unit.marks === 1 ? 'mark' : 'marks'}]`;
  });
}
