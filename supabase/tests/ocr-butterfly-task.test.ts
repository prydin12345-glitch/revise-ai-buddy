// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {hasAssessedTask, normalizeRepairPart} from '../functions/_shared/question-contract-validator';
import {extract, boundaryHandler} from './aqa-alevel-runtime';
import {ocrPaper2Fixture} from './ocr-alevel-paper2-fixtures';
import {ocrPaper2V2Fixture} from './ocr-alevel-paper2-v2-fixtures';

// Exact repair wording reported by the owner. The graph, options and private
// key are synthetic: no saved exam, provider log or real record is accessed.
const task = 'Based on the provided graph, in which year was the butterfly population showing the greatest rate of increase?';
const context = 'A conservation group recorded the yearly rate of change of a butterfly population.';

function fixture(version: 1 | 2) {
  const f = version === 1 ? ocrPaper2Fixture() : ocrPaper2V2Fixture();
  Object.assign(f.rows[7], {question_text: task, options: ['2014', '2016', '2018', '2020'], correct_answer: '2018',
    diagram_config: {type: 'line_chart', id: f.plan.parts[7].resourceId, xAxisLabel: 'Year',
      yAxisLabel: 'Population increase (individuals/year)', datasets: [{label: 'Recorded annual increase',
        data: [{x: 2014, y: 5}, {x: 2016, y: 10}, {x: 2018, y: 30}, {x: 2020, y: 20}]}], caption: 'Annual population survey'}});
  return f;
}

describe('reported butterfly Q8 instruction', () => {
  it('accepts the exact task and retains it during repair normalization', () => {
    expect(hasAssessedTask(task)).toBe(true);
    expect(normalizeRepairPart({question_number: '8', task, correct_answer: '2018'})).toEqual({
      questionNumber: '8', questionText: task, correctAnswer: '2018', options: undefined});
  });

  it('still rejects a graph description without an assessed question', () => {
    expect(hasAssessedTask(context)).toBe(false);
    expect(hasAssessedTask('Based on the provided graph, the butterfly population was showing an increase?')).toBe(false);
    expect(hasAssessedTask('The graph records in which year the butterfly population was monitored.')).toBe(false);
  });

  it.each([1, 2] as const)('generates and finalises v%s without repairing the valid butterfly instruction', async version => {
    const f = fixture(version), result = await extract(false, 'full_mock', 'paper_2', f);
    expect(String(result.error ?? '')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.repairCalls).toHaveLength(0);
    expect(result.drafts[7]).toMatchObject({...f.rows[7], id: expect.any(String)});
    expect(result.drafts.map(q => q.question_number)).toEqual(f.plan.parts.map(p => p.questionNumber));
    expect(result.drafts.filter(q => q.question_type === 'mcq')).toHaveLength(15);
    expect(result.drafts.reduce((sum, q) => sum + q.marks, 0)).toBe(100);
    const boundary = await boundaryHandler('publish-exam', result.drafts, 'full_mock', 'paper_2', f.snapshot);
    expect((await boundary.run({draftId: 'exam'})).status).toBe(200);
  });

  it.each([1, 2] as const)('accepts the exact butterfly task in one repair on v%s, preserving graph, options and key', async version => {
    const f = fixture(version);
    const result = await extract({mutate(rows) {rows[7].question_text = context;}, repair() {
      return {parts: [{question_number: '8', task, correct_answer: f.rows[7].correct_answer}]};
    }}, 'full_mock', 'paper_2', f);
    expect(String(result.error ?? '')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.repairCalls).toHaveLength(1);
    expect(result.drafts[7]).toMatchObject({...f.rows[7], id: expect.any(String), question_text: context + '\n\n' + task});
    expect(result.aiCalls.length).toBeLessThanOrEqual(26);
    const boundary = await boundaryHandler('publish-exam', result.drafts, 'full_mock', 'paper_2', f.snapshot);
    expect((await boundary.run({draftId: 'exam'})).status).toBe(200);
  });

  it('does not accept the instruction with a private answer outside its options', async () => {
    const f = fixture(2);
    const result = await extract({mutate(rows) {rows[7].question_text = context;}, repair() {
      return {parts: [{...f.rows[7], question_text: context, task, correct_answer: '2025'}]};
    }}, 'full_mock', 'paper_2', f);
    expect(String(result.error)).toContain('answer_mismatch');
    expect(result.repairCalls).toHaveLength(3);
    expect(result.exam.extraction_status).toBe('failed');
    expect(result.drafts[7].question_text).toBe(context);
  });

  it('blocks finalisation if the required butterfly graph is missing', async () => {
    const f = fixture(2);
    const boundary = await boundaryHandler('publish-exam', f.rows.map((q, i) => i === 7 ? {...q, diagram_config: null} : q),
      'full_mock', 'paper_2', f.snapshot);
    expect((await boundary.run({draftId: 'exam'})).status).toBe(422);
    expect(boundary.writes.some(w => ['exam_questions', 'commit_generated_responses'].includes(w.table))).toBe(false);
  });
});
