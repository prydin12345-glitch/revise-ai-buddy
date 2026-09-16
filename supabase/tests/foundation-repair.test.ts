// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { analyseGroupRepair } from '../functions/_shared/prepare-group-repair.ts';
import { buildQuestionRepairPrompt, requestQuestionRepair, saveQuestionRepairs } from '../functions/_shared/question-repair.ts';
import { biologyScopeInstructions, gcseBiologyIssue } from '../functions/_shared/gcse-biology-scope.ts';
import { chartIssues, coerceChart, resolveQuestionResources } from '../functions/_shared/question-resources.ts';

const scope = { subject: 'Biology Higher', educationalLevel: 'GCSE', examBoard: 'AQA', assessmentTier: 'foundation' as const };
const table = { type: 'data_table', headers: ['Time (min)', 'Gradient'], rows: [[0, 10], [30, 4]] };
const context = 'The concentration gradient decreased from 10 units to 4 units in 30 minutes.';
const broken = { id: 'draft-a', exam_id: 'exam-1', question_number: '1(a)', marks: 2, question_type: 'short_answer',
  question_text: context, correct_answer: '0.2 units per minute', diagram_config: table, root_question_number: '1' };
const healthy = { ...broken, id: 'draft-b', question_number: '1(b)', question_text: 'Explain why diffusion slows down.', correct_answer: 'The concentration gradient decreases.' };
const task = 'Calculate the mean decrease in concentration gradient per minute.';
const answer = '(10 - 4) / 30 = 0.2 units per minute';
const repair = { question_number: '1(a)', task, correct_answer: answer };
const input = { group: [broken, healthy], subject: scope.subject, scope, defects: 'missing_task', mode: 'task_only' as const, targetNumbers: new Set(['1(a)']) };
const response = (content: unknown, finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason, message: { content: JSON.stringify(content) } }] }), { status: 200 });

