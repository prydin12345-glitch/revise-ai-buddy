/**
 * Mathematical Graph Engine
 * 
 * Centralised utilities for:
 * - Function evaluation using structured function types
 * - Discontinuity detection via sampling
 * - Curve generation with automatic branch splitting
 * - Transformation application using mathematical rules
 * 
 * This replaces regex-based parsing with a deterministic, type-safe approach.
 */

// ============================================
// FUNCTION TYPE DEFINITIONS
// ============================================

/** Polynomial: a0 + a1*x + a2*x^2 + ... */
export interface PolynomialFunction {
  type: 'polynomial';
  coefficients: number[]; // [a0, a1, a2, ...] for a0 + a1*x + a2*x^2
}

/** Factored cubic: x(x-r1)(x-r2) */
export interface FactoredCubicFunction {
  type: 'factored_cubic';
  roots: number[]; // roots of the cubic (where it crosses x-axis)
}

/** Quadratic with repeated root: (x-v)^2(x-r) */
export interface QuadraticFactorFunction {
  type: 'quadratic_factor';
  repeatedRoot: number; // The repeated root (vertex)
  singleRoot: number;   // The single root
}

/** Reciprocal: 1/f(x) */
export interface ReciprocalFunction {
  type: 'reciprocal';
  inner: FunctionType;
}

/** Constant value */
export interface ConstantFunction {
  type: 'constant';
  value: number;
}

/** Linear: ax + b */
export interface LinearFunction {
  type: 'linear';
  slope: number;
  intercept: number;
}

/** Quadratic: a(x-h)^2 + k (vertex form) or ax^2 + bx + c */
export interface QuadraticFunction {
  type: 'quadratic';
  a: number;
  b: number;
  c: number;
}

/** Union of all supported function types */
export type FunctionType = 
  | PolynomialFunction
  | FactoredCubicFunction
  | QuadraticFactorFunction
  | ReciprocalFunction
  | ConstantFunction
  | LinearFunction
  | QuadraticFunction;

// ============================================
// TRANSFORMATION SPECIFICATION
// ============================================

/** Structured transformation (not string parsing) */
export interface TransformSpec {
  shiftX: number;      // f(x - a) = shift RIGHT by a (positive a shifts right)
  shiftY: number;      // f(x) + a = shift UP by a
  scaleY: number;      // a*f(x) = stretch vertically by a (default 1)
  scaleX: number;      // f(a*x) = compress horizontally by a (default 1)
  reflectX: boolean;   // -f(x) = reflect in x-axis
  reflectY: boolean;   // f(-x) = reflect in y-axis
}

/** Default identity transform */
export const IDENTITY_TRANSFORM: TransformSpec = {
  shiftX: 0,
  shiftY: 0,
  scaleY: 1,
  scaleX: 1,
  reflectX: false,
  reflectY: false,
};

// ============================================
// GRAPH DATA STRUCTURES
// ============================================

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphSeries {
  id: string;
  label: string;
  data: GraphPoint[];
  showLine?: boolean;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  color?: string;
}

export interface CanonicalGraphConfig {
  // Function definition
  functionDef: FunctionType;
  transforms: TransformSpec;
  
  // Pre-computed curve data
  baseCurveBranches: GraphSeries[];   // Original f(x) - may have multiple branches
  transformedBranches: GraphSeries[]; // After transformation
  
  // Domain and key features
  domain: { x: [number, number]; y: [number, number] };
  asymptotes: { vertical: number[]; horizontal: number[] };
  intercepts: { x: number[]; y: number | null };
  turningPoints: Array<{ x: number; y: number; type: 'max' | 'min' }>;
  
  // Marking configuration
  sketchMode: boolean;
  givenGraph: boolean;
  markingTolerance: {
    intercepts: number;      // ±units for intercept regions
    turningPoints: number;   // ±units for turning points
    asymptoteAvoidance: number; // Must not cross within this distance
  };
}

// ============================================
// FUNCTION EVALUATION
// ============================================

