/**
 * Post-processing utilities for generated practice questions.
 * Handles question type remapping, validation, and table grid fixes.
 * Extracted from generate-practice-questions/index.ts for maintainability.
 */

/** Remap invalid question types the AI sometimes invents */
export const questionTypeRemap: Record<string, string> = {
  'numeric': 'short_answer',
  'numeric_entry': 'short_answer',
  'numeric_response': 'short_answer',
  'fill_in_blank': 'short_answer',
  'calculation': 'short_answer',
  'standard': 'short_answer',
  'open_ended': 'extended',
  'long_answer': 'extended',
  'free_response': 'extended',
  'essay': 'extended',
  'extended_response': 'extended',
  'multiple_choice': 'mcq',
  'true_false': 'mcq',
};

export const validQuestionTypes = [
  'short_answer', 'extended', 'mcq', 'table_grid',
  'graph_interpretation', 'graph_plotting', 'graph_transformation'
];

/** Fix invalid question types in generated questions */
export function remapQuestionTypes(questions: any[]): void {
  for (const q of questions) {
    if (q.question_type && questionTypeRemap[q.question_type]) {
      console.warn(`Remapping invalid question_type "${q.question_type}" -> "${questionTypeRemap[q.question_type]}"`);
      q.question_type = questionTypeRemap[q.question_type];
    } else if (q.question_type && !validQuestionTypes.includes(q.question_type)) {
      const fallback = (q.marks && q.marks >= 6) ? 'extended' : 'short_answer';
      console.warn(`Unknown question_type "${q.question_type}" -> fallback "${fallback}"`);
      q.question_type = fallback;
    }
  }
}

/** Sanitize LaTeX in table headers - convert to plain text */
export function sanitizeTableHeaders(headers: string[]): string[] {
  return headers.map((h: string) => {
    return h
      .replace(/\$?\s*s\^?\{?-1\}?\s*\$?/g, 's⁻¹')
      .replace(/\$?\s*cm\^?\{?3\}?\s*\$?/g, 'cm³')
      .replace(/\$?\s*m\^?\{?2\}?\s*\$?/g, 'm²')
      .replace(/\$?\s*dm\^?\{?-3\}?\s*\$?/g, 'dm⁻³')
      .replace(/\$?\s*mol\s*[·.]\s*dm\^?\{?-3\}?\s*\$?/g, 'mol·dm⁻³')
      .replace(/\$([^$]+)\$/g, '$1');
  });
}

/** Extract base function from question text */
export function extractBaseFunctionFromText(text: string): string | null {
  const fxMatch = text.match(/[a-zA-Z]\s*\(\s*x\s*\)\s*=\s*([^,.]+?)(?:[,.]|is\s+shown|\s+has|\s+where|$)/i);
  if (fxMatch) return fxMatch[1].trim();
  const yMatch = text.match(/y\s*=\s*([^,]+?)(?:[,.]|is\s+shown|\s+has|$)/i);
  if (yMatch && !/[a-zA-Z]\(x\)/.test(yMatch[1])) return yMatch[1].trim();
  return null;
}

/** Extract a polynomial formula from a textual algebraic answer */
export function extractFormulaFromAlgebraicAnswer(answer: string): string | null {
  if (!answer || typeof answer !== 'string') return null;
  const match = answer.match(/[a-zA-Z]\s*\(\s*x\s*\)\s*=\s*(.+)/i);
  if (match) return match[1].trim();
  const yMatch = answer.match(/y\s*=\s*(.+)/i);
  if (yMatch) return yMatch[1].trim();
  return null;
}

/** Detect if tier needs high complexity */
export function parseTierFlags(tier: string) {
  const t = (tier || '').toLowerCase();
  return {
    isFoundation: t.includes('foundation') || t.includes('basic'),
    isGCSE: t === 'secondary_14_16' || t.includes('gcse') || t.includes('ks4') || t.includes('o-level') || t.includes('secondary'),
    isALevel: t === 'college_16_18' || t.includes('a-level') || t.includes('a level') || t.includes('ib') || t.includes('pre-u') || t.includes('advanced') || t.includes('college'),
    isUniversity: t === 'university_18plus' || t.includes('university') || t.includes('undergraduate') || t.includes('degree') || t.includes('postgraduate') || t.includes('masters'),
  };
}

/** Detect transformation topics for special handling */
export function hasTransformationTopic(subtopics: string[]): boolean {
  const subtopicsLower = subtopics.map(s => s.toLowerCase());
  return subtopicsLower.some(s =>
    s.includes('transform') ||
    s.includes('f(x)') ||
    s.includes('function') ||
    s.includes('sketch') ||
    s.includes('curve') ||
    s.includes('graph')
  );
}

/** Strip LaTeX wrappers and convert LaTeX math to evaluatable form */
export function stripLatex(s: string): string {
  let r = s;
  r = r.replace(/\$\$/g, '').replace(/\$/g, '');
  r = r.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  r = r.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');
  r = r.replace(/\\ln\b/g, 'ln');
  r = r.replace(/\\log\b/g, 'log');
  r = r.replace(/\\sin\b/g, 'sin');
  r = r.replace(/\\cos\b/g, 'cos');
  r = r.replace(/\\tan\b/g, 'tan');
  r = r.replace(/\\pi\b/g, 'pi');
  r = r.replace(/\\left\s*/g, '').replace(/\\right\s*/g, '');
  r = r.replace(/\\cdot/g, '*');
  r = r.replace(/\\times/g, '*');
  r = r.replace(/\\,/g, '');
  r = r.replace(/\{([^}]+)\}/g, '($1)');
  r = r.replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4');
  r = r.replace(/(\d)(x)/gi, '$1*$2');
  r = r.replace(/\)\(/g, ')*(');
  r = r.replace(/(\d)\(/g, '$1*(');
  r = r.replace(/\)(x)/gi, ')*$1');
  return r.trim().replace(/[.\s]+$/, '');
}
