import { parseResponseFormatPolicy, type ResponseFormatPolicy } from './response-format-policy.ts';
import {OCR_ALEVEL_BIOLOGY_ID} from './assessment-tier.ts';
import {OCR_ALEVEL_BIOLOGY_SPECIFICATION} from './ocr-alevel-biology-scope.ts';
import { canonicalCourseId, getCourseCapability, getCourseOptions, OCR_GATEWAY_BIOLOGY_ID, OCR_21C_BIOLOGY_ID, EDEXCEL_BIOLOGY_ID, WJEC_BIOLOGY_ID,
  type AssessmentTier, type CourseLookup } from './assessment-tier.ts';
import { biologyPaperDefinition, buildPaperPlan, type PaperMode } from './biology-paper-contract.ts';

import {WJEC_BIOLOGY_SPECIFICATION} from './wjec-biology-specification.ts';
import { AQA_ALEVEL_BIOLOGY_ID } from './assessment-tier.ts';
import { AQA_ALEVEL_BIOLOGY_SPECIFICATION } from './aqa-alevel-biology-scope.ts';
import type { CurriculumIdentity } from './curriculum-identity.ts';

export interface SavedPaperContract { courseId: string; paperId: string; mode: PaperMode; contractVersion: number; specificationVersion?: string; }
export interface ResolvedPaperSelection {
  responseFormats?: ResponseFormatPolicy;
  courseId: string | null;
  paperId: string | null;
  componentCode: string | null;
  paperContract: SavedPaperContract | null;
  specificationVersion?: string;
  curriculum?: CurriculumIdentity;
}
const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};

/** Uses the existing paper_blueprint JSON column; no new database columns. */
export function profileCourseId(blueprint: unknown): string | null {
  const bp = object(blueprint);
  const value = object(bp.courseSelection).courseId ?? object(bp.paperContract).courseId;
  return typeof value === 'string' ? canonicalCourseId(value) : null;
}

export function profilePaperId(blueprint: unknown): string | null {
  const bp = object(blueprint);
  const value = object(bp.courseSelection).paperId ?? object(bp.paperContract).paperId;
  return typeof value === 'string' ? value : null;
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
  const definition = biologyPaperDefinition(course?.id ?? null, tier, paperId, Object.keys(contract).length ? contract.contractVersion : undefined);
  if (Object.keys(contract).length && !definition && biologyPaperDefinition(course?.id ?? null, tier, paperId)) throw new Error('Reapply the supported paper preset before generating.');
  if (paperId && (!definition || paperId !== definition.paperId)) throw new Error('This paper preset is not available for the selected course.');
  if (choice.paperId && contract.paperId && choice.paperId !== contract.paperId) throw new Error('The saved paper selections disagree.');
  if (course?.id === 'aqa_gcse_biology' && paperId === 'paper_2' && tier !== 'foundation' && tier !== 'higher') {
    throw new Error('Select and save Foundation or Higher in your AQA Paper 2 profile.');
  }
  if (course?.id === OCR_GATEWAY_BIOLOGY_ID) {
    if (!paperId) throw new Error('Select the OCR Gateway first paper in your profile.');
    if (tier !== 'foundation' && tier !== 'higher') throw new Error('Select and save Foundation or Higher in your OCR profile.');
  }
  if (course?.id === OCR_21C_BIOLOGY_ID) {
    if (!paperId) throw new Error('Select and save Breadth or Depth in your OCR Biology B profile.');
    if (tier !== 'foundation' && tier !== 'higher') throw new Error('Select and save Foundation or Higher in your OCR Biology B profile.');
  }
  if (course?.id === EDEXCEL_BIOLOGY_ID) {
    if (!paperId) throw new Error('Select and save Paper 1 or Paper 2 in your Edexcel Biology profile.');
    if (tier !== 'foundation' && tier !== 'higher') throw new Error('Select and save Foundation or Higher in your Edexcel Biology profile.');
  }
  if(course?.id===WJEC_BIOLOGY_ID){
    if(!paperId)throw new Error('Select and save Unit 1 or Unit 2 in your WJEC Wales Biology profile.');
    if(tier!=='foundation'&&tier!=='higher')throw new Error('Select and save Foundation or Higher for the WJEC written unit.');
    for(const saved of [choice.specificationVersion,contract.specificationVersion])
      if(saved!=null&&saved!==WJEC_BIOLOGY_SPECIFICATION)throw new Error('Reapply the reviewed WJEC written-unit specification version.');
  }
  if(course?.id===OCR_ALEVEL_BIOLOGY_ID){
    if(!paperId)throw new Error('Choose and save OCR A-level Biology A Paper 1, Paper 2 or Paper 3 in your profile.');
    if(tier!=='not_tiered')throw new Error('OCR A-level Biology A is untiered. Reapply its profile settings.');
    for(const saved of [choice.specificationVersion,contract.specificationVersion])
      if(saved!=null&&saved!==OCR_ALEVEL_BIOLOGY_SPECIFICATION)throw new Error('Reapply the reviewed OCR A-level specification version.');
  }
  let resolvedContract: SavedPaperContract | null = null;
  if(course?.id === AQA_ALEVEL_BIOLOGY_ID) {
    if(!paperId)throw new Error('Choose and save AQA A-level Biology Paper 1, Paper 2 or Paper 3 in your profile.');
    if(tier!=='not_tiered')throw new Error('AQA A-level Biology is untiered. Reapply its profile settings.');
    for(const saved of [choice.specificationVersion,contract.specificationVersion])
      if(saved!=null && saved!==AQA_ALEVEL_BIOLOGY_SPECIFICATION)throw new Error('Reapply the reviewed AQA A-level specification version.');
  }
  if (Object.keys(contract).length) {
    if (!definition || !['full_mock', 'short_practice', 'custom'].includes(contract.mode)) throw new Error('The saved paper preset is invalid.');
    if (contract.contractVersion !== definition.contractVersion || contract.paperId !== definition.paperId) throw new Error('Reapply the supported paper preset before generating.');
    if (canonicalCourseId(contract.courseId) !== course?.id) throw new Error('The saved paper preset belongs to a different course.');
    if (contract.mode !== 'custom' && (!tier || !course?.tiers.includes(tier))) throw new Error('Select Foundation or Higher before generating a guided paper.');
    resolvedContract = {courseId: definition.courseId, paperId: definition.paperId, mode: contract.mode, contractVersion: definition.contractVersion, ...(definition.specificationVersion?{specificationVersion:definition.specificationVersion}:{})};
  }
  const responseFormats = parseResponseFormatPolicy(bp.responseFormats);
  if (responseFormats && (!resolvedContract || !['short_practice','full_mock'].includes(resolvedContract.mode))) throw new Error('Interactive formats require a guided Biology profile.');
  return {...(responseFormats ? {responseFormats} : {}), courseId: course?.id ?? null, paperId, componentCode: paperId ? definition?.componentCode ?? null : null, paperContract: resolvedContract, ...(definition?.specificationVersion?{specificationVersion:definition.specificationVersion}:{}), ...(course?.curriculum?{curriculum:course.curriculum}:{})};
}

