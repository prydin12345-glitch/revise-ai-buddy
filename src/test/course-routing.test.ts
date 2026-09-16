import { describe, expect, it } from 'vitest';
import { getCourseCapability, getAssessmentTierOptions } from '@/lib/assessment-tier';
import { buildPaperPlan, supportsBiologyPaperContract } from '@/lib/biology-paper-contract';
import { resolveProfileContext } from '@/lib/profile-context';
import { getCourseCapability as serverCourse } from '../../supabase/functions/_shared/assessment-tier.ts';

const lookup = { subject: 'Biology', examBoard: 'AQA', educationalTier: 'GCSE' };
const guided = (value: typeof lookup) => supportsBiologyPaperContract({ ...value, educationalLevel: value.educationalTier });
describe('custom names, tier choices and structure use one course registry', () => {
  it('recognises supported decorated Biology names in both UI and backend', () => {
    for (const subject of ['Biology', 'biology higher', 'Biology (Foundation)', 'AQA GCSE Biology - Higher', 'Biology Paper 1', 'Biology (single science)']) {
      const value = { ...lookup, subject };
      expect(getCourseCapability(value)?.id).toBe('aqa_gcse_biology');
      expect(serverCourse(value)).toEqual(getCourseCapability(value));
      expect(getAssessmentTierOptions(value)).toEqual(['foundation', 'higher']);
      expect(guided(value)).toBe(true);
    }
  });
  it('does not classify every name containing the letters biology as GCSE Biology', () => {
    for (const subject of ['Microbiology', 'Molecular Biology', 'Combined Science Biology', 'Biology and Chemistry']) {
      expect(getCourseCapability({ ...lookup, subject })).toBeNull();
      expect(guided({ ...lookup, subject })).toBe(false);
    }
  });
  it('keeps unsupported boards and qualifications out of the AQA paper plan', () => {
    expect(guided({ ...lookup, examBoard: 'OCR' })).toBe(false);
    expect(guided({ ...lookup, examBoard: 'Oxford AQA' })).toBe(false);
    expect(guided({ ...lookup, educationalTier: 'A Level' })).toBe(false);
    expect(guided({ ...lookup, educationalTier: 'ks4' })).toBe(true);
  });
  it('uses explicit Foundation even when a custom subject is called Biology Higher', () => {
    const context = resolveProfileContext({ subjectName: 'Biology Higher', profile: { id: 'p', exam_board: 'AQA', educational_tier: 'GCSE', assessment_tier: 'foundation' } });
    expect(context.assessmentTier).toBe('foundation');
    expect(buildPaperPlan('full_mock', context.assessmentTier as 'foundation')?.tier).toBe('foundation');
    expect(resolveProfileContext({ subjectName: 'Biology Higher', manualExamBoard: 'AQA', manualEducationalTier: 'GCSE' }).assessmentTier).toBeNull();
  });
  it('retains the complete guided structure in both tiers', () => {
    for (const tier of ['foundation', 'higher'] as const) {
      const plan = buildPaperPlan('full_mock', tier)!;
      expect(plan.totalMarks).toBe(100);
      expect(plan.durationMinutes).toBe(105);
      expect(plan.parts.some(p => p.responseType === 'mcq_single')).toBe(true);
      expect(plan.parts.some(p => p.resource === 'data_table')).toBe(true);
      expect(plan.parts.some(p => p.resource === 'graph')).toBe(true);
    }
  });
});