/**
 * Evaluate a function at a given x value.
 * Returns null if the function is undefined at that point (e.g., division by zero).
 */
export function evaluate(fn: FunctionType, x: number): number | null {
  switch (fn.type) {
    case 'constant':
      return fn.value;
    
    case 'linear':
      return fn.slope * x + fn.intercept;
    
    case 'quadratic':
      return fn.a * x * x + fn.b * x + fn.c;
    
    case 'polynomial': {
      let result = 0;
      for (let i = 0; i < fn.coefficients.length; i++) {
        result += fn.coefficients[i] * Math.pow(x, i);
      }
      return result;
    }
    
    case 'factored_cubic': {
      // x(x - r1)(x - r2)... if first root is 0, or (x - r0)(x - r1)...
      let result = 1;
      for (const root of fn.roots) {
        result *= (x - root);
      }
      // If roots don't include 0, this is x * (x - r1) * (x - r2)
      // Assume first entry could be 0 meaning origin is a root
      return result;
    }
    
    case 'quadratic_factor': {
      // (x - repeatedRoot)^2 * (x - singleRoot)
      return Math.pow(x - fn.repeatedRoot, 2) * (x - fn.singleRoot);
    }
    
    case 'reciprocal': {
      const innerValue = evaluate(fn.inner, x);
      if (innerValue === null || innerValue === 0) {
        return null; // Undefined (asymptote)
      }
      return 1 / innerValue;
    }
    
    default:
      return null;
  }
}

// ============================================
// DISCONTINUITY DETECTION (Sampling-based)
// ============================================

/**
 * Find discontinuities by sampling the function across the domain.
 * Uses heuristics: NaN/Infinity, massive jumps, sign flips with huge magnitudes.
 */
export function findDiscontinuities(
  fn: FunctionType,
  domain: [number, number],
  sampleDensity: number = 200
): number[] {
  const discontinuities: number[] = [];
  const step = (domain[1] - domain[0]) / sampleDensity;
  
  let prevX = domain[0];
  let prevY = evaluate(fn, prevX);
  
  for (let x = domain[0] + step; x <= domain[1]; x += step) {
    const y = evaluate(fn, x);
    
    // Detect undefined values
    if (y === null || !Number.isFinite(y)) {
      // Binary search to find exact discontinuity point
      const discX = findDiscontinuityPoint(fn, prevX, x);
      if (discX !== null && !discontinuities.some(d => Math.abs(d - discX) < 0.1)) {
        discontinuities.push(discX);
      }
      prevX = x;
      prevY = null;
      continue;
    }
    
    // Detect massive jumps (sign of asymptote)
    if (prevY !== null && Number.isFinite(prevY)) {
      const jump = Math.abs(y - prevY);
      const threshold = Math.max(50, Math.abs(prevY) * 10);
      
      if (jump > threshold) {
        // Likely crossing an asymptote
        const discX = findDiscontinuityPoint(fn, prevX, x);
        if (discX !== null && !discontinuities.some(d => Math.abs(d - discX) < 0.1)) {
          discontinuities.push(discX);
        }
      }
    }
    
    prevX = x;
    prevY = y;
  }
  
  return discontinuities.sort((a, b) => a - b);
}

/**
 * Binary search to find the exact point of discontinuity.
 */
function findDiscontinuityPoint(
  fn: FunctionType,
  x1: number,
  x2: number,
  maxIterations: number = 20
): number | null {
  for (let i = 0; i < maxIterations; i++) {
    const mid = (x1 + x2) / 2;
    const y = evaluate(fn, mid);
    
    if (y === null || !Number.isFinite(y) || Math.abs(y) > 1e10) {
      x2 = mid;
    } else {
      const yNext = evaluate(fn, mid + 0.001);
      if (yNext === null || !Number.isFinite(yNext) || Math.abs(yNext) > 1e10) {
        x1 = mid;
      } else {
        x1 = mid;
      }
    }
    
    if (Math.abs(x2 - x1) < 0.001) {
      return (x1 + x2) / 2;
    }
  }
  
  return (x1 + x2) / 2;
}

