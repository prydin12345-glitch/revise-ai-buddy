/**
 * Graph Marking v2 — Key Points + Curve Shape Marking
 * 
 * Philosophy:
 * - Key points (roots, turning points, intercepts) earn individual marks
 * - Curve shape (direction, crossings, turning point count) earns method marks
 * - Intermediate points along the curve are NOT required
 * - Drawn curve and plotted points both count toward key point matching
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface KeyPoint {
  x: number;
  y: number;
  type: 'root' | 'turning_point' | 'y_intercept' | 'asymptote' | 'inflection';
  label: string;
  required: boolean;
  toleranceOverride?: number;
  marks: number;
}

export interface CurveShapeRule {
  type:
    | 'positive_cubic'
    | 'negative_cubic'
    | 'positive_quadratic'
    | 'negative_quadratic'
    | 'positive_linear'
    | 'negative_linear'
    | 'reciprocal_positive'
    | 'reciprocal_negative'
    | 'exponential_growth'
    | 'exponential_decay'
    | 'logarithmic';
  crossingsCount?: number;
  turningPointCount?: number;
  marks: number;
}

export interface PlottingAnswerV2 {
  markingFormula: string;
  keyPoints: KeyPoint[];
  curveShapeRules: CurveShapeRule[];
  totalMarks: number;
  domainX: [number, number];
  domainY: [number, number];
  showKeyPointsAfterSubmit: boolean;
  // Legacy fields for backward compatibility
  expectedPoints?: Array<{ x: number; y: number }>;
  toleranceUnits?: number;
}

export interface StudentGraphData {
  plottedPoints: Array<{ x: number; y: number; id?: string }>;
  drawnCurvePoints: Array<{ x: number; y: number }>;
  drawnSegments: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  }>;
}

export interface KeyPointResult {
  keyPoint: KeyPoint;
  achieved: boolean;
  nearestStudentPoint: { x: number; y: number } | null;
  distanceFromExpected: number;
}

export interface CurveShapeResult {
  achieved: boolean;
  marks: number;
  feedback: string;
}

export interface MarkingResultV2 {
  totalScore: number;
  totalMarks: number;
  keyPointResults: KeyPointResult[];
  curveShapeResult: CurveShapeResult;
  feedback: string;
}

// ── Safe formula evaluator ─────────────────────────────────────────────────

export const safeEval = (formula: string, x: number): number | null => {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('x', `
      const Math = globalThis.Math;
      const abs = Math.abs; const sqrt = Math.sqrt;
      const sin = Math.sin; const cos = Math.cos; const tan = Math.tan;
      const log = Math.log; const exp = Math.exp; const pow = Math.pow;
      const PI = Math.PI; const E = Math.E;
      try { return ${formula}; } catch { return null; }
    `);
    const result = fn(x);
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

// ── Calculate dynamic tolerance ────────────────────────────────────────────

export const calculateTolerance = (
  domainX: [number, number],
  domainY: [number, number],
): { x: number; y: number; radius: number } => {
  const xRange = domainX[1] - domainX[0];
  const yRange = domainY[1] - domainY[0];
  return {
    x: xRange * 0.08,
    y: yRange * 0.08,
    radius: Math.sqrt(Math.pow(xRange * 0.08, 2) + Math.pow(yRange * 0.08, 2)),
  };
};

// ── Check key points against student data ──────────────────────────────────

export const checkKeyPoints = (
  keyPoints: KeyPoint[],
  studentData: StudentGraphData,
  domainX: [number, number],
  domainY: [number, number],
): KeyPointResult[] => {
  const tolerance = calculateTolerance(domainX, domainY);

  const allStudentPoints = [
    ...studentData.plottedPoints,
    ...studentData.drawnCurvePoints,
  ];

  return keyPoints.map(kp => {
    let achieved = false;
    let nearestPoint: { x: number; y: number } | null = null;
    let minDistance = Infinity;

    for (const sp of allStudentPoints) {
      const xDiff = Math.abs(sp.x - kp.x);
      const yDiff = Math.abs(sp.y - kp.y);
      const distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);

      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = { x: sp.x, y: sp.y };
      }

      const effectiveTolerance = kp.toleranceOverride ?? tolerance.radius;
      if (distance <= effectiveTolerance) {
        achieved = true;
        break;
      }
    }

    return {
      keyPoint: kp,
      achieved,
      nearestStudentPoint: nearestPoint,
      distanceFromExpected: minDistance,
    };
  });
};

// ── Count approximate x-axis crossings ─────────────────────────────────────

const countXAxisCrossings = (
  points: Array<{ x: number; y: number }>,
): number => {
  let crossings = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if ((prev.y >= 0 && curr.y < 0) || (prev.y < 0 && curr.y >= 0)) {
      crossings++;
    }
  }
  return crossings;
};

// ── Check curve shape rules ────────────────────────────────────────────────

export const checkCurveShape = (
  rules: CurveShapeRule[],
  studentData: StudentGraphData,
): CurveShapeResult => {
  if (rules.length === 0) {
    return { achieved: true, marks: 0, feedback: '' };
  }

  const rule = rules[0];
  const allPoints = [
    ...studentData.plottedPoints,
    ...studentData.drawnCurvePoints,
  ].sort((a, b) => a.x - b.x);

  if (allPoints.length < 2) {
    return {
      achieved: false,
      marks: 0,
      feedback: 'Not enough points drawn to assess curve shape',
    };
  }

  let shapeCorrect = false;
  let feedback = '';

  const leftmostY = allPoints[0].y;
  const rightmostY = allPoints[allPoints.length - 1].y;
  const midIdx = Math.floor(allPoints.length / 2);
  const midY = allPoints[midIdx].y;

  switch (rule.type) {
    case 'positive_cubic':
      shapeCorrect = rightmostY > leftmostY;
      feedback = shapeCorrect ? 'Correct cubic shape' : 'Curve direction incorrect for positive cubic';
      break;
    case 'negative_cubic':
      shapeCorrect = rightmostY < leftmostY;
      feedback = shapeCorrect ? 'Correct cubic shape' : 'Curve direction incorrect for negative cubic';
      break;
    case 'positive_quadratic':
      shapeCorrect = midY < leftmostY && midY < rightmostY;
      feedback = shapeCorrect ? 'Correct parabola shape' : 'Curve should be U-shaped (opening upward)';
      break;
    case 'negative_quadratic':
      shapeCorrect = midY > leftmostY && midY > rightmostY;
      feedback = shapeCorrect ? 'Correct parabola shape' : 'Curve should be n-shaped (opening downward)';
      break;
    case 'exponential_growth':
      shapeCorrect = rightmostY > leftmostY && rightmostY > midY;
      feedback = shapeCorrect ? 'Correct exponential shape' : 'Curve should increase steeply to the right';
      break;
    case 'exponential_decay':
      shapeCorrect = rightmostY < leftmostY;
      feedback = shapeCorrect ? 'Correct decay shape' : 'Curve should decrease to the right';
      break;
    case 'positive_linear':
      shapeCorrect = rightmostY > leftmostY;
      feedback = shapeCorrect ? 'Correct positive gradient' : 'Line should slope upward';
      break;
    case 'negative_linear':
      shapeCorrect = rightmostY < leftmostY;
      feedback = shapeCorrect ? 'Correct negative gradient' : 'Line should slope downward';
      break;
    default:
      shapeCorrect = true;
      feedback = 'Shape check not applicable';
  }

  // Check crossing count if specified
  if (rule.crossingsCount !== undefined && shapeCorrect) {
    const crossings = countXAxisCrossings(allPoints);
    if (Math.abs(crossings - rule.crossingsCount) > 1) {
      shapeCorrect = false;
      feedback = `Expected ${rule.crossingsCount} x-axis crossing(s), curve shows approximately ${crossings}`;
    }
  }

  return {
    achieved: shapeCorrect,
    marks: shapeCorrect ? rule.marks : 0,
    feedback,
  };
};

// ── Master marking function ────────────────────────────────────────────────

export const markGraphAnswer = (
  plottingAnswer: PlottingAnswerV2,
  studentData: StudentGraphData,
): MarkingResultV2 => {
  const keyPointResults = checkKeyPoints(
    plottingAnswer.keyPoints,
    studentData,
    plottingAnswer.domainX,
    plottingAnswer.domainY,
  );

  const curveShapeResult = checkCurveShape(
    plottingAnswer.curveShapeRules,
    studentData,
  );

  const keyPointScore = keyPointResults
    .filter(r => r.achieved)
    .reduce((sum, r) => sum + r.keyPoint.marks, 0);

  const totalScore = keyPointScore + curveShapeResult.marks;
  const totalMarks = plottingAnswer.totalMarks;

  const missedPoints = keyPointResults
    .filter(r => !r.achieved && r.keyPoint.required)
    .map(r => r.keyPoint.label);

  let feedback = '';
  if (totalScore === totalMarks) {
    feedback = 'Excellent — all key points and curve shape correct.';
  } else {
    if (missedPoints.length > 0) {
      feedback += `Missing key points: ${missedPoints.join(', ')}. `;
    }
    if (!curveShapeResult.achieved) {
      feedback += curveShapeResult.feedback;
    }
  }

  return {
    totalScore,
    totalMarks,
    keyPointResults,
    curveShapeResult,
    feedback,
  };
};

// ── Helper: detect if a plottingAnswer uses V2 schema ──────────────────────

export function isV2PlottingAnswer(plottingAnswer: any): plottingAnswer is PlottingAnswerV2 {
  return plottingAnswer && Array.isArray(plottingAnswer.keyPoints) && plottingAnswer.keyPoints.length > 0;
}
