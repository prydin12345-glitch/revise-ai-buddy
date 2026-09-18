import { canonicalCourseId, getCourseCapability, getCourseOptions, OCR_GATEWAY_BIOLOGY_ID,
  type AssessmentTier, type CourseLookup } from './assessment-tier.ts';
import { biologyPaperDefinition, buildPaperPlan, type PaperMode } from './biology-paper-contract.ts';

export interface SavedPaperContract { courseId: string; paperId: string; mode: PaperMode; contractVersion: number; }
export interface ResolvedPaperSelection {
  courseId: string | null;
  paperId: string | null;
  componentCode: string | null;
  paperContract: SavedPaperContract | null;
}
const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};

/** Uses the existing paper_blueprint JSON column; no new database columns. */
export function profileCourseId(blueprint: unknown): string | null {
  const bp = object(blueprint);
  const value = object(bp.courseSelection).courseId ?? object(bp.paperContract).courseId;
  return typeof value === 'string' ? canonicalCourseId(value) : null;
}

/** Validate the configuration read from an OWNED profile, not request metadata. */
export function resolvePaperSelection(lookup: CourseLookup, tier: AssessmentTier | null, blueprint: unknown): ResolvedPaperSelection {
  const bp = object(blueprint);
  const choice = object(bp.courseSelection);
  const contract = object(bp.paperContract);
  const selected = profileCourseId(bp);
  const course = getCourseCapability({ ...lookup, courseId: selected });
  if (selected && !course) throw new Error('The saved course does not match this subject, board and qualification.');
  if (!selected && getCourseOptions(lookup).length > 1) throw new Error('Select your OCR Biology course and paper in an exam profile before generating.');
  if (course?.generationAvailable === false) throw new Error('This OCR Biology course is not available for generation yet.');
  if (choice.courseId && contract.courseId && canonicalCourseId(choice.courseId) !== canonicalCourseId(contract.courseId)) {
    throw new Error('The saved course selection and paper preset disagree. Reapply the correct preset.');
  }
  const paperId = choice.paperId ?? contract.paperId ?? null;
  const definition = biologyPaperDefinition(course?.id ?? null, tier === 'foundation' || tier === 'higher' ? tier : null, paperId);
  if (paperId && (!definition || paperId !== definition.paperId)) throw new Error('This paper preset is not available for the selected course.');
  if (choice.paperId && contract.paperId && choice.paperId !== contract.paperId) throw new Error('The saved paper selections disagree.');
  if (course?.id === OCR_GATEWAY_BIOLOGY_ID) {
    if (!paperId) throw new Error('Select the OCR Gateway first paper in your profile.');
    if (tier !== 'foundation' && tier !== 'higher') throw new Error('Select and save Foundation or Higher in your OCR profile.');
  }
  let resolvedContract: SavedPaperContract | null = null;
  if (Object.keys(contract).length) {
    if (!definition || !['full_mock', 'short_practice', 'custom'].includes(contract.mode)) throw new Error('The saved paper preset is invalid.');
    if (contract.contractVersion !== definition.contractVersion || contract.paperId !== definition.paperId) throw new Error('Reapply the supported paper preset before generating.');
    if (canonicalCourseId(contract.courseId) !== course?.id) throw new Error('The saved paper preset belongs to a different course.');
    if (contract.mode !== 'custom' && tier !== 'foundation' && tier !== 'higher') throw new Error('Select Foundation or Higher before generating a guided paper.');
    resolvedContract = {courseId: definition.courseId, paperId: definition.paperId, mode: contract.mode, contractVersion: definition.contractVersion};
  }
  return {courseId: course?.id ?? null, paperId, componentCode: paperId ? definition?.componentCode ?? null : null, paperContract: resolvedContract};
}

/** v2 snapshots freeze the profile preset at attempt creation. Legacy AQA
 * attempts may use their existing format; legacy OCR is never guessed. */
export function paperPlanForAttempt(context: any, legacyBlueprint?: unknown) {
  if (!context || context.resolved_by !== 'server' || ![1, 2].includes(context.context_version)) {
    if (Object.keys(object(object(legacyBlueprint).paperContract)).length) throw new Error('A saved server course context is required for guided generation.');
    return null;
  }
  const legacy = context.context_version === 1;
  if (legacy && String(context.exam_board ?? '').toLowerCase().includes('ocr') && /biology/i.test(context.subject_name ?? '')) {
    throw new Error('Create a fresh attempt from an OCR profile with its course, paper and tier saved.');
  }
  const contract = legacy ? object(legacyBlueprint).paperContract : context.paper_contract;
  if (!contract) return null;
  const selection = resolvePaperSelection({subject: context.subject_name, examBoard: context.exam_board,
    educationalTier: context.educational_tier}, context.assessment_tier, {
    courseSelection: {courseId: context.course_id, paperId: context.paper_id ?? contract.paperId}, paperContract: contract,
  });
  if (!legacy && context.component_code !== selection.componentCode) throw new Error('Saved component and assessment tier do not match.');
  return buildPaperPlan(contract.mode, context.assessment_tier, contract.courseId, contract.paperId);
}

export function describeCourseSelection(selection: ResolvedPaperSelection): string {
  return [selection.componentCode, selection.courseId === OCR_GATEWAY_BIOLOGY_ID ? 'Gateway Biology A' : null].filter(Boolean).join(' · ');
}