// ============================================
// CURVE GENERATION
// ============================================

/**
 * Generate curve data with automatic branch splitting at discontinuities.
 * Returns an array of GraphSeries (one per continuous branch).
 */
export function generateCurveData(
  fn: FunctionType,
  domain: [number, number],
  transforms: TransformSpec = IDENTITY_TRANSFORM,
  pointDensity: number = 150
): GraphSeries[] {
  const discontinuities = findDiscontinuities(fn, domain);
  
  // Define regions between discontinuities
  const regions: Array<[number, number]> = [];
  let regionStart = domain[0];
  
  for (const disc of discontinuities) {
    if (disc > regionStart + 0.1 && disc < domain[1] - 0.1) {
      regions.push([regionStart, disc - 0.05]);
      regionStart = disc + 0.05;
    }
  }
  regions.push([regionStart, domain[1]]);
  
  // Generate points for each region
  const branches: GraphSeries[] = [];
  
  for (let i = 0; i < regions.length; i++) {
    const [start, end] = regions[i];
    const regionWidth = end - start;
    const step = regionWidth / (pointDensity / regions.length);
    const points: GraphPoint[] = [];
    
    for (let x = start; x <= end; x += step) {
      // Apply input transformations (horizontal)
      let inputX = x;
      if (transforms.reflectY) inputX = -inputX;
      if (transforms.scaleX !== 1) inputX = inputX * transforms.scaleX;
      inputX = inputX - transforms.shiftX;
      
      const y = evaluate(fn, inputX);
      
      if (y !== null && Number.isFinite(y)) {
        // Apply output transformations (vertical)
        let outputY = y;
        outputY = outputY * transforms.scaleY;
        if (transforms.reflectX) outputY = -outputY;
        outputY = outputY + transforms.shiftY;
        
        if (Math.abs(outputY) <= 100) { // Reasonable y-range
          points.push({
            x: Math.round(x * 100) / 100,
            y: Math.round(outputY * 100) / 100,
          });
        }
      }
    }
    
    if (points.length >= 3) {
      branches.push({
        id: `branch-${i}`,
        label: i === 0 ? 'y = f(x)' : '',
        data: points,
        showLine: true,
        lineStyle: 'solid',
      });
    }
  }
  
  return branches;
}

/**
 * Apply transformation to existing curve data (for transformed curves).
 * This is useful when you already have base curve data and want to transform it.
 */
