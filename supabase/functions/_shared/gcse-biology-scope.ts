import { getCourseCapability, OCR_GATEWAY_BIOLOGY_ID, type AssessmentTier } from './assessment-tier.ts';

import { isOcr21cBiology, ocr21cBiologyRules, ocr21cBiologyContentIssue, type Ocr21cPaper } from './ocr21c-biology-scope.ts';
import { GATEWAY_RULES } from './ocr-biology-scope.ts';
import { AQA_P2_RULES, isAqaPaper2, aqaPaper2ContentIssue } from './aqa-biology-paper2.ts';
import { BIOLOGY_RESOURCE_RULES } from './biology-assessment-resources.ts';
import { isEdexcelBiology, edexcelBiologyRules, edexcelBiologyContentIssue, type EdexcelBiologyPaper } from './edexcel-biology-scope.ts';

export interface BiologyScope {
  courseId?: string | null;
  paperId?: string | null;
  componentCode?: string | null;
  subject?: string | null;
  educationalLevel?: string | null;
  examBoard?: string | null;
  assessmentTier?: AssessmentTier | null;
}
export function isGcseBiology(scope: BiologyScope): boolean {
  const level = (scope.educationalLevel ?? '').replace(/_/g, ' ');
  return /\bbiology\b/i.test(scope.subject ?? '') && /\b(gcse|igcse)\b|level\s*2|^ks4$|^secondary 14 16$/i.test(level);
}
export const GCSE_BIOLOGY_RULES = [
  'GCSE BIOLOGY KNOWLEDGE BOUNDARY, including Higher tier:',
  'Assess only the selected GCSE paper topics. Higher difficulty never changes the qualification.',
  'Photosynthesis: chloroplasts, chlorophyll, light energy transfer, the endothermic reaction, glucose uses, rates and limiting factors.',
  'Do not require light-dependent/light-independent stages, thylakoid membranes, stroma functions, photolysis, the Calvin cycle, ATP/NADPH chemistry or chemiosmosis.',
  'Use GCSE calculations such as magnification, percentage change, surface-area-to-volume ratio and rate. No Hardy-Weinberg, chi-squared or water-potential equations.',
  'Difficulty increases reasoning within GCSE; recall and read-off questions remain legitimate.',
].join('\n');

const isAqaFoundation = (scope: BiologyScope): boolean =>
  scope.assessmentTier === 'foundation' && getCourseCapability({
    subject: scope.subject, examBoard: scope.examBoard, educationalTier: scope.educationalLevel,
  })?.id === 'aqa_gcse_biology';

// AQA 8461 sections 4.3.2, 4.3.3.1, 4.4.1.2 and 4.4.2.2 mark these
// requirements as HT only. These rules are deliberately scoped to this course.
export function biologyScopeInstructions(scope: BiologyScope): string {
  const gateway = scope.courseId === OCR_GATEWAY_BIOLOGY_ID;
  const edexcel = isEdexcelBiology(scope) && (scope.paperId === 'paper_1' || scope.paperId === 'paper_2');
  const twentyFirst = isOcr21cBiology(scope) && (scope.paperId === 'breadth' || scope.paperId === 'depth');
  const lines = [isGcseBiology(scope) ? (twentyFirst ? ocr21cBiologyRules(scope.paperId as Ocr21cPaper) : edexcel ? edexcelBiologyRules(scope.paperId as EdexcelBiologyPaper) : gateway ? GATEWAY_RULES : GCSE_BIOLOGY_RULES) : ''];
  if (isGcseBiology(scope)) lines.push(BIOLOGY_RESOURCE_RULES);
  if (isAqaPaper2(scope)) lines.push(AQA_P2_RULES);
  if (getCourseCapability({ subject: scope.subject, examBoard: scope.examBoard, educationalTier: scope.educationalLevel, courseId: scope.courseId })?.id === 'aqa_gcse_biology' && (!scope.paperId || scope.paperId === 'paper_1')) lines.push('AQA Paper 1: Cell biology, Organisation, Infection and response, Bioenergetics. Do not import Paper 2 content.');
  if (scope.assessmentTier === 'foundation') lines.push(
    'ASSESSMENT TIER: Foundation. Keep the selected paper, its marks and required resources. Use Foundation content and accessible wording; a difficult setting never authorises Higher-only knowledge.',
    'Scaffold multi-step calculations explicitly, identify the data and units needed, and give every scored part a separate, complete task. Retain data handling and extended answers where planned.',
  );
  if (scope.assessmentTier === 'higher') lines.push('ASSESSMENT TIER: Higher. Stay within the saved qualification and selected paper, including its permitted Higher-only content.');
  if (isAqaFoundation(scope) && !isAqaPaper2(scope)) lines.push(
    'AQA GCSE Biology Foundation: do not require monoclonal antibodies, hybridoma production or HT-only plant disease detection/identification methods.',
    'For photosynthesis use single-factor graphs. Do not assess the inverse-square law, two/three-factor limiting-factor analysis or greenhouse profit optimisation.',
    'Do not require lactic acid transport to the liver and conversion back to glucose. General anaerobic respiration and exercise responses remain in scope.',
  );
  return lines.filter(Boolean).join('\n');
}

