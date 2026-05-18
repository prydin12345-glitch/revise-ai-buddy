import { detectDrawQuestion } from './draw-question-detector';

/**
 * Defensive runtime guard.
 *
 * Some questions are incorrectly stored as question_type = 'graph_plotting'
 * by the AI when the text actually asks for a physics diagram sketch
 * (magnetic field, ray diagram, wave, free body, etc.). In that case we want
 * the freehand drawing canvas to render, not the coordinate grid.
 *
 * Returns true when the stored question_type is a graph type BUT the text
 * is unambiguously a physics draw question.
 */
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

  const info = detectDrawQuestion(questionText ?? '', subject ?? '', questionType ?? undefined);
  return info.needsDrawingCanvas && info.diagramCategory === 'physics';
}