/** v2 snapshots freeze the profile preset at attempt creation. Legacy AQA
 * attempts may use their existing format; legacy OCR is never guessed. */
export function paperPlanForAttempt(context: any, legacyBlueprint?: unknown) {
  if (!context || context.resolved_by !== 'server' || ![1, 2].includes(context.context_version)) {
    if (Object.keys(object(object(legacyBlueprint).paperContract)).length) throw new Error('A saved server course context is required for guided generation.');
    return null;
  }
  const legacy = context.context_version === 1;
  if(canonicalCourseId(context.course_id??object(object(legacyBlueprint).paperContract).courseId)===OCR_ALEVEL_BIOLOGY_ID &&
    (legacy||context.specification_version!==OCR_ALEVEL_BIOLOGY_SPECIFICATION||!['paper_1','paper_2','paper_3'].includes(context.paper_id)||context.component_code!==(context.paper_id==='paper_3'?'H420/03':context.paper_id==='paper_2'?'H420/02':'H420/01')||context.assessment_tier!=='not_tiered'))
    throw new Error('Create a fresh OCR A-level Biology A attempt with its supported paper, component and reviewed edition saved by the server.');
  if(canonicalCourseId(context.course_id ?? object(object(legacyBlueprint).paperContract).courseId)===AQA_ALEVEL_BIOLOGY_ID &&
    (legacy || context.specification_version!==AQA_ALEVEL_BIOLOGY_SPECIFICATION || !['paper_1','paper_2','paper_3'].includes(context.paper_id) || context.assessment_tier!=='not_tiered'))
    throw new Error('Create a fresh AQA A-level attempt with its paper and reviewed specification saved by the server.');
  if(canonicalCourseId(context.course_id??object(object(legacyBlueprint).paperContract).courseId)===WJEC_BIOLOGY_ID&&
    (legacy||context.specification_version!==WJEC_BIOLOGY_SPECIFICATION))throw new Error('Create a fresh WJEC attempt with its reviewed specification version saved by the server.');
  if (legacy && String(context.exam_board ?? '').toLowerCase().includes('ocr') && /biology/i.test(context.subject_name ?? '')) {
    throw new Error('Create a fresh attempt from an OCR profile with its course, paper and tier saved.');
  }
  if (legacy && canonicalCourseId(context.course_id ?? object(object(legacyBlueprint).paperContract).courseId) === EDEXCEL_BIOLOGY_ID) {
    throw new Error('Create a fresh attempt from your Edexcel Biology profile with its paper and tier saved by the server.');
  }
  const contract = legacy ? object(legacyBlueprint).paperContract : context.paper_contract;
  if (!contract) return null;
  if (legacy && canonicalCourseId(contract.courseId) === 'aqa_gcse_biology' && contract.paperId === 'paper_2') {
    throw new Error('Create a fresh attempt from your AQA Paper 2 profile so its paper and tier are saved by the server.');
  }
  const selection = resolvePaperSelection({subject: context.subject_name, examBoard: context.exam_board,
    educationalTier: context.educational_tier}, context.assessment_tier, {
    courseSelection: {courseId: context.course_id, paperId: context.paper_id ?? contract.paperId}, paperContract: contract,
  });
  if (!legacy && context.component_code !== selection.componentCode) throw new Error('Saved component and assessment tier do not match.');
  return buildPaperPlan(contract.mode, context.assessment_tier, contract.courseId, contract.paperId, contract.contractVersion);
}

export function describeCourseSelection(selection: ResolvedPaperSelection): string {
  return [selection.componentCode, selection.courseId === OCR_GATEWAY_BIOLOGY_ID ? 'Gateway Biology A' :
    selection.courseId === AQA_ALEVEL_BIOLOGY_ID ? 'AQA A-level Biology' :
    selection.courseId === OCR_ALEVEL_BIOLOGY_ID ? 'OCR A-level Biology A' :
    selection.courseId === OCR_21C_BIOLOGY_ID ? 'Twenty First Century Biology B' :
    selection.courseId === WJEC_BIOLOGY_ID ? 'WJEC Biology — Wales' :
    selection.courseId === EDEXCEL_BIOLOGY_ID ? 'Pearson Edexcel Biology' : null].filter(Boolean).join(' · ');
}
