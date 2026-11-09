// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extract, boundaryHandler } from './aqa-alevel-runtime';
import { prepareProfileSave, type BuilderProposal } from '../functions/_shared/profile-builder-service';
import { snapshotTemplate } from '../functions/_shared/profile-template-context';
import { compileTemplate, checksum, type ProfileTemplate } from '../functions/_shared/profile-template';
import { evidenceFingerprint, type ProfileEvidence } from '../functions/_shared/profile-evidence';
import { physicsPrivateKeyForStorage } from '../functions/_shared/physics-generation-contract';
import { physicsCalculationIssues } from '../functions/_shared/physics-calculation-integrity';

// Original software fixtures, not official examination content or a paper blueprint.
const identity = {
  country: 'GB', educationSystem: 'UK', stage: 'Secondary', qualification: 'A-level',
  subject: 'Physics', organisation: 'AQA', course: '7408', component: '7408/2',
  specificationVersion: 'Version 1.4 July 2026', tier: 'not_tiered' as const,
};
const noFigure = () => ({ type: 'physics_no_figure', physics_figure_version: 1, diagram_intent: 'none' });
const slope = () => ({
  type: 'slope', physics_figure_version: 1, diagram_intent: 'setup',
  angle: 30, mass: 2, surface: 'rough', showNormal: false, showWeight: false,
  showFriction: false, showComponents: false, showLabels: true,
});
const graph = () => ({
  type: 'line_chart', physics_figure_version: 1, diagram_intent: 'graph',
  xAxisLabel: 'Time / s', yAxisLabel: 'Potential difference / V',
  datasets: [{ label: 'Discharge', data: [{ x: 0, y: 12 }, { x: 1, y: 7 }, { x: 2, y: 4 }] }],
});
const powerKey = () => ({
  answer: '24.0 W', worked_solution: 'Power = 12.0 V × 2.00 A = 24.0 W.',
  calculation_checks: [{ label: 'power', inputs: [
    { name: 'v', value: '12.0', unit: 'V', source: 'stem', quote: '12.0 V' },
    { name: 'i', value: '2.00', unit: 'A', source: 'stem', quote: '2.00 A' },
  ], expression: { op: 'multiply', args: [{ input: 'v' }, { input: 'i' }] },
  result: { value: '24.0', unit: 'W', significant_figures: 3 }, answer_quote: '24.0 W', working_quote: '24.0 W' }],
});
const graphKey = () => ({
  answer: '4.0 V', worked_solution: 'Read the plotted potential difference at the requested time: 4.0 V.',
  calculation_checks: [{ label: 'potential difference', inputs: [
    { name: 'v', value: '4', unit: 'V', source: 'resource', quote: '4 V',
      resource_ref: { field: 'diagram_config', dataset: 0, point: 2, axis: 'y' } },
  ], expression: { input: 'v' }, result: { value: '4.0', unit: 'V', significant_figures: 2 },
  answer_quote: '4.0 V', working_quote: '4.0 V' }],
});
const baseTasks = () => [
  { topic: 'Mechanics', task: 'A block of mass 2 kg rests on a rough slope at 30 deg to the horizontal. Explain the direction of friction when the block tends to slide down.',
    correct_answer: 'Friction acts up the slope because it opposes the tendency to move down the slope.', diagram_config: slope(), resource: 'none' as const },
  { topic: 'Electricity', task: 'A lamp has potential difference 12.0 V and current 2.00 A. Calculate its power.',
    correct_answer: powerKey(), diagram_config: noFigure(), resource: 'none' as const },
  { topic: 'Fields', task: 'Using the graph, determine the potential difference across the capacitor at 2 s.',
    correct_answer: graphKey(), diagram_config: graph(), resource: 'graph' as const },
];
type Task = ReturnType<typeof baseTasks>[number];
const extraTasks: Array<[string, string, string]> = [
  ['Waves', 'Explain why sound cannot travel through a vacuum.', 'Sound needs particles to transfer a mechanical disturbance; a vacuum contains no particles.'],
  ['Thermal physics', 'Explain why evaporation cools a liquid.', 'The faster molecules escape and the mean kinetic energy of the remaining molecules falls.'],
  ['Nuclear physics', 'Explain why repeated background count measurements fluctuate.', 'Radioactive decay is random, so independent count measurements fluctuate.'],
  ['Materials', 'Explain why a wire returns to its original length below its elastic limit.', 'The deformation is elastic and the interatomic restoring forces return the wire to its original length.'],
  ['Particles', 'Explain why a neutron is not deflected by an electric field.', 'A neutron has no net electric charge and therefore experiences no electric force.'],
  ['Optics', 'Explain why total internal reflection requires light to travel towards a medium of lower refractive index.', 'Only this direction permits a refracted angle to reach a right angle and hence a critical angle.'],
  ['Measurements', 'Explain how repeated measurements reduce the effect of random error in a mean.', 'Random deviations partially cancel in the mean, reducing its uncertainty.'],
  ['Gravitation', 'Explain why an orbiting satellite is accelerating even at constant speed.', 'Its velocity changes direction, so its acceleration points towards the centre of its orbit.'],
];

