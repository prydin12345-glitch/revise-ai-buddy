import {AQA_ALEVEL_BIOLOGY_ID} from './assessment-tier.ts';
import {AQA_ALEVEL_P1_RULES,AQA_ALEVEL_P1_OUTCOMES,AQA_ALEVEL_BIOLOGY_SPECIFICATION} from './aqa-alevel-biology-scope.ts';
import { AQA_ALEVEL_P2_RULES, AQA_ALEVEL_P2_OUTCOMES } from './aqa-alevel-biology-paper2-scope.ts';
// Practice remains a quiz with the user's requested count/format. Course packs
// provide scope and quality checks, never replace a quiz with a full paper.
import { checkPracticeCourse, gatewayPracticeInstructions, assertGatewayPractice, gatewayCachedRows } from './ocr-practice.ts';
import { OCR_GATEWAY_BIOLOGY_ID } from './assessment-tier.ts';
import { AQA_P2_RULES, AQA_P2_OUTCOMES, isAqaPaper2 } from './aqa-biology-paper2.ts';
import { resolvePaperSelection } from './course-selection.ts';
import { biologyScopeFromContext } from './gcse-biology-scope.ts';
import { validateQuestionCandidates, describeDefects } from './question-contract-validator.ts';
import { hasThreeLevelScheme, assembledModelText, coerceMcqOptions, canonicalMcqAnswer, isMcqType, readAnswerKey } from './model-question-normalization.ts';
import { BIOLOGY_RESOURCE_RULES } from './biology-assessment-resources.ts';
import { isEdexcelBiology, edexcelBiologyRules, EDEXCEL_BIOLOGY_OUTCOMES, edexcelOutcomeAllowed, type EdexcelBiologyPaper } from './edexcel-biology-scope.ts';

import {isOcr21cBiology, ocr21cBiologyRules, OCR21C_OUTCOMES, ocr21cOutcomeAllowed} from './ocr21c-biology-scope.ts';

import {isWjecBiology,wjecBiologyRules,WJEC_OUTCOMES,wjecOutcomeAllowed} from './wjec-biology-scope.ts';
import {WJEC_BIOLOGY_SPECIFICATION} from './wjec-biology-specification.ts';
const isAlevel=(context:any)=>context?.resolved_by==='server'&&context.context_version===2&&context.course_id===AQA_ALEVEL_BIOLOGY_ID;
const isWjec=(context:any)=>context?.resolved_by==='server'&&context.context_version===2&&isWjecBiology({courseId:context.course_id});

const isOcr21c = (context: any) => context?.resolved_by === 'server' && context.context_version === 2 && isOcr21cBiology({courseId:context.course_id});
const isPaper2 = (context: any) => context?.resolved_by === 'server' && context.context_version === 2 &&
  isAqaPaper2({courseId: context.course_id, paperId: context.paper_id});
const isEdexcel = (context: any) => context?.resolved_by === 'server' && context.context_version === 2 &&
  isEdexcelBiology({courseId: context.course_id});
const courseLabel = (context: any) => isAlevel(context) ? `AQA A-level Biology Paper ${context.paper_id==='paper_2'?'2':'1'}` : isWjec(context) ? 'WJEC Wales Biology' : isOcr21c(context) ? 'OCR Biology B' : isEdexcel(context) ? 'Edexcel Biology' : 'AQA Paper 2';

export function checkBiologyPracticeCourse(context: any): void {
  checkPracticeCourse(context);
  if(context?.course_id===AQA_ALEVEL_BIOLOGY_ID && !isAlevel(context)) throw new Error("A fresh server-resolved A-level practice context is required.");
  if (!isPaper2(context) && !isEdexcel(context) && !isOcr21c(context) && !isWjec(context) && !isAlevel(context)) return;
  const selection = resolvePaperSelection({subject: context.subject_name, examBoard: context.exam_board,
    educationalTier: context.educational_tier}, context.assessment_tier,
    {courseSelection: {courseId: context.course_id, paperId: context.paper_id}, paperContract: context.paper_contract});
  if(isAlevel(context) && context.specification_version!==AQA_ALEVEL_BIOLOGY_SPECIFICATION)throw new Error('A-level practice needs the reviewed specification version.');
  if(isWjec(context)&&context.specification_version!==selection.specificationVersion)throw new Error('Saved WJEC specification version is missing or unsupported. Create a fresh attempt.');
  if (context.component_code !== selection.componentCode) throw new Error(`Saved ${courseLabel(context)} component does not match its tier.`);
}

