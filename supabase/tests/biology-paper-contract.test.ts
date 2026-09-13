// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  hasAssessedTask,
  assembleQuestionText,
  referencesResource,
  validateQuestionCandidates,
  describeDefects,
} from '../functions/_shared/question-contract-validator.ts';
import {
  buildPaperPlan,
  buildFullMockPlan,
  buildShortPracticePlan,
  supportsBiologyPaperContract,
  AQA_BIOLOGY_P1,
} from '../functions/_shared/biology-paper-contract.ts';

// The two real defective stems from the audited paper.
const Q1A_CONTEXT =
  'A student investigated diffusion using agar cubes. The concentration of dye at the centre ' +
  'was 10 units at the start and 4 units after 30 minutes.';
const Q2A_CONTEXT =
  'A scientist tested three antibiotics on bacteria grown on an agar plate. They measured the ' +
  'diameter of the zone of inhibition around each disc.';

describe('answerability: task detection', () => {
  it('rejects the exact Q1(a) and Q2(a) context-only stems', () => {
    expect(hasAssessedTask(Q1A_CONTEXT)).toBe(false);
    expect(hasAssessedTask(Q2A_CONTEXT)).toBe(false);
  });

  it('accepts instructions ending in a full stop, with no question mark', () => {
    expect(hasAssessedTask(`${Q1A_CONTEXT} Calculate the mean change in concentration gradient per minute.`)).toBe(true);
    expect(hasAssessedTask('Explain why the rate decreased.')).toBe(true);
  });

  it('accepts an instruction placed before its supporting data', () => {
    expect(hasAssessedTask('Complete the table below.\n\n| Tube | Result |\n| A | |')).toBe(true);
    expect(hasAssessedTask('Use the graph to determine the rate at 20 s.\nFigure 1 shows...')).toBe(true);
  });

  it('accepts interrogatives without a question mark and tick-box commands', () => {
    expect(hasAssessedTask('Which structure controls what enters the cell')).toBe(true);
    expect(hasAssessedTask('Tick one box.')).toBe(true);
  });

  it('does not treat narrative past-tense measurement as a task', () => {
    expect(hasAssessedTask('They measured the diameter of each zone and recorded the results.')).toBe(false);
  });
});

describe('deterministic text assembly', () => {
  it('joins context and task, and survives a missing context', () => {
    expect(assembleQuestionText({ context: Q1A_CONTEXT, task: 'Calculate the rate.' }))
      .toBe(`${Q1A_CONTEXT}\n\nCalculate the rate.`);
    expect(assembleQuestionText({ task: 'State one variable.' })).toBe('State one variable.');
    expect(assembleQuestionText({ question_text: 'Legacy text' })).toBe('Legacy text');
  });
});