export function applyTransform(
  series: GraphSeries[],
  transforms: TransformSpec
): GraphSeries[] {
  return series.map((s, idx) => {
    const transformedData = s.data.map(point => {
      let newX = point.x;
      let newY = point.y;
      
      // Horizontal transformations (affect x-coordinate of output)
      // f(x - a) shifts curve RIGHT by a, so for display: newX = point.x + a
      newX = point.x + transforms.shiftX;
      if (transforms.scaleX !== 1) {
        newX = point.x / transforms.scaleX;
      }
      if (transforms.reflectY) {
        newX = -point.x;
      }
      
      // Vertical transformations (affect y-coordinate)
      newY = point.y * transforms.scaleY;
      if (transforms.reflectX) {
        newY = -newY;
      }
      newY = newY + transforms.shiftY;
      
      return {
        x: Math.round(newX * 100) / 100,
        y: Math.round(newY * 100) / 100,
      };
    }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    
    // Sort by x for proper line rendering
    transformedData.sort((a, b) => a.x - b.x);
    
    return {
      ...s,
      id: `transformed-${idx}`,
      label: idx === 0 ? 'Expected' : '',
      data: transformedData,
      lineStyle: 'dashed' as const,
      color: '#22c55e',
    };
  });
}

// ============================================
// COMPLEXITY VALIDATION
// ============================================

export interface SketchabilityResult {
  sketchable: boolean;
  reason?: string;
}

/**
 * Determine if a function is reasonable to sketch freehand.
 * Complex functions (too many asymptotes, high-degree reciprocals) should be downgraded.
 */
export function isSketchable(
  fn: FunctionType,
  domain: [number, number]
): SketchabilityResult {
  const discontinuities = findDiscontinuities(fn, domain);
  const visibleAsymptotes = discontinuities.filter(
    d => d > domain[0] + 0.5 && d < domain[1] - 0.5
  );
  
  // Rule 1: More than 2 asymptotes in visible range = too complex
  if (visibleAsymptotes.length > 2) {
    return {
      sketchable: false,
      reason: 'Too many asymptotes for freehand sketch',
    };
  }
  
  // Rule 2: Reciprocal of polynomial degree >= 3 with multiple roots
  if (fn.type === 'reciprocal') {
    const inner = fn.inner;
    if (inner.type === 'polynomial' && inner.coefficients.length > 3) {
      return {
        sketchable: false,
        reason: 'Complex reciprocal function',
      };
    }
    if (inner.type === 'factored_cubic' && inner.roots.length >= 3) {
      // Check if all roots are within visible domain
      const visibleRoots = inner.roots.filter(r => r > domain[0] && r < domain[1]);
      if (visibleRoots.length > 2) {
        return {
          sketchable: false,
          reason: 'Reciprocal with too many visible asymptotes',
        };
      }
    }
  }
  
  return { sketchable: true };
}

// ============================================
// KEY FEATURE EXTRACTION
// ============================================

export interface KeyFeatures {
  intercepts: { x: number[]; y: number | null };
  turningPoints: Array<{ x: number; y: number; type: 'max' | 'min' }>;
  asymptotes: { vertical: number[]; horizontal: number[] };
}

/**
 * Extract key features from a function for marking purposes.
 */
export function extractKeyFeatures(
  fn: FunctionType,
  domain: [number, number]
): KeyFeatures {
  const features: KeyFeatures = {
    intercepts: { x: [], y: null },
    turningPoints: [],
    asymptotes: { vertical: [], horizontal: [] },
  };
  
  // Y-intercept: f(0)
  const y0 = evaluate(fn, 0);
  if (y0 !== null && Number.isFinite(y0)) {
    features.intercepts.y = y0;
  }
  
  // X-intercepts: find zeros via sampling
  const step = (domain[1] - domain[0]) / 200;
  let prevY = evaluate(fn, domain[0]);
  
  for (let x = domain[0] + step; x <= domain[1]; x += step) {
    const y = evaluate(fn, x);
    if (y !== null && prevY !== null && y * prevY < 0) {
      // Sign change - zero crossing
      // Refine using binary search
      const zero = findZero(fn, x - step, x);
      if (zero !== null) {
        features.intercepts.x.push(Math.round(zero * 100) / 100);
      }
    }
    prevY = y;
  }
  
  // Vertical asymptotes (discontinuities)
  features.asymptotes.vertical = findDiscontinuities(fn, domain);
  
  // Horizontal asymptotes (check limits)
  const yFar = evaluate(fn, 1000);
  const yFarNeg = evaluate(fn, -1000);
  if (yFar !== null && Math.abs(yFar) < 10) {
    features.asymptotes.horizontal.push(Math.round(yFar * 100) / 100);
  }
  if (yFarNeg !== null && Math.abs(yFarNeg) < 10 && 
      !features.asymptotes.horizontal.includes(Math.round(yFarNeg * 100) / 100)) {
    features.asymptotes.horizontal.push(Math.round(yFarNeg * 100) / 100);
  }
  
  // Turning points (local maxima/minima) via sampling
  let prevSlope: number | null = null;
  for (let x = domain[0] + step; x <= domain[1] - step; x += step) {
    const y = evaluate(fn, x);
    const yPrev = evaluate(fn, x - step);
    const yNext = evaluate(fn, x + step);
    
    if (y !== null && yPrev !== null && yNext !== null) {
      const slopeBefore = y - yPrev;
      const slopeAfter = yNext - y;
      
      // Check for turning point
      if (slopeBefore > 0.01 && slopeAfter < -0.01) {
        // Local maximum
        features.turningPoints.push({
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          type: 'max',
        });
      } else if (slopeBefore < -0.01 && slopeAfter > 0.01) {
        // Local minimum
        features.turningPoints.push({
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          type: 'min',
        });
      }
    }
  }
  
  return features;
}

/**
 * Binary search to find a zero crossing.
 */
function findZero(fn: FunctionType, x1: number, x2: number): number | null {
  const y1 = evaluate(fn, x1);
  const y2 = evaluate(fn, x2);
  
  if (y1 === null || y2 === null || y1 * y2 > 0) {
    return null;
  }
  
  for (let i = 0; i < 20; i++) {
    const mid = (x1 + x2) / 2;
    const yMid = evaluate(fn, mid);
    
    if (yMid === null) return null;
    if (Math.abs(yMid) < 0.0001) return mid;
    
    if (y1! * yMid < 0) {
      x2 = mid;
    } else {
      x1 = mid;
    }
  }
  
  return (x1 + x2) / 2;
}

// ============================================
// FUNCTION PARSING (from question text)
// ============================================

/**
 * Parse a function expression from question text into a FunctionType.
 * This is more robust than regex-only parsing.
 */
export function parseFunctionFromText(text: string): FunctionType | null {
  const lowerText = text.toLowerCase();
  
  // Pattern: (x - a)^2(x + b) - quadratic factor
  const quadFactorMatch = text.match(/\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)\s*\^?\s*2\s*\*?\s*\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)/i);
  if (quadFactorMatch) {
    const sign1 = quadFactorMatch[1] === '-' ? 1 : -1;
    const repeatedRoot = sign1 * parseFloat(quadFactorMatch[2]);
    const sign2 = quadFactorMatch[3] === '-' ? 1 : -1;
    const singleRoot = sign2 * parseFloat(quadFactorMatch[4]);
    
    return {
      type: 'quadratic_factor',
      repeatedRoot,
      singleRoot,
    };
  }
  
  // Pattern: x(x + a)(x + b) - factored cubic through origin
  const factoredCubicMatch = text.match(/x\s*\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)\s*\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)/i);
  if (factoredCubicMatch) {
    const sign1 = factoredCubicMatch[1] === '-' ? -1 : 1;
    const a = sign1 * parseFloat(factoredCubicMatch[2]);
    const sign2 = factoredCubicMatch[3] === '-' ? -1 : 1;
    const b = sign2 * parseFloat(factoredCubicMatch[4]);
    
    return {
      type: 'factored_cubic',
      roots: [0, -a, -b].sort((x, y) => x - y),
    };
  }
  
  // Pattern: 1/x or 1/(x + a) - simple reciprocal
  if (/1\/x\b|y\s*=\s*1\/x\b/i.test(text)) {
    return {
      type: 'reciprocal',
      inner: { type: 'linear', slope: 1, intercept: 0 },
    };
  }
  
  // Pattern: 1/(x + a)
  const reciprocalLinearMatch = text.match(/1\/\s*\(\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*\)/i);
  if (reciprocalLinearMatch) {
    const sign = reciprocalLinearMatch[1] === '-' ? -1 : 1;
    const a = sign * parseFloat(reciprocalLinearMatch[2]);
    return {
      type: 'reciprocal',
      inner: { type: 'linear', slope: 1, intercept: a },
    };
  }
  
  // Pattern: complex reciprocal 1/(polynomial)
  if (/1\/\s*\(x\^?3|1\/\s*\(x\^?2[^)]*x/i.test(text)) {
    // Default to 1/(x(x-1)(x-2)) - common A-Level example
    return {
      type: 'reciprocal',
      inner: { type: 'factored_cubic', roots: [0, 1, 2] },
    };
  }
  
  // Pattern: quadratic (x - a)^2 or x^2
  if (/\(x\s*-\s*(\d+)\)\s*\^?\s*2/i.test(text) || /x\s*\^?\s*2\b/i.test(text)) {
    const vertexMatch = text.match(/\(x\s*-\s*(\d+(?:\.\d+)?)\)\s*\^?\s*2/i);
    if (vertexMatch) {
      const h = parseFloat(vertexMatch[1]);
      // (x - h)^2 = x^2 - 2hx + h^2
      return { type: 'quadratic', a: 1, b: -2 * h, c: h * h };
    }
    return { type: 'quadratic', a: 1, b: 0, c: 0 };
  }
  
  // Default: simple parabola
  if (/quadratic|parabola/i.test(text)) {
    return { type: 'quadratic', a: 1, b: 0, c: 0 };
  }
  
  if (/cubic/i.test(text)) {
    return { type: 'factored_cubic', roots: [0, -2, 1] };
  }
  
  return null;
}

