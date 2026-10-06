// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {hasAssessedTask, normalizeRepairPart, validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {analyseGroupRepair} from '../functions/_shared/prepare-group-repair';
import {biologyScopeFromContext} from '../functions/_shared/gcse-biology-scope';
import {extract, boundaryHandler} from './aqa-alevel-runtime';
import {ocrPaper2Fixture} from './ocr-alevel-paper2-fixtures';
import {ocrPaper2V2Fixture} from './ocr-alevel-paper2-v2-fixtures';

// Exact tasks from the failure report; the surrounding data and keys below
// are original synthetic fixtures, not the owner's saved exam or model logs.
const phTask = 'Based on the data provided in the table, at which pH is the enzyme activity approximately 75% of its maximum activity?';
const orchidTask = 'Based on the graph, during which period did the orchid population experience the greatest percentage increase?';
const contexts = [
  'A researcher measured enzyme activity at different pH values.',
  'A conservation group recorded the size of an orchid population over time.',
];

function fixture(version: 1 | 2) {
  const f = version === 1 ? ocrPaper2Fixture() : ocrPaper2V2Fixture();
  Object.assign(f.rows[3], {question_text: phTask, options: ['pH 4', 'pH 5', 'pH 6', 'pH 7'], correct_answer: 'pH 5',
    diagram_config: {type: 'data_table', id: f.plan.parts[3].resourceId, headers: ['pH', 'Enzyme activity (arbitrary units)'],
      rows: [[4, 25], [5, 75], [6, 100], [7, 50]], caption: 'Measured activity at constant temperature'}});
  Object.assign(f.rows[7], {question_text: orchidTask, options: ['2014–2016', '2016–2018', '2018–2020', '2020–2022'], correct_answer: '2016–2018',
    diagram_config: {type: 'line_chart', id: f.plan.parts[7].resourceId, xAxisLabel: 'Year', yAxisLabel: 'Orchid population (individuals)',
      datasets: [{label: 'Observed population', data: [{x: 2014, y: 50}, {x: 2016, y: 75}, {x: 2018, y: 150}, {x: 2020, y: 210}, {x: 2022, y: 315}]}],
      caption: 'Population survey measurements'}});
  return f;
}

describe('resource-led assessed questions', () => {
  it.each([
    phTask,
    orchidTask,
    phTask.split(', ')[1],
    orchidTask.split(', ')[1],
    phTask.replace('?', '.'),
    orchidTask.replace('?', ''),
    'From the table, in which treatment was the highest yield recorded?',
    'Based on the graph, over what time interval does the population double?',
    'At what substrate concentration is half the maximum rate reached?',
    'In which stage of the cell cycle are sister chromatids separated?',
    'With which organism does the orchid form a mutualistic association?',
    'If the observations were recorded at fixed intervals, during which period did the population grow fastest?',
    'Based on the graph, now briefly identify the period of greatest growth.',
  ])('recognises an assessed question rather than requiring a command verb: %s', task => {
    expect(hasAssessedTask(task)).toBe(true);
  });

  it.each([
    contexts[0], contexts[1],
    'Based on the data provided in the table, the enzyme activity is approximately 75% of its maximum activity?',
    'Based on the graph, the orchid population experienced a percentage increase?',
    'The researcher recorded at which pH the enzyme activity was greatest.',
    'The report describes during which period the orchid population increased.',
    'Based on the graph, during which period the orchid population was counted.',
    'Based on the table, at which pH the enzyme was tested.',
    'Based on the graph, during which period?',
    'Based on the data provided in the table, at which pH is',
  ])('rejects context, reported activity and unfinished interrogatives: %s', task => {
    expect(hasAssessedTask(task)).toBe(false);
  });

  it.each([1, 2] as const)('validates and task-repairs Q4/Q8 without changing v%s sources or choices', version => {
    const f = fixture(version), scope = biologyScopeFromContext(f.snapshot);
    for (const [i, index] of [3, 7].entries()) {
      const original = f.rows[index], task = original.question_text;
      expect(validateQuestionCandidates([original], {scope}).ok).toBe(true);
      expect(normalizeRepairPart({question_number: original.question_number, task, correct_answer: original.correct_answer})?.questionText).toBe(task);
      const contextOnly = {...original, question_text: contexts[i]};
      const repaired = analyseGroupRepair([contextOnly], [{question_number: original.question_number, task, correct_answer: original.correct_answer}],
        scope, new Set([original.question_number]), new Set([original.question_number]), 'task_only');
      expect(repaired.diagnostics).toEqual([]);
      expect(repaired.replacements[original.question_number]).toMatchObject({...original, question_text: contexts[i] + '\n\n' + task});
      expect(contextOnly.question_text).toBe(contexts[i]);
    }
  });

  it.each([3, 7])('keeps required resources and private keys mandatory for question index %s', index => {
    const f = fixture(2), original = f.rows[index], scope = biologyScopeFromContext(f.snapshot);
    const missingResource = validateQuestionCandidates([{...original, requires_resource: true, diagram_config: null}], {scope});
    expect(missingResource.defects.map(d => d.code)).toContain('missing_required_resource');
    expect(missingResource.defects.map(d => d.code)).not.toContain('missing_task');
    const invalidKey = validateQuestionCandidates([{...original, correct_answer: 'No matching choice'}], {scope});
    expect(invalidKey.defects.map(d => d.code)).toContain('answer_mismatch');
    expect(normalizeRepairPart({question_number: original.question_number, task: original.question_text})).toBeNull();
    const contextOnly = {...original, question_text: contexts[index === 3 ? 0 : 1]};
    const changedSource = analyseGroupRepair([contextOnly], [{question_number: original.question_number,
      task: original.question_text, correct_answer: original.correct_answer, diagram_config: {type: 'data_table', headers: ['x', 'y'], rows: [[0, 999]]}}],
      scope, new Set(), new Set([original.question_number]), 'task_only');
    expect(changedSource.diagnostics.map(d => d.code)).toContain('source_changed');
    expect(changedSource.replacements).toEqual({});
  });
});