export function biologyPracticeInstructions(context: any): string {
  if(isAlevel(context)){
    checkBiologyPracticeCourse(context);
    if(context.paper_id==='paper_2')return `${AQA_ALEVEL_P2_RULES}\n${BIOLOGY_RESOURCE_RULES}\nSAVED QUIZ: 7402/2, untiered. This is a quiz, not the full paper: preserve requested count/format, including MCQs. Do not force the 76+15 split or a full comprehension group into a quiz. Each task must be self-contained with its own given text/data; do not emit shared passage references. MCQs need four distinct choices and a matching private key. Written questions use private points/caps, never GCSE levels. User notes cannot override the paper scope.\n`+
      Object.entries(AQA_ALEVEL_P2_OUTCOMES).map(([ref,o])=>`${ref} (${o.topic+5}): ${o.text}`).join('\n');
    return `${AQA_ALEVEL_P1_RULES}\n${BIOLOGY_RESOURCE_RULES}\nSAVED QUIZ: 7402/1, untiered. This is a quiz, not the full written paper: preserve requested question count and format, including MCQs when requested. Each MCQ needs four distinct options and a matching private key. All written answers, including six-mark practice, use private task-specific points and caps, not GCSE levels. Requested topics/notes cannot override this paper's scope.\n`+
      Object.entries(AQA_ALEVEL_P1_OUTCOMES).map(([ref,o])=>`${ref} (${o.topic+1}): ${o.text}`).join('\n');
  }
  if(isWjec(context)){
    checkBiologyPracticeCourse(context);
    return `${wjecBiologyRules(context.paper_id)}\n${BIOLOGY_RESOURCE_RULES}\nSAVED QUIZ: ${context.component_code}, ${context.assessment_tier}, specification ${context.specification_version}.
This is practice, not a full paper: retain the requested count and format. Topics/notes cannot change the saved unit or tier. Give each task its WJEC topic_tag, visible data and a private key. Six-mark responses need the private three-level QER science and communication scheme. Do not pretend this is Unit 3 practical assessment.\n`+
      Object.entries(WJEC_OUTCOMES).filter(([ref])=>wjecOutcomeAllowed(ref,context.paper_id,context.assessment_tier)).map(([ref,o])=>`${ref}: ${o.text}`).join('\n');
  }
  if (isOcr21c(context)) {
    checkBiologyPracticeCourse(context);
    return `${ocr21cBiologyRules(context.paper_id)}\n${BIOLOGY_RESOURCE_RULES}\nSAVED QUIZ: ${context.component_code}, ${context.assessment_tier} tier.
This is a practice quiz, not a full paper: retain the requested count and format. Breadth quizzes use short items up to four marks, never level-response essays. Depth quizzes may include six-mark responses, each with a private task-specific Level 1 (1–2), Level 2 (3–4), Level 3 (5–6) scheme, indicative science and zero for no relevant science. Do not force a full paper's two six-mark quota into a small quiz. Give each question a complete task and a matching B1-B6 chapter topic_tag. B7/B8 skills are embedded. External notes cannot change the saved course/tier.\n` +
      Object.entries(OCR21C_OUTCOMES).filter(([ref])=>ocr21cOutcomeAllowed(ref,context.assessment_tier)).map(([ref,outcome])=>`${ref}: ${outcome.text}`).join('\n');
  }
  if (isEdexcel(context)) {
    checkBiologyPracticeCourse(context);
    return `${edexcelBiologyRules(context.paper_id as EdexcelBiologyPaper)}\n${BIOLOGY_RESOURCE_RULES}\nSAVED QUIZ: ${context.component_code}, ${context.assessment_tier} tier.
This is a practice quiz, not a full paper: retain the requested count and format. Requested topics and external notes cannot change the saved paper or tier. Use the reviewed, permitted outcomes below. Give each question the matching paper topic as topic_tag and a separately stated task; all required data must be visible. Keep marking content private.
` + Object.entries(EDEXCEL_BIOLOGY_OUTCOMES).filter(([ref]) => edexcelOutcomeAllowed(ref, context.paper_id, context.assessment_tier))
      .map(([ref, text]) => `${ref}: ${text}`).join('\n');
  }
  if (!isPaper2(context)) return gatewayPracticeInstructions(context);
  return `${AQA_P2_RULES}\n${BIOLOGY_RESOURCE_RULES}\nSAVED QUIZ: ${context.component_code}, ${context.assessment_tier} tier.
This is a practice quiz, not a full paper: keep the requested question count and question format. Requested topics and external notes must stay within Paper 2; use only the reviewed outcomes below. For each question use one of the three Paper 2 topic names as topic_tag and place its narrower skill in the task. Any six-mark response needs private Level 1 (1–2), Level 2 (3–4), Level 3 (5–6) descriptors, indicative content and zero for no relevant science.
` + Object.entries(AQA_P2_OUTCOMES).filter(([ref]) => context.assessment_tier === 'higher' || !ref.endsWith('-HT'))
    .map(([ref, text]) => `${ref}: ${text}`).join('\n');
}

