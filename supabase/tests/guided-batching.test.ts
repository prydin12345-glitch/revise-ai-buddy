// @vitest-environment node
// Focused cover for the guided-paper batching, truncation recovery and the
// shared provider-call budget. Final validation stays mandatory elsewhere:
// these helpers never mark anything ready, they only bound the work.
import { describe, expect, it } from 'vitest';
import {
  plannedPartKey,
  salvageTruncatedQuestions,
  planGroupBatches,
  mergeBatchRows,
  missingPlannedParts,
  describeRejections,
} from '../functions/_shared/guided-batching';
import { AiCallBudget, AiBudgetExhaustedError, usageTokens } from '../functions/_shared/ai-call-budget';

const part = (questionNumber: string, parentId = questionNumber.replace(/\(.*/, '')) =>
  ({ questionNumber, parentId, marks: 2, responseType: 'short', topicTag: 'B1' }) as any;

const plan = (parts: any[]) => ({ parts, partCount: parts.length, totalMarks: parts.length * 2 }) as any;

describe('truncated guided responses', () => {
  it('recovers every complete question from a response cut off mid-array', () => {
    const complete = [
      { question_number: '1(a)', question_text: 'State one function.', marks: 2 },
      { question_number: '1(b)', question_text: 'Explain why.', marks: 3 },
    ];
    const truncated = `{"questions":${JSON.stringify(complete)}`.slice(0, -1) + ',{"question_number":"2(a)","question_te';
    const recovered = salvageTruncatedQuestions(truncated);
    expect(recovered.map(q => q.question_number)).toEqual(['1(a)', '1(b)']);
  });

  it('survives truncation inside a nested resource and inside an escaped string', () => {
    const rows = [{
      question_number: '3(a)',
      question_text: 'Use the table. She said "hello" and moved on {carefully}.',
      chart_data: { type: 'data_table', headers: ['Time (s)', 'Volume (cm3)'], rows: [[0, 1], [2, 4]] },
      marks: 2,
    }];
    const cutInsideResource = `{"questions":${JSON.stringify(rows)}`.slice(0, -1)
      + ',{"question_number":"3(b)","chart_data":{"type":"line_chart","datasets":[{"label":"Ra';
    expect(salvageTruncatedQuestions(cutInsideResource).map(q => q.question_number)).toEqual(['3(a)']);

    const cutInsideString = `{"questions":${JSON.stringify(rows)}`.slice(0, -1)
      + ',{"question_number":"3(b)","question_text":"The student wrote \\"the rate';
    expect(salvageTruncatedQuestions(cutInsideString)).toHaveLength(1);
  });

  it('returns nothing rather than guessing when no question array arrived', () => {
    expect(salvageTruncatedQuestions('{"topics":["B1"]}')).toEqual([]);
    expect(salvageTruncatedQuestions('')).toEqual([]);
  });
});

describe('batch planning keeps parent groups whole', () => {
  it('never splits a group across responses', () => {
    const parts = ['1(a)', '1(b)', '1(c)', '2(a)', '2(b)', '3(a)', '3(b)', '3(c)'].map(n => part(n));
    const batches = planGroupBatches(parts, 4);
    for (const batch of batches) {
      const parents = new Set(batch.map(p => p.parentId));
      for (const parent of parents) {
        const inBatch = batch.filter(p => p.parentId === parent).length;
        const inPlan = parts.filter(p => p.parentId === parent).length;
        expect(inBatch).toBe(inPlan);
      }
    }
    expect(batches.flat()).toHaveLength(parts.length);
  });

  it('keeps an oversized group intact in its own batch', () => {
    const parts = ['1(a)', '1(b)', '1(c)', '1(d)', '2(a)'].map(n => part(n));
    const batches = planGroupBatches(parts, 2);
    expect(batches[0].map(p => p.questionNumber)).toEqual(['1(a)', '1(b)', '1(c)', '1(d)']);
    expect(batches[1].map(p => p.questionNumber)).toEqual(['2(a)']);
  });
});

describe('merging batch rows', () => {
  const currentPlan = plan([part('1(a)'), part('1(b)'), part('2(a)')]);

  it('accepts requested parts and rejects conflicting duplicates without overwriting', () => {
    const produced = new Map<string, any>();
    const batch = [part('1(a)'), part('1(b)')];
    const first = mergeBatchRows(produced, [
      { question_number: '1(a)', question_text: 'Accepted first', marks: 2 },
      { question_number: '1(b)', question_text: 'Also accepted', marks: 2 },
    ], batch, currentPlan);
    expect(first.added).toBe(2);
    expect(first.rejections).toHaveLength(0);

    const second = mergeBatchRows(produced, [
      { question_number: 'Q1(a)', question_text: 'Conflicting rewrite', marks: 5 },
    ], batch, currentPlan);
    expect(second.added).toBe(0);
    expect(second.rejections[0].code).toBe('duplicate_part');
    expect(produced.get('1(a)').question_text).toBe('Accepted first');
  });

  it('rejects parts from another batch and parts that are not in the plan', () => {
    const produced = new Map<string, any>();
    const { added, rejections } = mergeBatchRows(produced, [
      { question_number: '1(a)', question_text: 'Wanted', marks: 2 },
      { question_number: '2(a)', question_text: 'Different batch', marks: 2 },
      { question_number: '9(z)', question_text: 'Invented', marks: 2 },
    ], [part('1(a)')], currentPlan);
    expect(added).toBe(1);
    expect(rejections.map(r => r.code)).toEqual(['outside_batch', 'unplanned_part']);
    expect(describeRejections(rejections)).toContain('outside_batch');
    expect(missingPlannedParts(currentPlan, produced).map(p => p.questionNumber)).toEqual(['1(b)', '2(a)']);
  });

  it('matches plan and model numbering in canonical form', () => {
    expect(plannedPartKey('Q 1 (A)')).toBe('1(a)');
    expect(plannedPartKey('1a')).toBe('1(a)');
    expect(plannedPartKey('12')).toBe('12');
  });
});

describe('shared provider-call budget', () => {
  it('counts failed attempts and stops further work once spent', () => {
    const budget = new AiCallBudget({ maxCalls: 2, maxMs: 60_000 });
    budget.reserve('generation');
    budget.record({ purpose: 'generation', model: 'flash', ok: false, promptTokens: 0, completionTokens: 0, ms: 10 });
    budget.reserve('generation (pro fallback)');
    budget.record({ purpose: 'generation', model: 'pro', ok: true, promptTokens: 100, completionTokens: 40, ms: 20 });
    expect(budget.exhausted()).toContain('2/2 calls');
    expect(() => budget.reserve('repair')).toThrow(AiBudgetExhaustedError);
    expect(budget.summary()).toContain('1 failed');
    expect(budget.summary()).toContain('100 prompt + 40 completion tokens');
  });

  it('stops on wall-clock time as well as call count', () => {
    let now = 0;
    const budget = new AiCallBudget({ maxCalls: 50, maxMs: 1_000, now: () => now });
    budget.reserve('generation');
    now = 1_500;
    expect(budget.exhausted()).toContain('time budget');
  });

  it('records unknown token usage as zero rather than guessing', () => {
    expect(usageTokens(undefined)).toEqual({ promptTokens: 0, completionTokens: 0 });
    expect(usageTokens({ input_tokens: 12, output_tokens: 3 })).toEqual({ promptTokens: 12, completionTokens: 3 });
    expect(usageTokens({ prompt_tokens: 'many' })).toEqual({ promptTokens: 0, completionTokens: 0 });
  });
});
