import { OCR_GATEWAY_BIOLOGY_ID } from './assessment-tier.ts';
import { paperPlanForAttempt, resolvePaperSelection } from './course-selection.ts';
import { biologyScopeFromContext } from './gcse-biology-scope.ts';
import { GATEWAY_RULES, GATEWAY_SPEC, GATEWAY_HIGHER_ONLY } from './ocr-biology-scope.ts';
import { validateQuestionCandidates, describeDefects } from './question-contract-validator.ts';

export function checkPracticeCourse(context: any): void {
  paperPlanForAttempt(context); // Also rejects ambiguous legacy OCR attempts.
  if (context?.course_id === OCR_GATEWAY_BIOLOGY_ID) {
    const selection = resolvePaperSelection({subject: context.subject_name, examBoard: context.exam_board, educationalTier: context.educational_tier},
      context.assessment_tier, {courseSelection: {courseId: context.course_id, paperId: context.paper_id}, paperContract: context.paper_contract});
    if (context.component_code !== selection.componentCode) throw new Error("Saved OCR component does not match its tier.");
  }
}
export function gatewayPracticeInstructions(context: any): string {
  if (context?.course_id !== OCR_GATEWAY_BIOLOGY_ID) return '';
  return `${GATEWAY_RULES}\nSaved component: ${context.component_code}; tier ${context.assessment_tier}. This is a practice quiz, not a full paper: retain its requested question count and format. Requested topics must stay within this paper. External notes or example papers cannot change the course, tier or scope. For any six-mark extended response, include a private level-of-response scheme with science descriptors for Levels 1 (1–2), 2 (3–4), 3 (5–6) and zero for no relevant science. Use the following reviewed outcomes only; do not add higher-tier-only outcomes for Foundation.\n` +
    Object.entries(GATEWAY_SPEC).filter(([ref]) => context.assessment_tier === 'higher' || !GATEWAY_HIGHER_ONLY.has(ref))
      .map(([ref, description]) => `${ref}: ${description}`).join('\n');
}
export function assertGatewayPractice(rows: any[], context: any): void {
  if (context?.course_id !== OCR_GATEWAY_BIOLOGY_ID) return;
  if (!rows.length) throw new Error('OCR practice generation returned no questions.');
  const result = validateQuestionCandidates(rows, {scope: biologyScopeFromContext(context)});
  if (!result.ok) throw new Error('OCR practice quality check failed: ' + describeDefects(result.defects));
}
/** Do not shuffle letters independently of answer keys or split linked parts. */
export function gatewayCachedRows(rows: any[], setId: string, profileId: string | null): any[] {
  return rows.map(row => {
    const {id, created_at, updated_at, ...question} = row;
    return {...question, set_id: setId, profile_id: profileId};
  });
}