async function fixture(multipleBatches = false, linkedFirstGroup = false) {
  const tasks: Task[] = baseTasks();
  if (multipleBatches) tasks.push(...extraTasks.map(([topic, task, correct_answer]) => ({
    topic, task, correct_answer, resource: 'none' as const, diagram_config: noFigure(),
  })));
  const topics = [...new Set(tasks.map(task => task.topic))];
  const marks = tasks.length * 2;
  const template: ProfileTemplate = {
    schemaVersion: 1, identity, mode: 'short_practice', marks, durationMinutes: 20,
    topics, calculator: 'allowed', sections: [{ id: 'practice', title: 'Original software practice layout',
      groups: tasks.map((task, index) => ({ id: `group-${index + 1}`, parts: [{
        id: `part-${index + 1}`, topic: task.topic, marks: 2, response: 'short_answer', demand: 'AO2', resource: task.resource,
      }] })),
    }], warnings: [], designDecisions: ['Original development practice layout; not an official fixed structure.'],
  };
  if (linkedFirstGroup) {
    const groups = template.sections[0].groups;
    const linked = groups.splice(0, 2);
    groups.unshift({ id: 'linked-first', parts: linked.flatMap(group => group.parts) });
  }
  const source = `Original synthetic assessment brief. ${identity.specificationVersion}. 85 marks; 120 minutes. This assessment is untiered. ${topics.join('; ')}. Short structured answers. Answer all questions. A scientific calculator is allowed.`;
  const evidence: ProfileEvidence = {
    version: 1, identity, documents: [{ id: 'owned-source', checksum: await checksum(source),
      title: 'Original private software fixture', url: null, version: identity.specificationVersion,
      kind: 'specification', authority: 'owner_supplied', retrievedOn: '2026-11-09', state: 'active', applicableCohort: 'Current fixture',
      locations: [{ id: 'overview', page: 1, section: 'Assessment overview', text: source }],
    }], facts: { marks: 85, durationMinutes: 120, topics, tier: 'not_tiered', calculator: 'allowed',
      selection: 'all_compulsory', formats: ['short_answer'], mathsRequirement: null, practicalRequirement: null },
    claims: [ ['marks', '85 marks'], ['durationMinutes', '120 minutes'], ['topics', topics.join('; ')],
      ['tier', 'untiered'], ['calculator', 'A scientific calculator is allowed'], ['selection', 'Answer all questions'],
      ['formats', 'Short structured answers'],
    ].map(([field, quote]) => ({ field, quote, documentId: 'owned-source', locationId: 'overview', rule: 'mandatory' })),
    unresolved: [], conflicts: [],
  };
  const proposal: BuilderProposal = { proposalVersion: 1, promptVersion: 1, template, origin: 'source_backed_ai',
    evidence, evidenceVersion: await evidenceFingerprint(evidence), presetId: null, profileSettings: null };
  const saved = prepareProfileSave(proposal, template);
  const plan = compileTemplate(template);
  return {
    plan,
    rows: plan.parts.map((part, index) => ({ id: part.partId, question_number: part.questionNumber,
      root_question_number: part.parentId, parent_question_number: part.parentId, question_type: 'short_answer',
      question_text: tasks[index].task, task: tasks[index].task, correct_answer: tasks[index].correct_answer,
      marks: part.marks, topic_tag: part.topic, diagram_config: tasks[index].diagram_config,
    })),
    snapshot: { context_version: 2, resolved_by: 'server', physics_generation_version: 1, profile_id: 'profile',
      subject_name: 'Physics', exam_board: 'AQA', educational_tier: 'A-level', assessment_tier: 'not_tiered',
      course_id: plan.courseId, paper_id: plan.paperId, component_code: plan.componentCode, paper_contract: null,
      profile_template: snapshotTemplate({ ...saved.settings, profile_template: saved.context }),
    },
  };
}
const prompt = (request: any) => request.messages.map((message: any) => message.content).join('\n');
const publicAndKey = (row: any) => Object.fromEntries([
  'question_number', 'root_question_number', 'parent_question_number', 'question_text', 'correct_answer',
  'diagram_config', 'marks', 'topic_tag', 'question_type',
].map(key => [key, row[key]]));
const repairs = (f: Awaited<ReturnType<typeof fixture>>, index: number) => ({ parts: [{
  ...f.rows[index], context: '', correct_answer: structuredClone(f.rows[index].correct_answer),
  diagram_config: structuredClone(f.rows[index].diagram_config),
}] });