describe('independent command repairs preserve related questions', () => {
  it('accepts the target without requiring a healthy sibling to be rewritten', () => {
    const r = analyseGroupRepair([broken, healthy], [repair], scope, new Set(), input.targetNumbers);
    expect(r.ok).toBe(true);
    expect(Object.keys(r.replacements)).toEqual(['1(a)']);
    expect(r.replacements['1(a)'].question_text).toBe(context + '\n\n' + task);
    expect(r.replacements['1(a)'].diagram_config).toEqual(table);
    expect(r.replacements['1(a)'].correct_answer).toBe(answer);
  });
  it('accepts harmless question-number formatting variants', () => {
    const r = analyseGroupRepair([broken], [{ ...repair, question_number: 'Q01a' }], scope, new Set(), input.targetNumbers);
    expect(r.ok).toBe(true);
    expect(r.replacements['1(a)'].id).toBe('draft-a');
  });
  it('ignores unsolicited edits to healthy siblings', () => {
    const r = analyseGroupRepair([broken, healthy], [repair, { question_number: '1(b)', task: '', correct_answer: '' }], scope, new Set(), input.targetNumbers);
    expect(r.ok).toBe(true);
    expect(r.replacements['1(b)']).toBeUndefined();
  });
  it('keeps decimal question numbers distinct from whole question numbers', () => {
    const rows = [{ ...broken, question_number: '1.1' }, { ...healthy, question_number: '11' }];
    const r = analyseGroupRepair(rows, [{ ...repair, question_number: '1.1' }], scope, new Set(), new Set(['1.1']));
    expect(r.ok).toBe(true);
    expect(Object.keys(r.replacements)).toEqual(['1.1']);
  });
  it('keeps an independent successful fix when another target still fails', async () => {
    const second = { ...broken, id: 'draft-c', question_number: '1(c)' };
    const result = await requestQuestionRepair({ ...input, group: [broken, second], targetNumbers: new Set(['1(a)', '1(c)']) },
      'test-key', vi.fn().mockResolvedValue(response({ parts: [repair, { ...repair, question_number: '1(c)', task: 'The table shows data.' }] })));
    expect(result.phase).toBe('partial');
    expect(Object.keys(result.replacements)).toEqual(['1(a)']);
    expect(result.diagnostics[0]).toMatchObject({ code: 'missing_task', partNumber: '1(c)' });
  });
  it('rejects a background-only task with an explicit diagnostic', () => {
    const r = analyseGroupRepair([broken], [{ ...repair, task: 'The table shows the experiment.' }], scope, new Set(), input.targetNumbers);
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]).toMatchObject({ code: 'missing_task', partNumber: '1(a)' });
  });
  it('does not count an instruction hidden in context as the separate task', () => {
    const r = analyseGroupRepair([broken], [{ ...repair, task: '', context: task }], scope);
    expect(r.diagnostics[0].code).toBe('missing_task');
  });
  it('reports a missing rewritten answer and returns no partial repairs', () => {
    const r = analyseGroupRepair([broken], [{ ...repair, correct_answer: '' }], scope, new Set(), input.targetNumbers);
    expect(r.diagnostics[0].code).toBe('missing_answer');
    expect(r.replacements).toEqual({});
  });
  it('refuses changes to measurements during task-only repair', () => {
    for (const changed of [{ context: 'It took 3 minutes.' }, { diagram_config: { ...table, rows: [[0, 99], [30, 4]] } }]) {
      const r = analyseGroupRepair([broken], [{ ...repair, ...changed }], scope, new Set(), input.targetNumbers);
      expect(r.diagnostics[0].code).toBe('source_changed');
    }
  });
  it('detects duplicate targets rather than choosing one response', () => {
    const r = analyseGroupRepair([broken], [repair, { ...repair, question_number: '01(a)' }], scope, new Set(), input.targetNumbers);
    expect(r.diagnostics.some(d => d.code === 'duplicate_part')).toBe(true);
    expect(r.replacements).toEqual({});
  });
  it('requires all siblings when resources or context are regenerated', () => {
    const fixed = { ...repair, context, diagram_config: table };
    const r = analyseGroupRepair([broken, healthy], [fixed], scope, new Set(), input.targetNumbers, 'full_group');
    expect(r.diagnostics.some(d => d.code === 'missing_part' && d.partNumber === '1(b)')).toBe(true);
  });
  it('accepts a complete group including its legitimate unmarked parent', () => {
    const parent = { id: 'parent', question_number: '1', question_text: 'An experiment investigated diffusion.', marks: 0 };
    const r = analyseGroupRepair([parent, broken], [{ question_number: '1', context: parent.question_text }, { ...repair, context, diagram_config: table }], scope);
    expect(r.ok).toBe(true);
    expect(r.replacements['1'].marks).toBe(0);
  });
});

describe('Foundation scope is carried through repair', () => {
  it('uses the saved tier despite a subject name containing Higher', () => {
    const prompt = buildQuestionRepairPrompt(input);
    expect(prompt).toContain('ASSESSMENT TIER: Foundation');
    expect(prompt).not.toContain('ASSESSMENT TIER: Higher');
    expect(prompt).toContain('Foundation content');
  });
  it('rejects AQA Higher-only content in Foundation but retains it for Higher', () => {
    const q = { question_text: 'Describe how monoclonal antibodies are produced.' };
    expect(gcseBiologyIssue(q, scope)).toContain('Higher-only');
    expect(gcseBiologyIssue(q, { ...scope, assessmentTier: 'higher' })).toBeNull();
  });
  it('also checks private keys and preserves shared-tier material', () => {
    expect(gcseBiologyIssue({ correct_answer: 'Use the inverse square law.' }, scope)).toContain('Higher-only');
    expect(gcseBiologyIssue({ question_text: 'Explain how light intensity affects photosynthesis.' }, scope)).toBeNull();
  });
  it('does not export the AQA-specific restrictions into other courses', () => {
    expect(biologyScopeInstructions({ ...scope, examBoard: 'OCR' })).not.toContain('AQA GCSE Biology Foundation:');
    expect(biologyScopeInstructions({ subject: 'History', educationalLevel: 'A Level' })).not.toContain('Foundation');
  });
});

