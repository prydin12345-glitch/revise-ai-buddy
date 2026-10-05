// @vitest-environment node
import {expect, it} from 'vitest';
import {extract, boundaryHandler} from './aqa-alevel-runtime';
import {ocrPaper2Fixture} from './ocr-alevel-paper2-fixtures';

const context = "20 eyepiece units measured 150 micrometres (µm) with a ×10 objective lens, and the cell's diameter was 8 eyepiece units.";
const task = "If 20 eyepiece units measured 150 micrometres (µm) with a ×10 objective lens, and the cell's diameter was 8 eyepiece units, what is the cell's actual diameter in micrometres?";
const options = ['6 micrometres', '60 micrometres', '120 micrometres', '600 micrometres'];
const mutateQ1 = (rows: any[], text: string) => Object.assign(rows[0], {question_number: 'Q1', root_question_number: 'Q1', parent_question_number: 'Q1',
  question_text: text, options, correct_answer: options[1]});

it('accepts an explicit conditional MCQ during generation without spending a repair call', async () => {
  const fixture = ocrPaper2Fixture();
  const result = await extract({mutate(rows) {mutateQ1(rows, task);}}, 'full_mock', 'paper_2', fixture);
  expect(String(result.error ?? '')).toBe('');
  expect(result.repairCalls).toHaveLength(0);
  expect(result.exam.extraction_status).toBe('completed');
  expect(result.drafts.map(q => q.question_number)).toEqual(fixture.plan.parts.map(p => p.questionNumber));
  expect(result.drafts[0]).toMatchObject({question_number: '1', root_question_number: '1', parent_question_number: '1', marks: 1,
    question_text: task, options, correct_answer: options[1]});
  expect(result.drafts.filter(q => q.question_type === 'mcq')).toHaveLength(15);
  expect(result.drafts.reduce((sum, q) => sum + q.marks, 0)).toBe(100);
  const boundary = await boundaryHandler('publish-exam', result.drafts, 'full_mock', 'paper_2', fixture.snapshot);
  expect((await boundary.run({draftId: 'exam'})).status).toBe(200);
});

it('repairs contextual Q1 with a valid conditional instruction in one call', async () => {
  const fixture = ocrPaper2Fixture();
  const result = await extract({mutate(rows) {mutateQ1(rows, context);},
    repair() {return {parts: [{question_number: 'Q1', task, correct_answer: options[1]}]};}}, 'full_mock', 'paper_2', fixture);
  expect(String(result.error ?? '')).toBe('');
  expect(result.repairCalls).toHaveLength(1);
  expect(result.exam.extraction_status).toBe('completed');
  expect(result.drafts[0]).toMatchObject({question_number: '1', marks: 1, question_text: context + '\n\n' + task, options, correct_answer: options[1]});
  expect(result.aiCalls.length).toBeLessThanOrEqual(26);
});

it('retains the repair limit and missing-task gate when the conditional response has no instruction', async () => {
  const fixture = ocrPaper2Fixture();
  const result = await extract({mutate(rows) {mutateQ1(rows, context);},
    repair() {return {parts: [{question_number: 'Q1', task: 'If ' + context, correct_answer: options[1]}]};}}, 'full_mock', 'paper_2', fixture);
  expect(result.error).toBeTruthy();
  expect(String(result.error)).toContain('missing_task');
  expect(String(result.error)).not.toContain('QQ1');
  expect(result.repairCalls).toHaveLength(3);
  expect(result.exam.extraction_status).toBe('failed');
});

it('does not accept a conditional command with an answer that matches no choice', async () => {
  const fixture = ocrPaper2Fixture();
  const result = await extract({mutate(rows) {mutateQ1(rows, context);},
    repair() {return {parts: [{question_number: 'Q1', task, correct_answer: '99 micrometres'}]};}}, 'full_mock', 'paper_2', fixture);
  expect(result.error).toBeTruthy();
  expect(String(result.error)).toContain('answer_mismatch');
  expect(result.repairCalls).toHaveLength(3);
  expect(result.exam.extraction_status).toBe('failed');
});