describe('new Physics contract through actual exam extraction and publication', () => {
  it('persists independently answerable setup, no-figure and graph tasks, including private numeric checks, through publication', async () => {
    const f = await fixture();
    const result = await extract(false, 'short_practice', 'paper_1', f);
    expect(String(result.error ?? '')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.drafts).toHaveLength(3);
    expect(result.repairCalls).toHaveLength(0);
    expect(result.drafts.map(row => row.diagram_config)).toEqual(f.rows.map(row => row.diagram_config));
    expect(JSON.parse(result.drafts[1].correct_answer)).toEqual(powerKey());
    expect(JSON.parse(result.drafts[2].correct_answer)).toEqual(graphKey());
    expect(result.drafts[2].question_text).not.toContain('4.0 V');
    expect(result.drafts.reduce((sum, row) => sum + row.marks, 0)).toBe(f.plan.totalMarks);
    expect(prompt(result.generationCalls[0])).toContain('PHYSICS PRIVATE NUMERICAL INTEGRITY');
    expect(prompt(result.generationCalls[0])).toContain('advisory');
    expect(prompt(result.generationCalls[0])).toContain('"topic":"Mechanics","marks":2');
    const publication = await boundaryHandler('publish-exam', result.drafts, 'short_practice', 'paper_1', f.snapshot);
    const response = await publication.run({ draftId: 'exam' });
    expect(response.status, await response.clone().text()).toBe(200);
    const published = publication.writes.find(write => write.table === 'exam_questions')!.value;
    expect(published.map((row: any) => row.diagram_config)).toEqual(result.drafts.map(row => row.diagram_config));
    expect(published.map((row: any) => row.correct_answer)).toEqual(result.drafts.map(row => row.correct_answer));
    expect(JSON.stringify(published.map((row: any) => row.diagram_config))).not.toContain('calculation_checks');
  });

  it.each(['missing setup', 'wrong arithmetic'] as const)('repairs %s within the existing group budget and preserves every unaffected saved task', async kind => {
    const f = await fixture();
    const index = kind === 'missing setup' ? 0 : 1;
    const result = await extract({
      mutate(rows) {
        if (index === 0) rows[0].chart_data = null;
        else {
          const key = powerKey();
          key.answer = '30.0 W'; key.worked_solution = 'Power = 12.0 V × 2.00 A = 30.0 W.';
          Object.assign(key.calculation_checks[0], { result: { value: '30.0', unit: 'W', significant_figures: 3 }, answer_quote: '30.0 W', working_quote: '30.0 W' });
          rows[1].correct_answer = key;
        }
      },
      repair: () => repairs(f, index),
    }, 'short_practice', 'paper_1', f);
    expect(String(result.error ?? '')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.repairCalls).toHaveLength(1);
    expect(prompt(result.repairCalls[0])).toContain(index === 0 ? 'saved diagram_config' : 'recomputed expression');
    expect(result.drafts[index].original_question_text).toBe(f.rows[index].question_text);
    const healthy = await extract(false, 'short_practice', 'paper_1', f);
    expect(result.drafts.map(publicAndKey)).toEqual(healthy.drafts.map(publicAndKey));
    const publication = await boundaryHandler('publish-exam', result.drafts, 'short_practice', 'paper_1', f.snapshot);
    const response = await publication.run({ draftId: 'exam' });
    expect(response.status, await response.clone().text()).toBe(200);
  });

  it.each(['missing setup', 'wrong arithmetic'] as const)('fails extraction with unresolved %s after bounded repairs', async kind => {
    const f = await fixture();
    const result = await extract({ mutate(rows) {
      if (kind === 'missing setup') rows[0].chart_data = noFigure();
      else rows[1].correct_answer = { answer: '30.0 W', worked_solution: 'Power = 30.0 W.', calculation_checks: [] };
    } }, 'short_practice', 'paper_1', f);
    expect(result.exam.extraction_status).toBe('failed');
    expect(String(result.error)).toContain(kind === 'missing setup' ? 'apparatus' : 'unverified_calculation');
    expect(result.repairCalls.length).toBeGreaterThan(0);
    expect(result.repairCalls.length).toBeLessThanOrEqual(3);
  });

  it('rejects an incomplete parent repair, then saves a complete repair with its healthy numeric sibling intact', async () => {
    const f = await fixture(false, true);
    let attempts = 0;
    const result = await extract({
      mutate: rows => { rows[0].chart_data = null; },
      repair: () => ++attempts === 1 ? repairs(f, 0) : { parts: [repairs(f, 0).parts[0], repairs(f, 1).parts[0]] },
    }, 'short_practice', 'paper_1', f);
    expect(String(result.error ?? '')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.repairCalls).toHaveLength(2);
    expect(prompt(result.repairCalls[1])).toContain('missing_part');
    expect(prompt(result.repairCalls[1])).toContain('1(b)');
    const healthy = await extract(false, 'short_practice', 'paper_1', f);
    expect(result.drafts.map(publicAndKey)).toEqual(healthy.drafts.map(publicAndKey));
    const publication = await boundaryHandler('publish-exam', result.drafts, 'short_practice', 'paper_1', f.snapshot);
    const response = await publication.run({ draftId: 'exam' });
    expect(response.status, await response.clone().text()).toBe(200);
  });

  it.each(['removed setup', 'changed mass', 'fabricated arithmetic', 'changed plotted datum', 'missing check'] as const)(
    'independent publication refuses a completed draft with %s and writes no published questions', async kind => {
      const f = await fixture();
      const healthy = await extract(false, 'short_practice', 'paper_1', f);
      expect(String(healthy.error ?? '')).toBe('');
      const rows = structuredClone(healthy.drafts);
      if (kind === 'removed setup') rows[0].diagram_config = noFigure();
      if (kind === 'changed mass') rows[0].diagram_config.mass = 20;
      if (kind === 'changed plotted datum') rows[2].diagram_config.datasets[0].data[2].y = 8;
      if (kind === 'fabricated arithmetic') {
        const key = powerKey();
        key.answer = '30.0 W'; key.worked_solution = 'Power = 30.0 W.';
        Object.assign(key.calculation_checks[0], { result: { value: '30.0', unit: 'W', significant_figures: 3 }, answer_quote: '30.0 W', working_quote: '30.0 W' });
        rows[1].correct_answer = JSON.stringify(key);
      }
      if (kind === 'missing check') rows[1].correct_answer = JSON.stringify({ answer: '24.0 W', worked_solution: 'Power = 24.0 W.' });
      const publication = await boundaryHandler('publish-exam', rows, 'short_practice', 'paper_1', f.snapshot);
      const response = await publication.run({ draftId: 'exam' });
      expect(response.status, await response.clone().text()).toBe(422);
      expect(await response.text()).toMatch(/invalid_resource|conflicting_resource_data|invalid_calculation|unverified_calculation/);
      expect(publication.writes.some(write => write.table === 'exam_questions')).toBe(false);
    },
  );

  it('keeps public graph coordinates usable as numeric evidence when generation uses the chart_data alias', async () => {
    const f = await fixture();
    const result = await extract({ mutate(rows) {
      rows[2].correct_answer.calculation_checks[0].inputs[0].resource_ref.field = 'chart_data';
    } }, 'short_practice', 'paper_1', f);
    expect(String(result.error ?? '')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.repairCalls).toHaveLength(0);
    expect(result.drafts[2].diagram_config).toEqual(graph());
    const publication = await boundaryHandler('publish-exam', result.drafts, 'short_practice', 'paper_1', f.snapshot);
    const response = await publication.run({ draftId: 'exam' });
    expect(response.status, await response.clone().text()).toBe(200);
  });

  it('rejects a numeric source alias absent from the model response instead of rebinding it to a coincident graph', async () => {
    const f = await fixture();
    const result = await extract({ mutate(rows) {
      rows[2].correct_answer.calculation_checks[0].inputs[0].resource_ref.field = 'table_data';
    } }, 'short_practice', 'paper_1', f);
    expect(result.exam.extraction_status).toBe('failed');
    expect(String(result.error)).toContain('invalid_calculation');
    expect(result.repairCalls.length).toBeGreaterThan(0);
    expect(result.repairCalls.length).toBeLessThanOrEqual(3);
    expect(JSON.parse(result.drafts[2].correct_answer).calculation_checks[0].inputs[0].resource_ref.field).toBe('table_data');
    const publication = await boundaryHandler('publish-exam', result.drafts, 'short_practice', 'paper_1', f.snapshot);
    const response = await publication.run({ draftId: 'exam' });
    expect(response.status, await response.clone().text()).toBe(422);
    expect(publication.writes.some(write => write.table === 'exam_questions')).toBe(false);
  });

  it('cannot certify a different selected public datum by rebinding valid evidence from the original alias', () => {
    const key = graphKey();
    key.calculation_checks[0].inputs[0].resource_ref.field = 'chart_data';
    const selected = graph();
    selected.datasets[0].data[2].y = 8;
    const storedKey = physicsPrivateKeyForStorage({ chart_data: graph(), correct_answer: key }, selected);
    expect(JSON.parse(String(storedKey)).calculation_checks[0].inputs[0].resource_ref.field).toBe('chart_data');
    const issues = physicsCalculationIssues({
      question_text: baseTasks()[2].task, correct_answer: storedKey, diagram_config: selected,
    });
    expect(issues.some(issue => issue.code === 'invalid_calculation')).toBe(true);
    expect(issues.some(issue => issue.code === 'unverified_calculation')).toBe(true);
  });

  it('does not complete extraction when the validated repair was refused by draft storage', async () => {
    const f = await fixture();
    const result = await extract({ mutate: rows => { rows[0].chart_data = null; },
      repair: () => repairs(f, 0), rejectRepairSave: true,
    }, 'short_practice', 'paper_1', f);
    expect(String(result.error)).toContain('Repair save failed');
    expect(result.exam.extraction_status).not.toBe('completed');
    expect(result.repairCalls).toHaveLength(1);
    expect(result.drafts[0].diagram_config).toBeNull();
  });

  it('carries the complete Physics allocation and earlier public tasks across the real parent-batch boundary', async () => {
    const f = await fixture(true);
    const result = await extract(false, 'short_practice', 'paper_1', f);
    expect(String(result.error ?? '')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.generationCalls).toHaveLength(2);
    expect(result.repairCalls).toHaveLength(0);
    const later = prompt(result.generationCalls[1]);
    expect(later).toContain('ALREADY WRITTEN');
    expect(later).toContain('Explain the direction of friction');
    expect(later).toContain('"topic":"Mechanics","marks":2');
    expect(later).toContain('"topic":"Gravitation","marks":2');
    expect(later).not.toContain('Power = 12.0 V');
    expect(result.drafts.map(row => [row.question_number, row.marks, row.topic_tag])).toEqual(f.plan.parts.map(part => [part.questionNumber, part.marks, part.topic]));
  });
});
