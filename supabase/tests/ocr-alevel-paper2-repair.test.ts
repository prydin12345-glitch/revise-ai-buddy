// @vitest-environment node
import {expect, it} from 'vitest';
import {extract, boundaryHandler} from './aqa-alevel-runtime';
import {ocrPaper2Fixture} from './ocr-alevel-paper2-fixtures';

const context = 'A researcher recorded plant species richness at different sampling areas.';

it('recovers the Q8 missing-task/response-shape failure in one repair and finalises all 100 marks', async () => {
  const fixture = ocrPaper2Fixture(), q8 = fixture.rows[7];
  const result = await extract({mutate(rows) {rows[7].question_text = context;},
    repair() {return {question_number: '8', task: q8.question_text, correct_answer: q8.correct_answer};}},
    'full_mock', 'paper_2', fixture);
  expect(String(result.error ?? '')).toBe('');
  expect(result.repairCalls).toHaveLength(1);
  expect(result.exam.extraction_status).toBe('completed');
  expect(result.drafts[7]).toMatchObject({question_number: '8', marks: 1, options: q8.options,
    diagram_config: q8.diagram_config, correct_answer: q8.correct_answer, question_text: context + '\n\n' + q8.question_text});
  expect(result.drafts.map(q => q.question_number)).toEqual(fixture.plan.parts.map(p => p.questionNumber));
  expect(result.drafts.filter(q => q.question_type === 'mcq')).toHaveLength(15);
  expect(result.drafts.reduce((total, q) => total + q.marks, 0)).toBe(100);
  expect(result.aiCalls.length).toBeLessThanOrEqual(26);
  const boundary = await boundaryHandler('publish-exam', result.drafts, 'full_mock', 'paper_2', fixture.snapshot);
  expect((await boundary.run({draftId: 'exam'})).status).toBe(200);
});

it('keeps the existing full-group escalation after an empty repair, accepting a complete numbered singleton', async () => {
  const fixture = ocrPaper2Fixture(), q8 = fixture.rows[7];
  let calls = 0;
  const result = await extract({mutate(rows) {rows[7].question_text = context;}, repair() {
    return ++calls === 1 ? {parts: []} : {parts: {...q8, task: q8.question_text}};
  }}, 'full_mock', 'paper_2', fixture);
  expect(String(result.error ?? '')).toBe('');
  expect(result.repairCalls).toHaveLength(2);
  const prompt = result.repairCalls[1].messages.map((m: any) => m.content).join('\n');
  expect(prompt).toContain('FULL-GROUP OUTPUT');
  expect(prompt).toContain('invalid_response_shape');
  expect(result.drafts[7].diagram_config).toEqual(q8.diagram_config);
  expect(result.drafts[7].options).toEqual(q8.options);
  expect(result.exam.extraction_status).toBe('completed');
});

it('never treats a numbered singleton as permission to omit the required Q8 graph', async () => {
  const fixture = ocrPaper2Fixture(), q8 = fixture.rows[7];
  const result = await extract({mutate(rows) {rows[7].question_text = context;},
    repair() {return {...q8, context: 'New biodiversity observations were recorded.', task: q8.question_text, diagram_config: null};}},
    'full_mock', 'paper_2', fixture);
  expect(result.error).toBeTruthy();
  expect(String(result.error)).toContain('missing_required_resource');
  expect(result.repairCalls).toHaveLength(3);
  expect(result.exam.extraction_status).toBe('failed');
  expect(result.drafts[7].question_text).toBe(context);
  expect(result.drafts[7].diagram_config).toEqual(q8.diagram_config);
});

it('preserves the latest full-group question_text recovery when an explicit task field is absent', async () => {
  const fixture = ocrPaper2Fixture(), q8 = fixture.rows[7];
  let calls = 0;
  const result = await extract({mutate(rows) {rows[7].question_text = context;}, repair() {
    return ++calls === 1 ? {parts: []} : {questions: q8};
  }}, 'full_mock', 'paper_2', fixture);
  expect(String(result.error ?? '')).toBe('');
  expect(result.repairCalls).toHaveLength(2);
  expect(result.drafts[7]).toMatchObject({question_text: q8.question_text, options: q8.options, diagram_config: q8.diagram_config});
  expect(result.exam.extraction_status).toBe('completed');
});

it('stops genuinely empty repairs at the existing per-group limit without adding paid calls', async () => {
  const fixture = ocrPaper2Fixture();
  const result = await extract({mutate(rows) {rows[7].question_text = context;}, repair() {return {parts: []};}},
    'full_mock', 'paper_2', fixture);
  expect(String(result.error)).toContain('Q8');
  expect(String(result.error)).toContain('missing_task');
  expect(String(result.error)).toContain('invalid_response_shape');
  expect(result.repairCalls).toHaveLength(3);
  expect(result.exam.extraction_status).toBe('failed');
});
