// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {gatewayFixture} from './ocr-fixtures';
import {getAssessmentTierOptions, getCourseCapability, getCourseOptions, OCR_GATEWAY_BIOLOGY_ID as OCR, OCR_21C_BIOLOGY_ID} from '../functions/_shared/assessment-tier';
import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {resolvePaperSelection, paperPlanForAttempt} from '../functions/_shared/course-selection';
import {biologyScopeInstructions, gcseBiologyIssue} from '../functions/_shared/gcse-biology-scope';
import {GATEWAY_HIGHER_ONLY, GATEWAY_SPEC, gatewayMarkingInstructions} from '../functions/_shared/ocr-biology-scope';
import {validateQuestionCandidates, hasAssessedTask, flattenAnswerKey} from '../functions/_shared/question-contract-validator';
import {buildCacheKey} from '../functions/_shared/cache-utils';
import {checkPracticeCourse, gatewayCachedRows, assertGatewayPractice} from '../functions/_shared/ocr-practice';
import {resolveProfileContext, toStoredGenerationContext, establishGenerationContext} from '../functions/_shared/profile-context';
import {buildQuestionRepairPrompt, requestQuestionRepair} from '../functions/_shared/question-repair';

const lookup = {subject: 'Biology Higher', examBoard: 'OCR', educationalTier: 'GCSE'};
const blueprint = {courseSelection: {courseId: OCR, paperId: 'first_paper'},
  paperContract: {courseId: OCR, paperId: 'first_paper', mode: 'full_mock', contractVersion: 1}};
const snapshot = (tier: 'foundation' | 'higher' = 'foundation') => ({resolved_by: 'server', context_version: 2,
  subject_name: lookup.subject, exam_board: 'OCR', educational_tier: 'GCSE', course_id: OCR,
  assessment_tier: tier, paper_id: 'first_paper', component_code: tier === 'foundation' ? 'J247/01' : 'J247/03', paper_contract: blueprint.paperContract});
const scope = (tier: 'foundation' | 'higher') => ({...lookup, educationalLevel: 'GCSE', courseId: OCR, paperId: 'first_paper', assessmentTier: tier});

