/**
 * Client-side turning point calculator.
 * Finds turning points numerically from a formula string,
 * so the AI doesn't need to calculate them during generation.
 */

import { safeEval } from './graphMarking';

export interface TurningPoint {
  x: number;
  y: number;
  type: 'max' | 'min';
}

/**
 * Find turning points of a function using numerical differentiation.
 * Scans the domain for sign changes in the derivative.
 */
export const findTurningPoints = (
  formula: string,
  domainX: [number, number],
): TurningPoint[] => {
  const turningPoints: TurningPoint[] = [];
  const steps = 1000;
  const step = (domainX[1] - domainX[0]) / steps;
  const h = step * 0.1;

  let prevDerivative: number | null = null;

  for (let i = 0; i <= steps; i++) {
    const x = domainX[0] + i * step;
    const yPlus = safeEval(formula, x + h);
    const yMinus = safeEval(formula, x - h);

    if (yPlus === null || yMinus === null) {
      prevDerivative = null;
      continue;
    }

    const derivative = (yPlus - yMinus) / (2 * h);

    if (
      prevDerivative !== null &&
      Math.sign(derivative) !== Math.sign(prevDerivative) &&
      Math.abs(derivative) < 50
    ) {
      const y = safeEval(formula, x);
      if (y !== null) {
        turningPoints.push({
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          type: prevDerivative > 0 ? 'max' : 'min',
        });
      }
    }

    prevDerivative = derivative;
  }

  return turningPoints;
};

/**
 * Enrich a plottingAnswer's keyPoints with auto-calculated turning points
 * when the question text asks for them.
 */
export const enrichKeyPointsWithTurningPoints = (
  plottingAnswer: {
    markingFormula: string;
    keyPoints?: Array<{ x: number; y: number; type: string; label: string; required: boolean; marks: number }>;
    curveShapeRules?: Array<{ type: string; crossingsCount?: number; marks: number }>;
    totalMarks?: number;
    domainX: [number, number];
    domainY: [number, number];
    [key: string]: unknown;
  },
  questionAskedForTurningPoints: boolean,
) => {
  if (!questionAskedForTurningPoints || !plottingAnswer.markingFormula) {
    return plottingAnswer;
  }

  // Check if turning points already exist in keyPoints
  const existingKeyPoints = plottingAnswer.keyPoints || [];
  const hasTurningPoints = existingKeyPoints.some(
    (kp) => kp.type === 'turning_point',
  );
  if (hasTurningPoints) return plottingAnswer;

  const turningPoints = findTurningPoints(
    plottingAnswer.markingFormula,
    plottingAnswer.domainX,
  );

  const newKeyPoints = [
    ...existingKeyPoints,
    ...turningPoints.map((tp) => ({
      x: tp.x,
      y: tp.y,
      type: 'turning_point' as const,
      label: `(${tp.x}, ${tp.y})`,
      required: false,
      marks: 1,
    })),
  ];

  const shapeMarks = (plottingAnswer.curveShapeRules || []).reduce(
    (sum, r) => sum + r.marks,
    0,
  );

  return {
    ...plottingAnswer,
    keyPoints: newKeyPoints,
    totalMarks: newKeyPoints.reduce((sum, kp) => sum + kp.marks, 0) + shapeMarks,
  };
};
