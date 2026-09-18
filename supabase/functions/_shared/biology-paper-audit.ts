// Offline audit entry points. No model calls, database client or student data reads.
import { BIOLOGY_PAPER_PACKS, assertBiologyPlanIntegrity, getBiologyPaperPack, type BiologyPaperPack } from './biology-course-packs.ts';
import { validateQuestionCandidates, type CandidatePart } from './question-contract-validator.ts';
import type { PaperPlan } from './paper-contract-types.ts';

function identity(pack: BiologyPaperPack, plan: PaperPlan) {
  return { packId: pack.id, courseId: plan.courseId, paperId: plan.paperId, contractVersion: plan.contractVersion,
    tier: plan.tier, mode: plan.mode, componentCode: plan.componentCode ?? null };
}

/** Inventory is computed from registered adapters, never another hardcoded course list. */
export function auditBiologyTemplates() {
  return BIOLOGY_PAPER_PACKS.flatMap(pack => pack.tiers.flatMap(tier => (['short_practice', 'full_mock'] as const).map(mode => {
    const plan = pack.build(mode, tier);
    if (!plan) throw new Error(`Missing guided plan for ${pack.id}`);
    assertBiologyPlanIntegrity(plan, pack);
    return { ...identity(pack, plan), status: 'template_checked', parts: plan.partCount, parents: plan.parentCount,
      marks: plan.totalMarks, minutes: plan.durationMinutes,
      mcqs: plan.parts.filter(p => p.responseType === 'mcq_single').length,
      tables: plan.parts.filter(p => p.resource === 'data_table').length,
      graphs: plan.parts.filter(p => p.resource === 'graph').length,
      // Missing annotations are unknown, not zero mathematical/practical content.
      annotatedMathsMarks: plan.parts.some(p => p.mathsMarks !== undefined) ? plan.parts.reduce((n, p) => n + (p.mathsMarks ?? 0), 0) : null,
      annotatedPracticalMarks: plan.parts.some(p => p.practicalMarks !== undefined) ? plan.parts.reduce((n, p) => n + (p.practicalMarks ?? 0), 0) : null,
      rowValidation: pack.validation.rows, sources: pack.sources, layoutChoices: pack.layoutChoices,
      realPaperGenerated: false, externalRating: null,
    };
  })));
}

export interface BiologyDraftAuditInput {
  courseId: string;
  paperId: string;
  contractVersion: number;
  tier: 'foundation' | 'higher';
  mode: 'full_mock' | 'short_practice';
  /** Saved canonical draft rows, including private correct_answer and resources. */
  questions: CandidatePart[];
}

/** Does not grant publishing permission or certify correctness of the science. */
export function auditBiologyDraft(input: BiologyDraftAuditInput) {
  if (!input || typeof input.courseId !== 'string' || typeof input.paperId !== 'string' || !Number.isInteger(input.contractVersion)) {
    throw new Error('The draft audit requires an explicit course, paper and contract version.');
  }
  const pack = getBiologyPaperPack(input.courseId, input.paperId, input.contractVersion);
  if (!pack) throw new Error('The requested Biology course/paper/version is unavailable.');
  if (!pack.tiers.includes(input.tier) || !['full_mock', 'short_practice'].includes(input.mode)) throw new Error('A draft audit requires an explicit supported tier and guided mode.');
  if (!Array.isArray(input.questions) || input.questions.some(q => !q || typeof q !== 'object' || Array.isArray(q))) throw new Error('questions must be an array of canonical draft rows.');
  const plan = pack.build(input.mode, input.tier)!;
  assertBiologyPlanIntegrity(plan, pack);
  const result = validateQuestionCandidates(input.questions, { plan, expectedTotalMarks: plan.totalMarks, expectedPartCount: plan.partCount,
    scope: { subject: 'Biology', examBoard: pack.examBoard, educationalLevel: pack.curriculum.qualification,
      courseId: pack.courseId, paperId: pack.paperId, componentCode: plan.componentCode ?? null, assessmentTier: input.tier } });
  return { ...identity(pack, plan), status: result.ok ? 'automated_checks_passed_review_required' : 'blocked',
    expectedParts: plan.partCount, expectedMarks: plan.totalMarks, defects: result.defects,
    reviewRequired: ['Scientific accuracy and answer/mark-scheme agreement', 'Board and tier coverage beyond deterministic flags', 'Rendered paper and resource readability'],
    externalRating: null, sources: pack.sources };
}
