// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import baseline from './fixtures/biology-v1-baseline.json';
import { buildPaperPlan, biologyPaperDefinition, supportsBiologyPaperContract, type PaperMode, type PaperPlan } from '../functions/_shared/biology-paper-contract.ts';
import { BIOLOGY_PAPER_PACKS, getBiologyPaperPack, biologyPlanInstructions, assertBiologyPlanIntegrity } from '../functions/_shared/biology-course-packs.ts';
import { paperPlanForAttempt, resolvePaperSelection } from '../functions/_shared/course-selection.ts';
import { validateQuestionCandidates } from '../functions/_shared/question-contract-validator.ts';
import { biologyScopeInstructions, gcseBiologyIssue } from '../functions/_shared/gcse-biology-scope.ts';
import { OCR_GATEWAY_BIOLOGY_ID as OCR, OCR_21C_BIOLOGY_ID } from '../functions/_shared/assessment-tier.ts';
import { gatewayFixture } from './ocr-fixtures.ts';

const hash = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const aqa = 'aqa_gcse_biology_8461';

describe('Biology adapters preserve the installed version-1 contracts', () => {
  it.each(baseline.cases)('$courseId / $tier / $mode is byte-equivalent to the pre-refactor plan and prompt', row => {
    const tier = row.tier as PaperPlan['tier'];
    const plan = buildPaperPlan(row.mode as PaperMode, tier, row.courseId)!;
    expect(hash(plan)).toBe(row.planHash);
    expect(hash(biologyPaperDefinition(row.courseId, tier))).toBe(row.definitionHash);
    expect(hash(biologyPlanInstructions(plan))).toBe(row.promptHash);
  });

  it.each(baseline.cases)('$courseId / $tier / $mode survives profile-to-server-snapshot routing', row => {
    const tier = row.tier as 'foundation' | 'higher';
    const board = row.courseId === OCR ? 'OCR' : 'AQA';
    const pack = getBiologyPaperPack(row.courseId)!;
    const contract = { courseId: row.courseId, paperId: pack.paperId, mode: row.mode, contractVersion: 1 };
    const selection = resolvePaperSelection({ subject: 'Biology Higher', examBoard: board, educationalTier: 'GCSE' }, tier, { paperContract: contract });
    const plan = paperPlanForAttempt({ resolved_by: 'server', context_version: 2, subject_name: 'Biology Higher', exam_board: board,
      educational_tier: 'GCSE', assessment_tier: tier, course_id: selection.courseId, paper_id: selection.paperId,
      component_code: selection.componentCode, paper_contract: selection.paperContract });
    expect(hash(plan)).toBe(row.planHash);
  });

  it('keeps historical AQA aliases and unknown-tier plan reads compatible', () => {
    expect(buildPaperPlan('full_mock', 'higher', 'aqa_gcse_biology')).toEqual(buildPaperPlan('full_mock', 'higher', aqa));
    expect(buildPaperPlan('full_mock', null, aqa)?.tier).toBeNull();
    expect(() => resolvePaperSelection({ subject: 'Biology Higher', examBoard: 'AQA', educationalTier: 'GCSE' }, null,
      { paperContract: { courseId: aqa, paperId: 'paper_1', mode: 'full_mock', contractVersion: 1 } })).toThrow(/Foundation or Higher/);
  });

  it('does not enable unavailable papers, qualifications or courses', () => {
    for (const course of [OCR_21C_BIOLOGY_ID, 'edexcel_gcse_biology', 'unknown']) {
      expect(getBiologyPaperPack(course)).toBeNull();
      expect(() => buildPaperPlan('full_mock', 'foundation', course)).toThrow();
    }
    expect(getBiologyPaperPack(OCR, 'second_paper')).toBeNull();
    expect(getBiologyPaperPack(aqa, 'paper_3')).toBeNull();
    expect(() => buildPaperPlan('full_mock', 'foundation', OCR, 'second_paper')).toThrow();
    expect(supportsBiologyPaperContract({ subject: 'Biology', examBoard: 'AQA', educationalLevel: 'A Level', courseId: aqa })).toBe(false);
    expect(supportsBiologyPaperContract({ subject: 'Combined Science', examBoard: 'AQA', educationalLevel: 'GCSE' })).toBe(false);
  });

  it('rejects unknown versions, invalid modes and invalid tiers instead of selecting a fallback', () => {
    expect(getBiologyPaperPack(OCR, 'first_paper', 999)).toBeNull();
    expect(() => biologyPlanInstructions({ ...buildPaperPlan('full_mock', 'higher', OCR)!, contractVersion: 999 })).toThrow(/version/);
    expect(() => buildPaperPlan('full_mock', 'banana' as any, aqa)).toThrow(/tier/);
    expect(() => buildPaperPlan('banana' as any, 'foundation', aqa)).toThrow(/mode/);
  });

  it.each([aqa, OCR])('%s leaves Custom outside the guided template', course => {
    expect(buildPaperPlan('custom', 'foundation', course)).toBeNull();
  });
});

