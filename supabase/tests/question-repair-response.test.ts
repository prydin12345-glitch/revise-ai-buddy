// @vitest-environment node
import {describe, expect, it, vi} from 'vitest';
import {buildQuestionRepairPrompt, requestQuestionRepair} from '../functions/_shared/question-repair';
import {biologyScopeFromContext} from '../functions/_shared/gcse-biology-scope';
import {ocrPaper2Fixture} from './ocr-alevel-paper2-fixtures';

const fixture = ocrPaper2Fixture();
const q8 = fixture.rows[7];
const context = 'A researcher recorded plant species richness at different sampling areas.';
const original = {...q8, question_text: context};
const repair = {question_number: '8', task: q8.question_text, correct_answer: q8.correct_answer};
const input = {group: [original], subject: 'Biology', scope: biologyScopeFromContext(fixture.snapshot),
  plan: fixture.plan, defects: 'Q8: missing_task', mode: 'task_only' as const, targetNumbers: new Set(['8'])};

const response = (content: unknown) => new Response(JSON.stringify({choices: [{finish_reason: 'stop',
  message: {content: JSON.stringify(content)}}]}));
const request = (content: unknown) => requestQuestionRepair(input, 'test-only-key', vi.fn().mockResolvedValue(response(content)));

describe('repair response envelopes preserve the numbered content before validation', () => {
  it.each([
    ['parts array', {parts: [repair]}],
    ['questions array', {questions: [repair]}],
    ['direct array', [repair]],
    ['single numbered part', repair],
    ['single numbered parts entry', {parts: repair}],
    ['single numbered questions entry', {questions: repair}],
  ])('accepts a complete %s without replacing Q8 data or choices', async (_name, content) => {
    const before = structuredClone(original);
    const result = await request(content);
    expect(result.phase).toBe('accepted');
    expect(result.diagnostics).toEqual([]);
    expect(Object.keys(result.replacements)).toEqual(['8']);
    expect(result.replacements['8']).toMatchObject({id: q8.id, marks: 1, options: q8.options,
      diagram_config: q8.diagram_config, question_text: context + '\n\n' + repair.task,
      correct_answer: repair.correct_answer});
    expect(original).toEqual(before);
  });

  it.each([
    ['context only', {...repair, task: context}, 'missing_task'],
    ['missing key', {...repair, correct_answer: ''}, 'missing_answer'],
    ['invalid MCQ key', {...repair, correct_answer: 'Five species'}, 'answer_mismatch'],
    ['changed choices', {...repair, options: ['Five species', 'Six species', 'Seven species', 'Eight species']}, 'source_changed'],
    ['changed source', {...repair, context: 'The observations were made in another habitat.'}, 'source_changed'],
    ['changed graph', {...repair, diagram_config: {...q8.diagram_config, datasets: []}}, 'source_changed'],
    ['Paper 1 recall', {...repair, task: 'Explain the Calvin cycle.'}, 'out_of_level'],
    ['unknown part', {...repair, question_number: '9'}, 'unknown_part'],
  ])('rejects a single numbered object with %s', async (_name, content, code) => {
    const result = await request(content);
    expect(result.ok).toBe(false);
    expect(result.replacements).toEqual({});
    expect(result.diagnostics.some(d => d.code === code)).toBe(true);
  });

  it.each([
    ['absent number', {task: repair.task, correct_answer: repair.correct_answer}],
    ['empty parts', {parts: []}],
    ['empty array', []],
    ['non-object entry', {parts: 'PRIVATE PROVIDER CONTENT'}],
    ['nested unrecognised wrapper', {output: {parts: [repair]}}],
    ['primitive', 'PRIVATE PROVIDER CONTENT'],
    ['null', null],
  ])('does not guess or fabricate repairs for %s', async (_name, content) => {
    const result = await request(content);
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('parse');
    expect(result.diagnostics[0].code).toBe('invalid_response_shape');
    expect(result.replacements).toEqual({});
    expect(JSON.stringify(result)).not.toContain('PRIVATE PROVIDER CONTENT');
    expect(result.diagnostics[0].detail).toContain('parts');
  });

  it('rejects competing containers instead of silently selecting or dropping returned parts', async () => {
    const result = await request({parts: [], questions: [repair]});
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('ambiguous_response_shape');
  });

  it('still requires every sibling for a complete rewrite', async () => {
    const result = await requestQuestionRepair({...input, mode: 'full_group', group: [original, fixture.rows[8]]},
      'test-only-key', vi.fn().mockResolvedValue(response({...q8, task: q8.question_text})));
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({code: 'missing_part', partNumber: '9'}));
    expect(result.replacements).toEqual({});
  });

  it('does not assign a single returned repair to another missing task', async () => {
    const sibling = {...fixture.rows[8], question_text: 'Three sampling methods were considered.'};
    const result = await requestQuestionRepair({...input, group: [original, sibling], targetNumbers: new Set(['8', '9'])},
      'test-only-key', vi.fn().mockResolvedValue(response(repair)));
    expect(result.phase).toBe('partial');
    expect(Object.keys(result.replacements)).toEqual(['8']);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({code: 'missing_part', partNumber: '9'}));
    expect(sibling.question_text).toBe('Three sampling methods were considered.');
  });

  it('requests the array envelope even for one target and uses the target in its example', () => {
    const prompt = buildQuestionRepairPrompt({...input, group: [fixture.rows[6], original]});
    expect(prompt).toContain('OUTPUT ENVELOPE:');
    expect(prompt).toContain('even for one target');
    expect(prompt).toContain('Each entry');
    expect(JSON.parse(prompt.split('Return JSON only: ')[1]).parts[0].question_number).toBe('8');
    expect(prompt).not.toContain('Return ONLY question_number, task and correct_answer');
  });
});