describe('candidate validation', () => {
  const good = {
    question_number: '1(a)',
    parent_question_number: '1',
    question_type: 'short_answer',
    context: Q1A_CONTEXT,
    task: 'Calculate the mean change in concentration gradient per minute.',
    marks: 2,
    correct_answer: '(10 - 4) / 30 = 0.2 units per minute',
  };

  it('passes a well-formed part', () => {
    expect(validateQuestionCandidates([good]).ok).toBe(true);
  });

  it('flags missing_task and reports a stable part id and group', () => {
    const r = validateQuestionCandidates([{ ...good, task: null, context: Q1A_CONTEXT }]);
    expect(r.ok).toBe(false);
    expect(r.defects[0].code).toBe('missing_task');
    expect(r.failedPartIds).toEqual(['1(a)']);
    expect(r.failedGroupIds).toEqual(['1']);
    expect(describeDefects(r.defects)).toContain('missing_task');
  });

  it('allows an unmarked context parent', () => {
    expect(validateQuestionCandidates([{ question_number: '1', context: Q2A_CONTEXT, marks: 0 }]).ok).toBe(true);
  });

  it('flags a stale answer key after a text-only repair', () => {
    const r = validateQuestionCandidates([
      { ...good, question_type: 'mcq', options: ['Ribosome', 'Nucleus', 'Membrane', 'Vacuole'], correct_answer: 'Mitochondrion' },
    ]);
    expect(r.defects.map((d) => d.code)).toContain('answer_mismatch');
  });

  it('flags a missing answer and invalid MCQ options', () => {
    const r = validateQuestionCandidates([
      { ...good, correct_answer: '' },
      { ...good, question_number: '1(b)', question_type: 'mcq', options: ['A only'], correct_answer: 'A only' },
    ]);
    const codes = r.defects.map((d) => d.code);
    expect(codes).toContain('missing_answer');
    expect(codes).toContain('invalid_options');
  });

  it('flags a referenced figure with no payload, and accepts a shared resource', () => {
    const part = { ...good, task: 'Use Figure 1 to describe the trend.' };
    expect(referencesResource(part.task)).toBe(true);
    expect(validateQuestionCandidates([part]).defects.map((d) => d.code))
      .toContain('missing_required_resource');
    expect(validateQuestionCandidates([part], { availableResources: ['Figure 1'] }).ok).toBe(true);
    expect(validateQuestionCandidates([{ ...part, figure_urls: ['x.png'] }]).ok).toBe(true);
  });

  it('flags marks and part counts that disagree with the plan', () => {
    const r = validateQuestionCandidates([good], { expectedTotalMarks: 23, expectedPartCount: 8 });
    expect(r.defects.filter((d) => d.code === 'incorrect_mark_total')).toHaveLength(2);
  });
});

describe('paper contract plans', () => {
  it('full mock is exactly 100 marks and 105 minutes', () => {
    const plan = buildFullMockPlan('higher');
    expect(plan.totalMarks).toBe(100);
    expect(plan.durationMinutes).toBe(105);
    expect(new Set(plan.parts.map((p) => p.topic))).toEqual(new Set(AQA_BIOLOGY_P1.topics));
  });

  it('short practice reports its own real total, never 100', () => {
    const plan = buildShortPracticePlan('foundation');
    expect(plan.partCount).toBe(8);
    expect(plan.totalMarks).toBe(plan.parts.reduce((s, p) => s + p.marks, 0));
    expect(plan.totalMarks).not.toBe(100);
    expect(plan.parts.filter((p) => p.responseType === 'mcq_single' && p.marks === 1)).toHaveLength(2);
    expect(plan.parts.some((p) => p.resource === 'data_table')).toBe(true);
    expect(plan.parts.some((p) => p.resource === 'graph')).toBe(true);
  });

  it('counts parents and answerable parts separately', () => {
    const plan = buildShortPracticePlan('higher');
    expect(plan.parentCount).toBe(4);
    expect(plan.partCount).toBe(8);
  });

  it('custom mode never produces a plan, so nothing is overwritten', () => {
    expect(buildPaperPlan('custom', 'higher')).toBeNull();
  });

  it('carries the tier through the plan identity', () => {
    expect(buildPaperPlan('full_mock', 'foundation')!.tier).toBe('foundation');
    expect(buildPaperPlan('full_mock', null)!.tier).toBeNull();
  });

  it('only covers AQA GCSE separate Biology', () => {
    expect(supportsBiologyPaperContract({ subject: 'Biology Higher', examBoard: 'AQA', educationalLevel: 'GCSE' })).toBe(true);
    expect(supportsBiologyPaperContract({ subject: 'Combined Science', examBoard: 'AQA', educationalLevel: 'GCSE' })).toBe(false);
    expect(supportsBiologyPaperContract({ subject: 'Biology', examBoard: 'Edexcel', educationalLevel: 'GCSE' })).toBe(false);
    expect(supportsBiologyPaperContract({ subject: 'Biology', examBoard: 'AQA', educationalLevel: 'A Level' })).toBe(false);
  });
});