/**
 * Parse transformation specification from question text.
 */
export function parseTransformFromText(text: string): TransformSpec {
  const transform: TransformSpec = { ...IDENTITY_TRANSFORM };
  
  // f(x + a) → shift LEFT by a (shiftX = -a for display)
  const shiftLeftMatch = text.match(/f\s*\(\s*x\s*\+\s*(\d+(?:\.\d+)?)\s*\)/i);
  if (shiftLeftMatch) {
    transform.shiftX = -parseFloat(shiftLeftMatch[1]);
  }
  
  // f(x - a) → shift RIGHT by a (shiftX = +a for display)
  const shiftRightMatch = text.match(/f\s*\(\s*x\s*-\s*(\d+(?:\.\d+)?)\s*\)/i);
  if (shiftRightMatch) {
    transform.shiftX = parseFloat(shiftRightMatch[1]);
  }
  
  // f(x) + a → shift UP
  const shiftUpMatch = text.match(/f\s*\(\s*x\s*\)\s*\+\s*(\d+(?:\.\d+)?)/i);
  if (shiftUpMatch) {
    transform.shiftY = parseFloat(shiftUpMatch[1]);
  }
  
  // f(x) - a → shift DOWN
  const shiftDownMatch = text.match(/f\s*\(\s*x\s*\)\s*-\s*(\d+(?:\.\d+)?)/i);
  if (shiftDownMatch) {
    transform.shiftY = -parseFloat(shiftDownMatch[1]);
  }
  
  // af(x) → vertical stretch by a
  const scaleYMatch = text.match(/(\d+(?:\.\d+)?)\s*f\s*\(\s*x\s*\)/i);
  if (scaleYMatch) {
    transform.scaleY = parseFloat(scaleYMatch[1]);
  }
  
  // f(ax) → horizontal compress by a
  const scaleXMatch = text.match(/f\s*\(\s*(\d+(?:\.\d+)?)\s*x\s*\)/i);
  if (scaleXMatch) {
    transform.scaleX = parseFloat(scaleXMatch[1]);
  }
  
  // -f(x) → reflect in x-axis
  if (/-\s*f\s*\(\s*x\s*\)/i.test(text) && !/\d\s*-\s*f/.test(text)) {
    transform.reflectX = true;
  }
  
  // f(-x) → reflect in y-axis
  if (/f\s*\(\s*-\s*x\s*\)/i.test(text)) {
    transform.reflectY = true;
  }
  
  return transform;
}

