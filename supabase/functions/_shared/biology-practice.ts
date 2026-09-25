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

const isPaper2 = (context: any) => context?.resolved_by === 'server' && context.context_version === 2 &&
  isAqaPaper2({courseId: context.course_id, paperId: context.paper_id});
const isEdexcel = (context: any) => context?.resolved_by === 'server' && context.context_version === 2 &&
  isEdexcelBiology({courseId: context.course_id});
const courseLabel = (context: any) => isEdexcel(context) ? 'Edexcel Biology' : 'AQA Paper 2';

export function checkBiologyPracticeCourse(context: any): void {
  checkPracticeCourse(context);
  if (!isPaper2(context) && !isEdexcel(context)) return;
  const selection = resolvePaperSelection({subject: context.subject_name, examBoard: context.exam_board,
    educationalTier: context.educational_tier}, context.assessment_tier,
    {courseSelection: {courseId: context.course_id, paperId: context.paper_id}, paperContract: context.paper_contract});
  if (context.component_code !== selection.componentCode) throw new Error(`Saved ${courseLabel(context)} component does not match its tier.`);
}

export function biologyPracticeInstructions(context: any): string {
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
  if ((!isPaper2(context) && !isEdexcel(context)) || !payload || typeof payload !== 'object' || !Array.isArray((payload as any).questions)) return payload;
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
  if (!isPaper2(context) && !isEdexcel(context)) return assertGatewayPractice(rows, context);
  if (isEdexcel(context)) checkBiologyPracticeCourse(context);
  if (!rows.length) throw new Error(`${courseLabel(context)} practice generation returned no questions.`);
  const result = validateQuestionCandidates(rows, {scope: biologyScopeFromContext(context)});
  if (!result.ok) throw new Error(`${courseLabel(context)} practice quality check failed: ` + describeDefects(result.defects));
  if (isEdexcel(context) && rows.some(row => isMcqType(row.question_type) && coerceMcqOptions(row)?.length !== 4)) {
    throw new Error('Edexcel Biology multiple-choice practice requires exactly four distinct options.');
  }
  if (rows.some(row => Number(row.marks) === 6 && !hasThreeLevelScheme(row.correct_answer))) {
    throw new Error(`${courseLabel(context)} six-mark practice response requires a private three-level scheme.`);
  }
}

export const usesBiologyPracticeValidation = (context: any): boolean =>
  context?.course_id === OCR_GATEWAY_BIOLOGY_ID || isPaper2(context) || isEdexcel(context);

export const biologyPracticeCacheVersion = (context: any): string | null =>
  context?.course_id === OCR_GATEWAY_BIOLOGY_ID ? 'ocr-gateway-1' : isPaper2(context) ? 'aqa-8461-paper-2-resources-2' :
    isEdexcel(context) ? `edexcel-1bi0-${context.paper_id}-v1-resources-2` : null;

export const biologyCachedRows = gatewayCachedRows;