describe('transport, validation and saving are separate outcomes', () => {
  it('reports why an HTTP-success response was rejected', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ parts: [{ ...repair, task: 'The experiment lasted 30 minutes.' }] }));
    const r = await requestQuestionRepair(input, 'test-key', fetcher);
    expect(r.phase).toBe('validation');
    expect(r.diagnostics[0].code).toBe('missing_task');
  });
  it('passes rejection reasons into the next prompt without exposing answer keys', () => {
    const prompt = buildQuestionRepairPrompt({ ...input, previousDiagnostics: [{ code: 'missing_task', partNumber: '1(a)', detail: 'A separate instruction is required.' }] });
    expect(prompt).toContain('Previous response was rejected: Q1(a): missing_task');
  });
  it('distinguishes a truncated response from invalid JSON', async () => {
    const truncated = await requestQuestionRepair(input, 'test-key', vi.fn().mockResolvedValue(response({}, 'length')));
    expect(truncated.diagnostics[0].code).toBe('incomplete_response');
    const invalid = await requestQuestionRepair(input, 'test-key', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{broken' } }] }))));
    expect(invalid.diagnostics[0].code).toBe('invalid_json');
  });
  it('reports transport failures without returning provider bodies or credentials', async () => {
    const failed = await requestQuestionRepair(input, 'secret-test-key', vi.fn().mockResolvedValue(new Response('secret provider text', { status: 429 })));
    expect(failed.phase).toBe('transport');
    expect(JSON.stringify(failed)).not.toContain('secret');
    const thrown = await requestQuestionRepair(input, 'key', vi.fn().mockRejectedValue(new Error('private network details')));
    expect(thrown.diagnostics[0].code).toBe('request_failed');
  });
  const db = (data: any, error: any = null) => {
    const query: any = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
    for (const method of ['update', 'eq', 'select']) query[method].mockReturnValue(query);
    return { client: { from: vi.fn().mockReturnValue(query) }, query };
  };
  it('confirms an accepted task was written under the expected exam and row', async () => {
    const accepted = await requestQuestionRepair(input, 'test-key', vi.fn().mockResolvedValue(response({ parts: [repair] })));
    expect(accepted.phase).toBe('accepted');
    const { client, query } = db({ id: broken.id });
    expect(await saveQuestionRepairs(client, 'exam-1', [broken, healthy], accepted.replacements)).toBe(1);
    expect(query.eq).toHaveBeenCalledWith('id', 'draft-a');
    expect(query.eq).toHaveBeenCalledWith('exam_id', 'exam-1');
    expect(query.update.mock.calls[0][0]).toMatchObject({ question_text: context + '\n\n' + task, correct_answer: answer, diagram_config: table });
  });
  it('fails if an accepted repair matches no row or the database rejects it', async () => {
    const accepted = analyseGroupRepair([broken], [repair], scope, new Set(), input.targetNumbers);
    await expect(saveQuestionRepairs(db(null).client, 'exam-1', [broken], accepted.replacements)).rejects.toThrow('no matching draft row');
    await expect(saveQuestionRepairs(db(null, { message: 'private DB error' }).client, 'exam-1', [broken], accepted.replacements)).rejects.toThrow('database write rejected');
  });
});

describe('chart normalisation never hides contradictory measurements', () => {
  const line = (data: any[]) => ({ type: 'line_chart', datasets: [{ label: 'Rate', data }] });
  it('keeps conflicting readings so the gate can reject them even with other points', () => {
    const chart = line([{ x: 0, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 9 }, { x: 2, y: 4 }]);
    expect((coerceChart(chart).chart as any).datasets[0].data).toHaveLength(4);
    expect(chartIssues(chart).length).toBeGreaterThan(0);
  });
  it('coerces numeric strings and removes only an identical duplicate', () => {
    const chart = line([{ x: '0', y: '2' }, { x: 0, y: 2 }, { x: '2', y: '4' }]);
    expect(chartIssues(chart)).toEqual([]);
    expect(resolveQuestionResources({ diagram_config: chart }).chart.datasets[0].data).toEqual([{ x: 0, y: 2 }, { x: 2, y: 4 }]);
  });
  it('rejects numeric strings that overflow to infinity', () => {
    expect(chartIssues(line([{ x: '1e999', y: '2' }, { x: 2, y: 4 }])).length).toBeGreaterThan(0);
  });
});
