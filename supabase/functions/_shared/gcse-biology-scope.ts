export interface BiologyScope { subject?: string | null; educationalLevel?: string | null; examBoard?: string | null; }
export function isGcseBiology(scope: BiologyScope): boolean {
  return /biology/i.test(scope.subject ?? '') && /\b(gcse|igcse)\b|level\s*2/i.test(scope.educationalLevel ?? '');
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
const OUT_OF_LEVEL = /\blight[-\s](?:dependent|independent)\b|\bthylakoids?\b|\bstroma\b|\bphotolysis\b|\bCalvin cycle\b|\bNADPH\b|\bchemiosmosis\b/i;
/** Conservative quality flag, not a complete curriculum classifier. */
export function gcseBiologyIssue(part: { question_text?: unknown; task?: unknown; correct_answer?: unknown }, scope: BiologyScope): string | null {
  if (!isGcseBiology(scope)) return null;
  const text = [part.question_text, part.task, part.correct_answer].map(v => typeof v === 'string' ? v : v ? JSON.stringify(v) : '').join('\n');
  const match = text.match(OUT_OF_LEVEL);
  return match ? 'GCSE Biology contains A-level photosynthesis content (' + match[0] + '); regenerate the complete question and key within GCSE.' : null;
}