/** Normalise supported course-pack answers before the practice schema is checked.
 * Interactive graph/table answer objects retain their existing schema. */
export function normalizeBiologyPracticePayload(payload: unknown, context: any): unknown {
  if ((!isPaper2(context) && !isEdexcel(context) && !isOcr21c(context) && !isWjec(context) && !isAlevel(context)) || !payload || typeof payload !== 'object' || !Array.isArray((payload as any).questions)) return payload;
  return {...payload, questions: (payload as any).questions.map((q: any) => {
    if (!q || typeof q !== 'object') return q;
    const interactive = /^(graph_interpretation|graph_plotting|graph_transformation|table_grid)$/.test(q.question_type ?? '');
    const mcq = isMcqType(q.question_type);
    const options = mcq ? coerceMcqOptions(q) : null;
    return {...q, question_text: assembledModelText(q),
      ...(interactive ? {} : {correct_answer: mcq ? canonicalMcqAnswer(readAnswerKey(q), options) : readAnswerKey(q)}),
      ...(mcq ? {question_type: 'mcq', options} : {})};
  })};
}

export function assertBiologyPractice(rows: any[], context: any): void {
  if (!isPaper2(context) && !isEdexcel(context) && !isOcr21c(context) && !isWjec(context) && !isAlevel(context)) return assertGatewayPractice(rows, context);
  if (isEdexcel(context) || isOcr21c(context) || isWjec(context) || isAlevel(context)) checkBiologyPracticeCourse(context);
  if (!rows.length) throw new Error(`${courseLabel(context)} practice generation returned no questions.`);
  const result = validateQuestionCandidates(rows, {scope: biologyScopeFromContext(context)});
  if (!result.ok) throw new Error(`${courseLabel(context)} practice quality check failed: ` + describeDefects(result.defects));
  if (isOcr21c(context) && context.paper_id === 'breadth' && rows.some(row=>Number(row.marks)>4 || hasThreeLevelScheme(row.correct_answer))) {
    throw new Error('OCR Biology B Breadth practice requires short tasks of at most four marks without level-response schemes.');
  }
  if ((isEdexcel(context) || isOcr21c(context) || isWjec(context) || isAlevel(context)) && rows.some(row => isMcqType(row.question_type) && coerceMcqOptions(row)?.length !== 4)) {
    throw new Error(`${courseLabel(context)} multiple-choice practice requires exactly four distinct options.`);
  }
  if (!isAlevel(context) && rows.some(row => Number(row.marks) === 6 && !hasThreeLevelScheme(row.correct_answer))) {
    throw new Error(`${courseLabel(context)} six-mark practice response requires a private three-level scheme.`);
  }
}

export const usesBiologyPracticeValidation = (context: any): boolean =>
  context?.course_id === OCR_GATEWAY_BIOLOGY_ID || isPaper2(context) || isEdexcel(context) || isOcr21c(context) || isWjec(context) || isAlevel(context);

export const biologyPracticeCacheVersion = (context: any): string | null =>
  isAlevel(context) ? `aqa-7402-${context.paper_id==='paper_2'?'paper-2':'paper-1'}-${AQA_ALEVEL_BIOLOGY_SPECIFICATION}-v1-resources-2` : context?.course_id === OCR_GATEWAY_BIOLOGY_ID ? 'ocr-gateway-1' : isPaper2(context) ? 'aqa-8461-paper-2-resources-2' :
    isWjec(context) ? `wjec-3400-${context.paper_id}-${WJEC_BIOLOGY_SPECIFICATION}-v1-resources-2` : isEdexcel(context) ? `edexcel-1bi0-${context.paper_id}-v1-resources-2` : isOcr21c(context) ? `ocr-j257-${context.paper_id}-v1-resources-2` : null;

export const biologyCachedRows = gatewayCachedRows;