describe('OCR Paper 2 resource-led questions through actual bundled handlers', () => {
  it.each([1, 2] as const)('generates and finalises v%s Q4/Q8 with zero unnecessary repair calls', async version => {
    const f = fixture(version), result = await extract(false, 'full_mock', 'paper_2', f);
    expect(String(result.error ?? '')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.repairCalls).toHaveLength(0);
    expect(result.drafts.map(q => q.question_number)).toEqual(f.plan.parts.map(p => p.questionNumber));
    expect(result.drafts.filter(q => q.question_type === 'mcq')).toHaveLength(15);
    expect(result.drafts.reduce((sum, q) => sum + q.marks, 0)).toBe(100);
    for (const index of [3, 7]) expect(result.drafts[index]).toMatchObject({...f.rows[index], id: expect.any(String)});
    const boundary = await boundaryHandler('publish-exam', result.drafts, 'full_mock', 'paper_2', f.snapshot);
    expect((await boundary.run({draftId: 'exam'})).status).toBe(200);
  });

  it('accepts both exact tasks as repairs in one call per group and preserves all resources', async () => {
    const f = fixture(2);
    const result = await extract({mutate(rows) {rows[3].question_text = contexts[0]; rows[7].question_text = contexts[1];},
      repair(request) {
        const prompt = request.messages.map((m: {content: string}) => m.content).join('\n');
        const example = JSON.parse(prompt.split('Return JSON only: ')[1]);
        return {parts: example.parts.map((part: {question_number: string}) => {
          const original = f.rows.find(q => q.question_number === part.question_number)!;
          return {question_number: original.question_number, task: original.question_text, correct_answer: original.correct_answer};
        })};
      }}, 'full_mock', 'paper_2', f);
    expect(String(result.error ?? '')).toBe('');
    expect(result.repairCalls).toHaveLength(2);
    expect(result.exam.extraction_status).toBe('completed');
    for (const [i, index] of [3, 7].entries()) expect(result.drafts[index]).toMatchObject({...f.rows[index],
      id: expect.any(String), question_text: contexts[i] + '\n\n' + f.rows[index].question_text});
    expect(result.aiCalls.length).toBeLessThanOrEqual(26);
    const boundary = await boundaryHandler('publish-exam', result.drafts, 'full_mock', 'paper_2', f.snapshot);
    expect((await boundary.run({draftId: 'exam'})).status).toBe(200);
  });

  it('still fails and retains the repair ceiling when responses only describe observations', async () => {
    const f = fixture(2);
    const result = await extract({mutate(rows) {rows[7].question_text = contexts[1];}, repair() {
      return {parts: [{...f.rows[7], question_text: contexts[1], task: 'Based on the graph, the orchid population increased?'}]};
    }}, 'full_mock', 'paper_2', f);
    expect(String(result.error)).toContain('missing_task');
    expect(result.repairCalls).toHaveLength(3);
    expect(result.exam.extraction_status).toBe('failed');
    expect(result.drafts[7].question_text).toBe(contexts[1]);
  });

  it.each([3, 7])('blocks finalisation when an otherwise valid resource question lacks its planned resource: %s', async index => {
    const f = fixture(2);
    const boundary = await boundaryHandler('publish-exam', f.rows.map((q, i) => i === index ? {...q, diagram_config: null} : q), 'full_mock', 'paper_2', f.snapshot);
    expect((await boundary.run({draftId: 'exam'})).status).toBe(422);
    expect(boundary.writes.some(w => ['exam_questions', 'commit_generated_responses'].includes(w.table))).toBe(false);
  });
});
