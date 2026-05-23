import { detectDrawQuestion } from './draw-question-detector';

/**
 * Defensive runtime guard.
 *
 * Some questions are incorrectly stored as question_type = 'graph_plotting'
 * by the AI when the text actually asks for a physics diagram sketch
 * (magnetic field, ray diagram, wave, free body, etc.) OR for a qualitative
 * graph sketch (e.g. "sketch how N varies with t"). In both cases we want
 * the freehand drawing canvas to render, not the coordinate plotting grid.
 *
 * Returns true when the stored question_type is a graph type BUT the text
 * is unambiguously a physics-draw or qualitative-sketch question.
 */

export const QUALITATIVE_SKETCH_PATTERNS: RegExp[] = [
  /sketch\s+(?:a\s+)?graph\s+to\s+show\s+how/i,
  /sketch\s+(?:a\s+)?graph\s+(?:showing|to\s+illustrate)/i,
  /sketch\s+(?:a\s+)?(?:curve|graph)\s+(?:showing|to\s+show)/i,
  /draw\s+(?:a\s+)?(?:sketch\s+)?graph\s+(?:to\s+show|showing)/i,
  /sketch.*(?:number\s+of\s+undecayed|activity|N\s+varies|A\s+varies)/i,
  /sketch.*(?:exponential\s+decay|decay\s+curve|half[\s-]life\s+concept)/i,
  /sketch.*(?:varies\s+with|as\s+a\s+function\s+of).*(?:time|distance|temperature)/i,
];

export function isPhysicsDrawOverride(
  questionText: string | null | undefined,
  subject: string | null | undefined,
  questionType: string | null | undefined,
): boolean {
  const isGraphType =
    questionType === 'graph_plotting' ||
    questionType === 'graph_interpretation' ||
    questionType === 'graph_transformation' ||
    questionType === 'bearings';
  if (!isGraphType) return false;

  const text = questionText ?? '';
  // CRITICAL: pass undefined for questionType so detectDrawQuestion's Guard 1
  // (which short-circuits on graph_plotting / graph_interpretation / etc.)
  // does not block the text-pattern matcher.
  const info = detectDrawQuestion(text, subject ?? '', undefined);
  if (info.needsDrawingCanvas && info.diagramCategory === 'physics') return true;

  // Qualitative sketch graphs that shouldn't go through the plotting grid:
  if (QUALITATIVE_SKETCH_PATTERNS.some(p => p.test(text))) return true;

  return false;
}