const gate = (rows: any[], tier: 'foundation' | 'higher' = 'foundation') => {
  const plan = buildPaperPlan('full_mock', tier, OCR)!;
  return validateQuestionCandidates(rows, {plan, scope: scope(tier), expectedTotalMarks: plan.totalMarks, expectedPartCount: plan.partCount});
};
describe('explicit OCR course selection', () => {
  it.each(['Biology', 'Biology Higher', 'OCR GCSE Biology - Foundation', 'Biology Paper 1', 'Gateway Biology A'])('recognises %s without guessing course or tier', subject => {
    expect(getCourseOptions({...lookup, subject})).toHaveLength(2);
    expect(getCourseCapability({...lookup, subject})).toBeNull();
    expect(getAssessmentTierOptions({...lookup, subject, courseId: OCR})).toEqual(['foundation', 'higher']);
  });
  it('excludes combined science, unrelated boards and A level', () => {
    for (const values of [{subject: 'Combined Science Biology'}, {examBoard: 'Edexcel'}, {educationalTier: 'A Level'}, {subject: 'Microbiology'}])
      expect(getCourseCapability({...lookup, courseId: OCR, ...values})).toBeNull();
  });
  it('requires explicit route, first paper and tier', () => {
    expect(() => resolvePaperSelection(lookup, null, null)).toThrow(/course/);
    expect(() => resolvePaperSelection(lookup, null, blueprint)).toThrow(/Foundation or Higher/);
    expect(() => resolvePaperSelection(lookup, 'higher', {courseSelection: {courseId: OCR}})).toThrow(/paper/);
  });
  it('keeps Gateway second papers blocked and resolves J257 separately', () => {
    expect(resolvePaperSelection(lookup, 'higher', {courseSelection: {courseId: OCR_21C_BIOLOGY_ID, paperId: 'breadth'}}).componentCode).toBe('J257/03');
    expect(() => resolvePaperSelection(lookup, 'higher', {...blueprint, courseSelection: {courseId: OCR, paperId: 'second_paper'}})).toThrow(/not available/);
  });
  it('rejects stale AQA presets and stale contract versions', () => {
    expect(() => resolvePaperSelection(lookup, 'higher', {...blueprint, paperContract: {...blueprint.paperContract, courseId: 'aqa_gcse_biology_8461'}})).toThrow(/disagree/);
    expect(() => resolvePaperSelection(lookup, 'higher', {...blueprint, paperContract: {...blueprint.paperContract, contractVersion: 99}})).toThrow(/Reapply/);
  });
  it('maps tiers to different components of the same syllabus', () => {
    expect(resolvePaperSelection(lookup, 'foundation', blueprint).componentCode).toBe('J247/01');
    expect(resolvePaperSelection(lookup, 'higher', blueprint).componentCode).toBe('J247/03');
  });
});
describe('OCR immutable attempt routing', () => {
  it('uses only the server snapshot even if client metadata requests AQA', () => {
    expect(paperPlanForAttempt(snapshot(), {paperContract: {courseId: 'aqa_gcse_biology_8461'}})?.totalMarks).toBe(90);
    expect(() => paperPlanForAttempt({...snapshot(), component_code: 'J247/03'})).toThrow(/component/);
  });
  it('refuses forged markers and ambiguous legacy OCR in quizzes', () => {
    expect(() => paperPlanForAttempt({...snapshot(), resolved_by: 'client'}, blueprint)).toThrow(/server/);
    expect(() => checkPracticeCourse({...snapshot(), context_version: 1, course_id: null})).toThrow(/fresh attempt/);
  });
  it('preserves legacy AQA contexts', () => {
    const context = {...snapshot(), context_version: 1, exam_board: 'AQA', course_id: 'aqa_gcse_biology'};
    const legacy = {paperContract: {courseId: 'aqa_gcse_biology_8461', paperId: 'paper_1', mode: 'full_mock', contractVersion: 1}};
    delete (context as any).paper_id;
    expect(paperPlanForAttempt(context, legacy)?.totalMarks).toBe(100);
  });
  it('resolves owned OCR profiles and freezes the paper selection on retry', async () => {
    const profile = {id: 'p1', user_id: 'owner', subject_name: lookup.subject, exam_board: 'OCR', educational_tier: 'GCSE', assessment_tier: 'foundation', paper_blueprint: blueprint};
    const filters: Record<string, unknown> = {};
    const client = {from: () => {const q: any = {select: () => q, eq: (key: string, value: unknown) => {filters[key] = value; return q;}, maybeSingle: async () => ({data: filters.user_id === 'owner' ? profile : null, error: null})}; return q;}};
    const resolved = await resolveProfileContext(client, {userId: 'owner', subjectName: 'Biology', profileId: 'p1', examBoard: 'AQA', assessmentTier: 'higher'});
    const context = toStoredGenerationContext(resolved);
    expect(context.component_code).toBe('J247/01');
    expect(context.paper_contract).toEqual(blueprint.paperContract);
    const retry = await establishGenerationContext({from: () => {throw new Error('Profile should not be reread');}}, 'set', 'owner', {profile_id: 'p1', generation_context: context});
    expect(retry).toEqual(context);
    await expect(resolveProfileContext(client, {userId: 'stranger', subjectName: 'Biology', profileId: 'p1'})).rejects.toThrow(/not found/);
  });
});
describe.each(['foundation', 'higher'] as const)('Gateway %s contract', tier => {
  it('matches official totals and sections while keeping the internal template explicit', () => {
    const {plan, rows} = gatewayFixture(tier);
    expect(plan.totalMarks).toBe(90); expect(plan.durationMinutes).toBe(105);
    expect(plan.parts.filter(p => p.section === 'A')).toHaveLength(15);
    expect(plan.parts.filter(p => p.section === 'B').reduce((n, p) => n + p.marks, 0)).toBe(75);
    expect(plan.parts.filter(p => p.marks === 6)).toHaveLength(1);
    expect(plan.parts.filter(p => p.demand === 'AO1').reduce((n,p) => n+p.marks,0)).toBe(36);
    expect(plan.parts.filter(p => p.demand === 'AO2').reduce((n,p) => n+p.marks,0)).toBe(36);
    expect(plan.parts.reduce((n,p) => n+(p.mathsMarks ?? 0),0)).toBeGreaterThanOrEqual(9);
    expect(plan.parts.reduce((n,p) => n+(p.practicalMarks ?? 0),0)).toBeGreaterThanOrEqual(14);
    expect(gate(rows,tier).defects).toEqual([]);
    for (const part of plan.parts) for (const ref of part.specRefs ?? []) {
      expect(GATEWAY_SPEC[ref]).toBeTruthy();
      if (tier === 'foundation') expect(GATEWAY_HIGHER_ONLY.has(ref)).toBe(false);
    }
  });
  it('builds a labelled short practice without pretending it is a 90-mark paper', () => {
    const plan = buildPaperPlan('short_practice', tier, OCR)!;
    expect(plan.partCount).toBe(8); expect(plan.totalMarks).toBe(20); expect(plan.durationMinutes).toBe(25);
    expect(plan.label).toContain('short practice');
  });
});
describe('OCR gate and syllabus separation', () => {
  it('blocks missing, duplicate, extra and differently marked parts rather than relabelling', () => {
    const {rows} = gatewayFixture();
    for (const bad of [rows.slice(1), [...rows, rows[0]], rows.map((r,i) => i === 1 ? {...r, marks: 2} : r)])
      expect(gate(bad).defects.some(d => d.code === 'plan_mismatch')).toBe(true);
  });
  it('blocks missing resources, incomplete tasks and missing level schemes', () => {
    const {rows} = gatewayFixture();
    expect(gate(rows.map(r => ({...r, diagram_config: null}))).defects.some(d => d.code === 'missing_required_resource')).toBe(true);
    expect(gate(rows.map((r,i) => i ? r : {...r, question_text: 'The student recorded these results.'})).defects.some(d => d.code === 'missing_task')).toBe(true);
    expect(gate(rows.map(r => r.marks === 6 ? {...r, correct_answer: 'Three correct facts.'} : r)).defects.some(d => d.code === 'missing_answer')).toBe(true);
  });
  it('requires four distinct choices and the correct response type', () => {
    const {rows} = gatewayFixture();
    expect(gate(rows.map((r,i) => i ? r : {...r, options: ['A','B','C']})).ok).toBe(false);
    expect(gate(rows.map((r,i) => i ? r : {...r, question_type: 'short_answer'})).ok).toBe(false);
  });
  it('allows OCR ATP/two-stage photosynthesis, not A-level pathways', () => {
    expect(gcseBiologyIssue({question_text: 'Describe how light-dependent and light-independent stages produce glucose. State the role of ATP in respiration.'}, scope('foundation'))).toBeNull();
    expect(gcseBiologyIssue({question_text: 'Explain the Calvin cycle.'}, scope('higher'))).toContain('A-level');
    expect(gcseBiologyIssue({question_text: 'Describe the light-dependent stage.'}, {...scope('higher'), courseId: 'aqa_gcse_biology', examBoard: 'AQA'})).toContain('A-level');
    expect(biologyScopeInstructions(scope('higher'))).toContain('B3 Organism level systems');
  });
  it('allows Higher protein synthesis but blocks it on Foundation; keeps basic insulin', () => {
    expect(gcseBiologyIssue({question_text: 'Explain transcription and translation.'}, scope('higher'))).toBeNull();
    expect(gcseBiologyIssue({question_text: 'Explain transcription and translation.'}, scope('foundation'))).toContain('Higher-only');
    expect(gcseBiologyIssue({question_text: 'Explain how insulin lowers blood glucose.'}, scope('foundation'))).toBeNull();
    expect(gatewayMarkingInstructions(snapshot('higher'))).toContain('holistic best fit');
  });
  it('applies the same checks to a cached quiz and preserves linked order and MCQ keys', () => {
    const {rows} = gatewayFixture();
    assertGatewayPractice(rows, snapshot());
    expect(() => assertGatewayPractice([{...rows[0], question_text: 'Describe the Calvin cycle.'}], snapshot())).toThrow(/quality/);
    const rebound = gatewayCachedRows(rows, 'new-set', 'profile');
    expect(rebound[0].id).toBeUndefined(); expect(rebound[0].set_id).toBe('new-set');
    expect(rebound.map(r => r.question_number)).toEqual(rows.map(r => r.question_number));
    expect(rebound[0].options).toEqual(rows[0].options); expect(rebound[0].correct_answer).toBe('A');
  });
  it('keeps the level scheme and course scope in repair prompts and rejects incomplete repairs', async () => {
    const {plan,rows} = gatewayFixture(); const row = rows.at(-1)!;
    const input = {group: [row], subject: 'Biology', scope: scope('foundation'), plan, defects: 'missing scheme', mode: 'full_group' as const, targetNumbers: new Set([row.question_number])};
    const prompt = buildQuestionRepairPrompt(input);
    expect(prompt).toContain('Level 3 (5–6)'); expect(prompt).toContain('B3.3g');
    const response = {choices: [{finish_reason: 'stop', message: {content: JSON.stringify({parts: [{question_number: row.question_number, task: 'Explain temperature control.', correct_answer: 'Sweating cools the body.'}]})}}]};
    const result = await requestQuestionRepair(input, 'test', async () => new Response(JSON.stringify(response)));
    expect(result.ok).toBe(false); expect(result.phase).toBe('validation');
  });
  it('separates board, tier, paper and contract revision in cache identity', async () => {
    const base = {subject:'Biology', examBoard:'OCR', educationalLevel:'GCSE', assessmentTier:'foundation', topics:['B1'], difficulty:'mixed', questionFormat:'mixed', questionCount:8, courseId:OCR, paperId:'first_paper', presetVersion:1, resourceVersion:'ocr-gateway-1'};
    const keys = await Promise.all([base, {...base,assessmentTier:'higher'}, {...base,paperId:'second_paper'}, {...base,presetVersion:2}, {...base,courseId:OCR_21C_BIOLOGY_ID}, {...base,examBoard:'AQA'}].map(buildCacheKey));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('repair acceptance regressions', () => {
  it('accepts an adverb-led instruction', () => {
    expect(hasAssessedTask('Briefly outline the two main stages of photosynthesis.')).toBe(true);
  });
  it('flattens a structured level-of-response key', () => {
    const key = flattenAnswerKey({level_1: 'Simple statements', level_2: 'Links ideas', level_3: 'Full explanation'});
    [1, 2, 3].forEach(n => expect(new RegExp(`level\\s*${n}`, 'i').test(key)).toBe(true));
  });
});
