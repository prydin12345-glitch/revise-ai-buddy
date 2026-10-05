// @vitest-environment node
import {describe, expect, it, vi} from 'vitest';
import {hasAssessedTask, describeDefects} from '../functions/_shared/question-contract-validator';
import {requestQuestionRepair, buildQuestionRepairPrompt, describeRepairDiagnostics} from '../functions/_shared/question-repair';
import {biologyScopeFromContext} from '../functions/_shared/gcse-biology-scope';
import {ocrPaper2Fixture} from './ocr-alevel-paper2-fixtures';

// The report truncates at 120 characters. This continuation is a synthetic
// complete task, not a claim about the unseen original response.
export const calibrationContext = "20 eyepiece units measured 150 micrometres (µm) with a ×10 objective lens, and the cell's diameter was 8 eyepiece units.";
export const calibrationTask = "If 20 eyepiece units measured 150 micrometres (µm) with a ×10 objective lens, and the cell's diameter was 8 eyepiece units, what is the cell's actual diameter in micrometres?";
export const calibrationOptions = ['6 micrometres', '60 micrometres', '120 micrometres', '600 micrometres'];

describe('conditional assessed instructions', () => {
  it.each([
    calibrationTask,
    calibrationTask.replace('what is', 'calculate'),
    calibrationTask.replace('If ', 'Given that '),
    calibrationTask.replace('If ', 'Assuming that '),
    calibrationTask.replace('what is', 'now briefly calculate'),
    "If a rectangular quadrat has sides of 0.5 m and 0.5 m, and each quadrat contains an average of 12 plants, calculate the estimated number of plants in a 50 m² habitat.",
  ])('accepts a real directive after a multi-clause premise: %s', task => {
    expect(hasAssessedTask(task)).toBe(true);
  });

  it.each([
    calibrationTask.slice(0, 120),
    'If ' + calibrationContext,
    calibrationTask.replace("what is the cell's actual diameter in micrometres?", 'the researcher recorded the observations.'),
    calibrationTask.replace("what is the cell's actual diameter in micrometres?", 'the researchers calculate the diameter.'),
    'If the samples have different temperatures, the enzyme activities may differ?',
  ])('still blocks context or reported activity without a directive: %s', task => {
    expect(hasAssessedTask(task)).toBe(false);
  });
});

describe('repair matches stored Q1 to the same authored plan part', () => {
  const fixture = ocrPaper2Fixture();
  const original = {...fixture.rows[0], question_number: 'Q1', root_question_number: 'Q1', parent_question_number: 'Q1',
    question_text: calibrationContext, options: calibrationOptions, correct_answer: calibrationOptions[1]};
  const input = {group: [original], subject: 'Biology', scope: biologyScopeFromContext(fixture.snapshot),
    plan: fixture.plan, defects: 'missing_task', mode: 'task_only' as const, targetNumbers: new Set(['Q1'])};
  const response = (part: unknown) => new Response(JSON.stringify({choices: [{finish_reason: 'stop', message: {content: JSON.stringify({parts: [part]})}}]}));

  it.each([calibrationTask, 'Calculate the actual cell diameter in micrometres.'])('accepts and validates the same explicit Q1 identity: %s', async task => {
    const result = await requestQuestionRepair(input, 'test-only', vi.fn().mockResolvedValue(response({question_number: '1', task, correct_answer: calibrationOptions[1]})));
    expect(result.phase).toBe('accepted');
    expect(Object.keys(result.replacements)).toEqual(['Q1']);
    expect(result.replacements.Q1).toMatchObject({id: original.id, question_number: 'Q1', marks: 1, options: calibrationOptions,
      question_text: calibrationContext + '\n\n' + task, correct_answer: calibrationOptions[1]});
  });

  it('includes Q1 outcome and source requirements in the prompt without doubling Q', () => {
    const prompt = buildQuestionRepairPrompt({...input, mode: 'full_group'});
    expect(prompt).toContain('2.1.1:');
    expect(prompt).toContain('planned resource=none');
    expect(prompt).not.toContain('QQ1');
    expect(JSON.parse(prompt.split('Return JSON only: ')[1]).parts[0].question_number).toBe('Q1');
  });

  it('prints each question label once while preserving the draft identity', () => {
    const defect = {partId: original.id, parentId: 'Q1', code: 'missing_task' as const, detail: 'No instruction.'};
    expect(describeDefects([defect], [original])).toBe(`Q1 [${original.id}]: missing_task — No instruction.`);
    expect(describeRepairDiagnostics([{code: 'missing_task', partNumber: 'Q1', detail: 'No instruction.'}])).toBe('Q1: missing_task (No instruction.)');
  });
});