describe('template integrity before paid generation', () => {
  it.each([
    ['duplicate identity', (p: PaperPlan) => { p.parts[1].partId = p.parts[0].partId; }],
    ['wrong topic', (p: PaperPlan) => { p.parts[0].topic = 'Ecology from another paper'; }],
    ['incorrect declared total', (p: PaperPlan) => { p.totalMarks++; }],
    ['missing resource identity', (p: PaperPlan) => { p.parts.find(x => x.resource !== 'none')!.resourceId = undefined; }],
    ['wrong component', (p: PaperPlan) => { p.componentCode = 'J247/04'; }],
    ['bad section split', (p: PaperPlan) => { p.parts[0].section = 'B'; }],
  ] as const)('rejects %s', (_name, mutate) => {
    const plan = buildPaperPlan('full_mock', 'foundation', OCR)!;
    mutate(plan);
    expect(() => assertBiologyPlanIntegrity(plan)).toThrow(/Invalid Biology template/);
  });

  it('every enabled pack records provenance separately from its layout choices', () => {
    for (const pack of BIOLOGY_PAPER_PACKS) {
      expect(pack.sources.every(source => source.url.startsWith('https://') && source.section && source.checkedOn)).toBe(true);
      expect(pack.layoutChoices.length).toBeGreaterThan(0);
      expect(pack.definition('foundation').fullMockMarks).toBe(pack.official.fullMarks);
    }
  });
});

describe('shared gate retains course-specific behaviour', () => {
  it.each(['foundation', 'higher'] as const)('still rejects an OCR %s part with lost choices or a lost level scheme', tier => {
    const { plan, rows } = gatewayFixture(tier);
    rows[0].options = null;
    rows.find(row => row.question_number === '24(b)')!.correct_answer = 'Only a model answer.';
    const result = validateQuestionCandidates(rows, { plan });
    expect(result.ok).toBe(false);
    expect(result.defects.some(d => d.code === 'invalid_options')).toBe(true);
    expect(result.defects.some(d => d.code === 'missing_answer')).toBe(true);
  });

  it('retains the difference between AQA and OCR photosynthesis scope', () => {
    const scope = { subject: 'Biology', educationalLevel: 'GCSE', assessmentTier: 'foundation' as const };
    const question = { question_text: 'Outline the light-dependent stage in a simple two-stage account.' };
    expect(gcseBiologyIssue(question, { ...scope, examBoard: 'AQA', courseId: aqa })).not.toBeNull();
    expect(gcseBiologyIssue(question, { ...scope, examBoard: 'OCR', courseId: OCR })).toBeNull();
    expect(biologyScopeInstructions({ ...scope, examBoard: 'OCR', courseId: OCR })).toContain('two-stage');
  });
});