const OUT_OF_LEVEL = /\blight[-\s](?:dependent|independent)\b|\bthylakoids?\b|\bstroma\b|\bphotolysis\b|\bCalvin cycle\b|\bNADPH\b|\bchemiosmosis\b/i;
/** Conservative quality flag, not a complete curriculum classifier. */
export function gcseBiologyIssue(part: { question_text?: unknown; task?: unknown; correct_answer?: unknown }, scope: BiologyScope): string | null {
  if (!isGcseBiology(scope)) return null;
  const text = [part.question_text, part.task, part.correct_answer].map(v => typeof v === 'string' ? v : v ? JSON.stringify(v) : '').join('\n');
  const gateway = scope.courseId === OCR_GATEWAY_BIOLOGY_ID;
  if (isOcr21cBiology(scope)) return ocr21cBiologyContentIssue(text, scope.assessmentTier);
  const match = text.match(gateway ? /\bthylakoids?\b|\bstroma\b|\bCalvin cycle\b|\bNADPH\b|\bchemiosmosis\b|\belectron transport chain\b/i : OUT_OF_LEVEL);
  if (gateway && scope.assessmentTier === 'foundation') {
    const higher = text.match(/\btranscription\b|\btranslation\b|\btriplet code\b|\b[mt]RNA\b|\bglucagon\b|\bADH\b|\bantidiuretic\b|\binverse[-\s]square\b|\bthyroxine\b/i);
    if (higher) return 'OCR Gateway Foundation contains Higher-only content (' + higher[0] + ').';
  }
  if (match) return 'GCSE Biology contains A-level photosynthesis content (' + match[0] + '); regenerate the complete question and key within GCSE.';
  if (isEdexcelBiology(scope) && (scope.paperId === 'paper_1' || scope.paperId === 'paper_2')) return edexcelBiologyContentIssue(text, scope.paperId, scope.assessmentTier);
  if (isAqaPaper2(scope)) return aqaPaper2ContentIssue(text, scope.assessmentTier);
  // Narrow deterministic checks supplement the prompt; they do not certify
  // every aspect of a paper's syllabus, demand or mark scheme.
  if (isAqaFoundation(scope)) {
    const higherOnly = text.match(/\bmonoclonal\b|\bhybridomas?\b|\binverse[-\s]square\b/i);
    if (higherOnly) return 'AQA GCSE Biology Foundation contains Higher-only content (' + higherOnly[0] + ').';
  }
  return null;
}

/** Context comes from the protected database column, never request JSON. */
export function biologyScopeFromContext(context: any, fallback: BiologyScope = {}): BiologyScope {
  if (context?.resolved_by !== 'server' || ![1, 2].includes(context.context_version)) return fallback;
  return {subject: context.subject_name ?? fallback.subject, educationalLevel: context.educational_tier ?? fallback.educationalLevel,
    examBoard: context.exam_board ?? fallback.examBoard, assessmentTier: context.assessment_tier ?? null,
    courseId: context.course_id ?? null, paperId: context.paper_id ?? null, componentCode: context.component_code ?? null};
}