// ============================================
// SKETCH MARKING UTILITIES
// ============================================

export interface SketchMarkingResult {
  shapeCorrect: boolean;
  shapeMarks: number;
  interceptsCorrect: boolean;
  interceptMarks: number;
  asymptoteRespected: boolean;
  asymptoteMarks: number;
  orientationCorrect: boolean;
  orientationMarks: number;
  totalScore: number;
  totalMarks: number;
  feedback: string;
}

/**
 * Mark a student's sketch against expected features with tolerance.
 */
export function markSketch(
  studentPoints: GraphPoint[],
  expectedFeatures: KeyFeatures,
  totalMarks: number,
  tolerance: { intercepts: number; turningPoints: number; asymptoteAvoidance: number } = {
    intercepts: 1.0,
    turningPoints: 1.5,
    asymptoteAvoidance: 0.3,
  }
): SketchMarkingResult {
  const marksPerCriterion = totalMarks / 4;
  const result: SketchMarkingResult = {
    shapeCorrect: false,
    shapeMarks: 0,
    interceptsCorrect: false,
    interceptMarks: 0,
    asymptoteRespected: true,
    asymptoteMarks: marksPerCriterion,
    orientationCorrect: false,
    orientationMarks: 0,
    totalScore: 0,
    totalMarks: totalMarks,
    feedback: '',
  };
  
  if (studentPoints.length < 3) {
    result.feedback = 'Not enough points to assess sketch.';
    return result;
  }
  
  // Sort student points by x
  const sorted = [...studentPoints].sort((a, b) => a.x - b.x);
  
  // 1. Check x-intercepts (within tolerance)
  let interceptsFound = 0;
  for (const expectedX of expectedFeatures.intercepts.x) {
    const nearPoint = sorted.find(p => 
      Math.abs(p.x - expectedX) <= tolerance.intercepts &&
      Math.abs(p.y) <= tolerance.intercepts
    );
    if (nearPoint) interceptsFound++;
  }
  result.interceptsCorrect = interceptsFound >= expectedFeatures.intercepts.x.length * 0.5;
  result.interceptMarks = result.interceptsCorrect ? marksPerCriterion : 
    (interceptsFound / Math.max(1, expectedFeatures.intercepts.x.length)) * marksPerCriterion;
  
  // 2. Check asymptote avoidance
  for (const asymptote of expectedFeatures.asymptotes.vertical) {
    const crossing = sorted.find(p => Math.abs(p.x - asymptote) < tolerance.asymptoteAvoidance);
    if (crossing) {
      result.asymptoteRespected = false;
      result.asymptoteMarks = 0;
      break;
    }
  }
  
  // 3. Check shape (number of turning points roughly correct)
  // Detect turning points in student curve
  let studentTurningPoints = 0;
  for (let i = 1; i < sorted.length - 1; i++) {
    const prevSlope = sorted[i].y - sorted[i - 1].y;
    const nextSlope = sorted[i + 1].y - sorted[i].y;
    if ((prevSlope > 0.1 && nextSlope < -0.1) || (prevSlope < -0.1 && nextSlope > 0.1)) {
      studentTurningPoints++;
    }
  }
  const expectedTurningPoints = expectedFeatures.turningPoints.length;
  result.shapeCorrect = Math.abs(studentTurningPoints - expectedTurningPoints) <= 1;
  result.shapeMarks = result.shapeCorrect ? marksPerCriterion : 0;
  
  // 4. Check orientation (curve ends in correct quadrants)
  if (sorted.length >= 2) {
    const leftEnd = sorted[0];
    const rightEnd = sorted[sorted.length - 1];
    // Basic check: if expected function goes to +/- infinity, check student matches direction
    result.orientationCorrect = true; // Default to true for now
    result.orientationMarks = marksPerCriterion;
  }
  
  result.totalScore = Math.round((
    result.shapeMarks + 
    result.interceptMarks + 
    result.asymptoteMarks + 
    result.orientationMarks
  ) * 100) / 100;
  
  const feedbackParts: string[] = [];
  if (result.shapeCorrect) feedbackParts.push('✓ Shape correct');
  else feedbackParts.push('✗ Shape needs improvement');
  if (result.interceptsCorrect) feedbackParts.push('✓ Intercepts correct');
  else feedbackParts.push(`○ ${interceptsFound}/${expectedFeatures.intercepts.x.length} intercepts found`);
  if (result.asymptoteRespected) feedbackParts.push('✓ Asymptotes respected');
  else feedbackParts.push('✗ Curve crosses asymptote');
  
  result.feedback = feedbackParts.join('. ') + '.';
  
  return result;
}

/**
 * Logging utility for debugging math engine operations.
 */
export function logMathEngineOperation(
  operation: string,
  details: Record<string, unknown>
): void {
  console.info(`[MathEngine] ${operation}:`, details);
}
