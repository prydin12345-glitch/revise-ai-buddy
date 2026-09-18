// Compatibility facade: existing frontend and backend imports keep their paths.
// Versioned paper adapters live in biology-course-packs.ts.
import { getCourseCapability } from './assessment-tier.ts';
import { AQA_BIOLOGY_P1 } from './aqa-biology-contract.ts';
import { getBiologyPaperPack, assertBiologyPlanIntegrity } from './biology-course-packs.ts';
import type { PaperMode, PaperPlan } from './paper-contract-types.ts';

export { BIOLOGY_CONTRACT_VERSION, AQA_BIOLOGY_P1, buildFullMockPlan, buildShortPracticePlan } from './aqa-biology-contract.ts';
export { OCR_GATEWAY_PAPER, gatewayComponent } from './ocr-biology-contract.ts';
export { describePlan } from './paper-contract-types.ts';
export type { PaperMode, PaperPlan, PlannedPart, ResponseType, ResourceKind } from './paper-contract-types.ts';

export function buildPaperPlan(
  mode: PaperMode,
  tier: PaperPlan['tier'],
  courseId: string = AQA_BIOLOGY_P1.courseId,
  paperId?: string | null,
): PaperPlan | null {
  const pack = getBiologyPaperPack(courseId, paperId);
  if (!pack) throw new Error('This course does not have a guided Biology paper yet.');
  if (!['custom', 'short_practice', 'full_mock'].includes(mode)) throw new Error('Unknown Biology paper mode.');
  if (tier !== null && !pack.tiers.includes(tier)) throw new Error('Unsupported Biology assessment tier.');
  const plan = pack.build(mode, tier);
  if (plan) assertBiologyPlanIntegrity(plan, pack);
  return plan;
}

export function supportsBiologyPaperContract(input: {
  subject?: string | null;
  examBoard?: string | null;
  educationalLevel?: string | null;
  courseId?: string | null;
  paperId?: string | null;
}): boolean {
  const course = getCourseCapability({ subject: input.subject, examBoard: input.examBoard,
    educationalTier: input.educationalLevel, courseId: input.courseId });
  return !!course && course.generationAvailable !== false && !!getBiologyPaperPack(course.id, input.paperId);
}

export function biologyPaperDefinition(courseId: string | null, tier: PaperPlan['tier'], paperId?: string | null) {
  return getBiologyPaperPack(courseId, paperId)?.definition(tier) ?? null;
}
