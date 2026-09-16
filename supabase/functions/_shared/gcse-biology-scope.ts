import { getCourseCapability, type AssessmentTier } from './assessment-tier.ts';

export interface BiologyScope {
  subject?: string | null;
  educationalLevel?: string | null;
  examBoard?: string | null;
  assessmentTier?: AssessmentTier | null;
}
export function isGcseBiology(scope: BiologyScope): boolean {
  return /\bbiology\b/i.test(scope.subject ?? '') && /\b(gcse|igcse)\b|level\s*2|^ks4$|^secondary_14_16$/i.test(scope.educationalLevel ?? '');
}
export const GCSE_BIOLOGY_RULES = [
  'GCSE BIOLOGY KNOWLEDGE BOUNDARY, including Higher tier:',
  'Assess only the selected GCSE paper topics. Higher difficulty never changes the qualification.',
  'Photosynthesis: chloroplasts, chlorophyll, light energy transfer, the endothermic reaction, glucose uses, rates and limiting factors.',
  'Do not require light-dependent/light-independent stages, thylakoid membranes, stroma functions, photolysis, the Calvin cycle, ATP/NADPH chemistry or chemiosmosis.',
  'Use GCSE calculations such as magnification, percentage change, surface-area-to-volume ratio and rate. No Hardy-Weinberg, chi-squared or water-potential equations.',
  'For Paper 1 keep Cell biology, Organisation, Infection and response, and Bioenergetics. No genetics or ecology examples from other papers.',
  'Difficulty increases reasoning within GCSE; recall and read-off questions remain legitimate.',
].join('\n');

const isAqaFoundation = (scope: BiologyScope): boolean =>
  scope.assessmentTier === 'foundation' && getCourseCapability({
    subject: scope.subject, examBoard: scope.examBoard, educationalTier: scope.educationalLevel,
  })?.id === 'aqa_gcse_biology';

// AQA 8461 sections 4.3.2, 4.3.3.1, 4.4.1.2 and 4.4.2.2 mark these
// requirements as HT only. These rules are deliberately scoped to this course.
export function biologyScopeInstructions(scope: BiologyScope): string {
  const lines = [isGcseBiology(scope) ? GCSE_BIOLOGY_RULES : ''];
  if (scope.assessmentTier === 'foundation') lines.push(
    'ASSESSMENT TIER: Foundation. Keep the selected paper, its marks and required resources. Use Foundation content and accessible wording; a difficult setting never authorises Higher-only knowledge.',
    'Scaffold multi-step calculations explicitly, identify the data and units needed, and give every scored part a separate, complete task. Retain data handling and extended answers where planned.',
  );
  if (scope.assessmentTier === 'higher') lines.push('ASSESSMENT TIER: Higher. Stay within the saved qualification and selected paper, including its permitted Higher-only content.');
  if (isAqaFoundation(scope)) lines.push(
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
  const match = text.match(OUT_OF_LEVEL);
  if (match) return 'GCSE Biology contains A-level photosynthesis content (' + match[0] + '); regenerate the complete question and key within GCSE.';
  // Narrow deterministic checks supplement the prompt; they do not certify
  // every aspect of a paper's syllabus, demand or mark scheme.
  if (isAqaFoundation(scope)) {
    const higherOnly = text.match(/\bmonoclonal\b|\bhybridomas?\b|\binverse[-\s]square\b/i);
    if (higherOnly) return 'AQA GCSE Biology Foundation contains Higher-only content (' + higherOnly[0] + ').';
  }
  return null;
}
