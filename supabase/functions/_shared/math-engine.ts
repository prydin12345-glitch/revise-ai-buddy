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
 * Calculate a sensible, student-friendly domain based on key features.
 * Uses 1-unit step increments and consistent x/y scaling where possible.
 */
export function calculateStudentFriendlyDomain(
  fn: FunctionType,
  keyFeatures: KeyFeatures | null = null
): { x: [number, number]; y: [number, number]; stepX: number; stepY: number } {
  // Extract key points from function type
  let keyXValues: number[] = [0];
  let keyYValues: number[] = [0];
  
  // Collect roots/key points based on function type
  if (fn.type === 'factored_cubic') {
    keyXValues = [...fn.roots, 0];
  } else if (fn.type === 'quadratic_factor') {
    keyXValues = [fn.repeatedRoot, fn.singleRoot, 0];
  } else if (fn.type === 'reciprocal' && fn.inner.type === 'linear') {
    // Asymptote at x = -intercept/slope
    const asymptote = -fn.inner.intercept / fn.inner.slope;
    keyXValues = [asymptote - 2, asymptote + 2, 0];
  } else if (fn.type === 'quadratic') {
    // Vertex at x = -b/(2a)
    const vertex = -fn.b / (2 * fn.a);
    keyXValues = [vertex, 0];
  } else if (fn.type === 'linear') {
    // For linear functions: show x-intercept (where y = 0) and y-intercept
    // x-intercept: mx + b = 0 → x = -b/m (if slope != 0)
    if (fn.slope !== 0) {
      const xInt = -fn.intercept / fn.slope;
      keyXValues = [xInt, 0, -3, 3];
    } else {
      // Horizontal line (m = 0)
      keyXValues = [-5, 0, 5];
    }
    keyYValues = [fn.intercept, 0];
  } else if (fn.type === 'constant') {
    // Horizontal line at y = value
    keyXValues = [-5, 0, 5];
    keyYValues = [fn.value, 0];
  }
  
  // Add key features if provided
  if (keyFeatures) {
    keyXValues = keyXValues.concat(keyFeatures.intercepts.x);
    keyXValues = keyXValues.concat(keyFeatures.turningPoints.map(tp => tp.x));
    keyYValues = keyYValues.concat(keyFeatures.turningPoints.map(tp => tp.y));
    if (keyFeatures.intercepts.y !== null) {
      keyYValues.push(keyFeatures.intercepts.y);
    }
  }
  
  // Calculate x domain with integer padding
  const minX = Math.min(...keyXValues);
  const maxX = Math.max(...keyXValues);
  const xRange = maxX - minX;
  const xPad = Math.max(2, Math.ceil(xRange * 0.3));
  
  // Round to nice integer boundaries
  let xDomain: [number, number] = [
    Math.floor(minX - xPad),
    Math.ceil(maxX + xPad)
  ];
  
  // Clamp to reasonable range
  xDomain = [
    Math.max(-15, xDomain[0]),
    Math.min(15, xDomain[1])
  ];
  
  // Sample function to determine y range
  const samples: number[] = [];
  const step = (xDomain[1] - xDomain[0]) / 50;
  for (let x = xDomain[0]; x <= xDomain[1]; x += step) {
    const y = evaluate(fn, x);
    if (y !== null && Number.isFinite(y) && Math.abs(y) < 100) {
      samples.push(y);
    }
  }
  
  if (samples.length > 0) {
    keyYValues = keyYValues.concat(samples);
  }
  
  const minY = Math.min(...keyYValues.filter(y => Math.abs(y) < 100));
  const maxY = Math.max(...keyYValues.filter(y => Math.abs(y) < 100));
  const yRange = maxY - minY;
  const yPad = Math.max(2, Math.ceil(yRange * 0.2));
  
  let yDomain: [number, number] = [
    Math.floor(minY - yPad),
    Math.ceil(maxY + yPad)
  ];
  
  // Clamp y to reasonable range
  yDomain = [
    Math.max(-20, yDomain[0]),
    Math.min(20, yDomain[1])
  ];
  
  // Calculate step sizes - prefer 1 unit, but scale up if range is too large
  const xRangeActual = xDomain[1] - xDomain[0];
  const yRangeActual = yDomain[1] - yDomain[0];
  
  // Use 1-unit steps unless range is very large
  let stepX = 1;
  let stepY = 1;
  
  if (xRangeActual > 20) stepX = 2;
  if (xRangeActual > 40) stepX = 5;
  if (yRangeActual > 20) stepY = 2;
  if (yRangeActual > 40) stepY = 5;
  
  // Try to keep x and y steps consistent where sensible
  if (stepX === 1 && stepY === 1 && xRangeActual <= 15 && yRangeActual <= 15) {
    // Perfect: consistent 1-unit grid
  } else if (Math.abs(stepX - stepY) <= 1) {
    // Close enough - use average
    const avgStep = Math.round((stepX + stepY) / 2);
    stepX = avgStep;
    stepY = avgStep;
  }
  
  return { x: xDomain, y: yDomain, stepX, stepY };
}

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
    const step = regionWidth / Math.max(30, Math.floor(pointDensity / regions.length));
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
        
        // Allow larger y-range but still reasonable
        if (Math.abs(outputY) <= 200) {
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
 * Apply transformation to key features (intercepts, turning points, asymptotes).
 * Uses the same sign convention as curve generation:
 * - f(x - a) → shiftX = +a (shift RIGHT)
 * - f(x + a) → shiftX = -a (shift LEFT)
 * - f(x) + a → shiftY = +a (shift UP)
 * - -f(x) → reflectX = true (reflect in x-axis, swaps max/min)
 * - af(x) → scaleY = a (stretch vertically)
 */
export function transformKeyFeatures(
  features: KeyFeatures,
  transform: TransformSpec
): KeyFeatures {
  return {
    intercepts: {
      // X-intercepts: shift horizontally
      // For f(x-a)+b: original x-intercept xi where f(xi)=0
      // New curve: f(x-a)+b = 0 when x = xi + a (shifted right by a)
      x: features.intercepts.x.map(xi => xi + transform.shiftX),
      // Y-intercept: transform vertically
      // Original y-intercept y0 becomes y0 * scaleY * (reflectX ? -1 : 1) + shiftY
      y: features.intercepts.y !== null
        ? (features.intercepts.y * transform.scaleY * (transform.reflectX ? -1 : 1)) + transform.shiftY
        : null
    },
    turningPoints: features.turningPoints.map(tp => ({
      // Turning points shift horizontally
      x: tp.x + transform.shiftX,
      // Turning points transform vertically
      y: (tp.y * transform.scaleY * (transform.reflectX ? -1 : 1)) + transform.shiftY,
      // Reflection in x-axis swaps max ↔ min
      type: transform.reflectX 
        ? (tp.type === 'max' ? 'min' : 'max') 
        : tp.type
    })),
    asymptotes: {
      // Vertical asymptotes shift horizontally
      vertical: features.asymptotes.vertical.map(x => x + transform.shiftX),
      // Horizontal asymptotes transform vertically
      horizontal: features.asymptotes.horizontal.map(y =>
        (y * transform.scaleY * (transform.reflectX ? -1 : 1)) + transform.shiftY
      )
    }
  };
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
 * 
 * Enhanced with general factored cubic support for expressions like:
 * - (x-1)(x-3)(x+2) → roots at 1, 3, -2
 * - (x+1)(x-2)(x+4) → roots at -1, 2, -4
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
  
  // ============================================
  // NEW: General factored cubic (x±a)(x±b)(x±c)
  // This matches cubics NOT through origin like (x-1)(x-3)(x+2)
  // ============================================
  const generalFactoredCubicMatch = text.match(
    /\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)\s*\*?\s*\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)\s*\*?\s*\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)/i
  );
  if (generalFactoredCubicMatch) {
    // (x ± a)(x ± b)(x ± c) → roots at ∓a, ∓b, ∓c
    // e.g., (x-1)(x-3)(x+2) has roots at x=1, x=3, x=-2
    const roots = [
      (generalFactoredCubicMatch[1] === '-' ? 1 : -1) * parseFloat(generalFactoredCubicMatch[2]),
      (generalFactoredCubicMatch[3] === '-' ? 1 : -1) * parseFloat(generalFactoredCubicMatch[4]),
      (generalFactoredCubicMatch[5] === '-' ? 1 : -1) * parseFloat(generalFactoredCubicMatch[6])
    ];
    
    logMathEngineOperation('ParsedGeneralFactoredCubic', {
      match: generalFactoredCubicMatch[0],
      roots
    });
    
    return {
      type: 'factored_cubic',
      roots: roots.sort((a, b) => a - b),
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
  
  // ============================================
  // LINEAR FUNCTION PATTERNS (y = mx + b, y = x + c, y = ax)
  // These must come AFTER quadratic checks to avoid matching x^2 as linear
  // ============================================
  
  // Pattern: y = ax + b (full linear with both slope and intercept)
  // Match "y = 2x + 3" or "y = -3x - 5" etc.
  const fullLinearMatch = text.match(/y\s*=\s*(-?\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)/i);
  if (fullLinearMatch) {
    const slope = parseFloat(fullLinearMatch[1]);
    const sign = fullLinearMatch[2] === '-' ? -1 : 1;
    const intercept = sign * parseFloat(fullLinearMatch[3]);
    return { type: 'linear', slope, intercept };
  }
  
  // Pattern: y = x + b or y = x - b (slope = 1)
  // Match "y = x + 2" or "y = x - 1"
  const xPlusConstMatch = text.match(/y\s*=\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*(?:\.|,|$)/i);
  if (xPlusConstMatch) {
    const sign = xPlusConstMatch[1] === '-' ? -1 : 1;
    const intercept = sign * parseFloat(xPlusConstMatch[2]);
    return { type: 'linear', slope: 1, intercept };
  }
  
  // Pattern: y = ax (no constant, just slope)
  // Match "y = 2x" or "y = -3x"
  const slopeOnlyMatch = text.match(/y\s*=\s*(-?\d+(?:\.\d+)?)\s*x\s*(?:\.|,|$)/i);
  if (slopeOnlyMatch) {
    const slope = parseFloat(slopeOnlyMatch[1]);
    return { type: 'linear', slope, intercept: 0 };
  }
  
  // Pattern: y = x (identity line)
  // Must check explicitly to avoid false matches
  if (/y\s*=\s*x\s*(?:\.|,|$)/i.test(text) && !/y\s*=\s*x\s*[\^2\+\-\*]/i.test(text)) {
    return { type: 'linear', slope: 1, intercept: 0 };
  }
  
  // Pattern: y = b (constant/horizontal line)
  const constantMatch = text.match(/y\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:\.|,|$)/i);
  if (constantMatch && !/y\s*=\s*(-?\d+(?:\.\d+)?)\s*x/i.test(text)) {
    // Only match if there's no 'x' after the number
    const value = parseFloat(constantMatch[1]);
    return { type: 'constant', value };
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
 * 
 * CRITICAL FIX v4: Now supports ANY function name (f, g, h, p, etc.) not just 'f'.
 * Uses [a-zA-Z] to match any single-letter function name.
 */
export function parseTransformFromText(text: string): TransformSpec {
  const transform: TransformSpec = { ...IDENTITY_TRANSFORM };
  
  // Pattern for any single-letter function name: f, g, h, p, etc.
  const funcName = '[a-zA-Z]';
  
  // CRITICAL: Build regex patterns with dynamic function name matching
  
  // f(x + a) or g(x + a) → shift LEFT by a (shiftX = -a for display)
  const shiftLeftRegex = new RegExp(`${funcName}\\s*\\(\\s*x\\s*\\+\\s*(\\d+(?:\\.\\d+)?)\\s*\\)`, 'i');
  const shiftLeftMatch = text.match(shiftLeftRegex);
  if (shiftLeftMatch) {
    transform.shiftX = -parseFloat(shiftLeftMatch[1]);
    console.log(`[Transform] Detected shift LEFT: ${funcName}(x+${shiftLeftMatch[1]}) → shiftX = ${transform.shiftX}`);
  }
  
  // f(x - a) or g(x - a) → shift RIGHT by a (shiftX = +a for display)
  const shiftRightRegex = new RegExp(`${funcName}\\s*\\(\\s*x\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*\\)`, 'i');
  const shiftRightMatch = text.match(shiftRightRegex);
  if (shiftRightMatch) {
    transform.shiftX = parseFloat(shiftRightMatch[1]);
    console.log(`[Transform] Detected shift RIGHT: ${funcName}(x-${shiftRightMatch[1]}) → shiftX = ${transform.shiftX}`);
  }
  
  // f(x) + a or g(x) + a → shift UP
  const shiftUpRegex = new RegExp(`${funcName}\\s*\\(\\s*x\\s*\\)\\s*\\+\\s*(\\d+(?:\\.\\d+)?)`, 'i');
  const shiftUpMatch = text.match(shiftUpRegex);
  if (shiftUpMatch) {
    transform.shiftY = parseFloat(shiftUpMatch[1]);
    console.log(`[Transform] Detected shift UP: ${funcName}(x)+${shiftUpMatch[1]} → shiftY = ${transform.shiftY}`);
  }
  
  // f(x) - a or g(x) - a → shift DOWN
  const shiftDownRegex = new RegExp(`${funcName}\\s*\\(\\s*x\\s*\\)\\s*-\\s*(\\d+(?:\\.\\d+)?)`, 'i');
  const shiftDownMatch = text.match(shiftDownRegex);
  if (shiftDownMatch) {
    transform.shiftY = -parseFloat(shiftDownMatch[1]);
    console.log(`[Transform] Detected shift DOWN: ${funcName}(x)-${shiftDownMatch[1]} → shiftY = ${transform.shiftY}`);
  }
  
  // af(x) or 2g(x) → vertical stretch by a
  const scaleYRegex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${funcName}\\s*\\(\\s*x\\s*\\)`, 'i');
  const scaleYMatch = text.match(scaleYRegex);
  if (scaleYMatch) {
    transform.scaleY = parseFloat(scaleYMatch[1]);
    console.log(`[Transform] Detected vertical scale: ${scaleYMatch[1]}*${funcName}(x) → scaleY = ${transform.scaleY}`);
  }
  
  // f(ax) or g(2x) → horizontal compress by a
  const scaleXRegex = new RegExp(`${funcName}\\s*\\(\\s*(\\d+(?:\\.\\d+)?)\\s*x\\s*\\)`, 'i');
  const scaleXMatch = text.match(scaleXRegex);
  if (scaleXMatch) {
    transform.scaleX = parseFloat(scaleXMatch[1]);
    console.log(`[Transform] Detected horizontal compress: ${funcName}(${scaleXMatch[1]}x) → scaleX = ${transform.scaleX}`);
  }
  
  // -f(x) or -g(x) → reflect in x-axis
  // CRITICAL: Must not match "a - f(x)" pattern (subtraction)
  const reflectXRegex = new RegExp(`(?:^|[^\\d])\\s*-\\s*${funcName}\\s*\\(\\s*x\\s*\\)`, 'i');
  if (reflectXRegex.test(text) && !/\d\s*-\s*[a-zA-Z]\s*\(/i.test(text)) {
    transform.reflectX = true;
    console.log(`[Transform] Detected reflect in x-axis: -${funcName}(x)`);
  }
  
  // f(-x) or g(-x) → reflect in y-axis
  const reflectYRegex = new RegExp(`${funcName}\\s*\\(\\s*-\\s*x\\s*\\)`, 'i');
  if (reflectYRegex.test(text)) {
    transform.reflectY = true;
    console.log(`[Transform] Detected reflect in y-axis: ${funcName}(-x)`);
  }
  
  return transform;
}

// ============================================
// FORMULA STRING EVALUATION
// ============================================

/**
 * Extract a marking formula from question text.
 * 
 * CRITICAL FIX v5: Improved extraction that captures FULL expressions.
 * Instead of regex patterns that truncate, we:
 * 1. Find "y =" or "f(x) =" or "g(x) =" patterns
 * 2. Capture everything after = until a natural boundary (newline, period, comma)
 * 3. Handle complex expressions like "2 + 1/(x+1)" or "a*x(x-2)"
 * 
 * Validation: If formula contains asymptotes at specific x-values, verify
 * the formula is undefined at those points (e.g., 1/(x-2) is undefined at x=2).
 */
export function extractMarkingFormula(questionText: string): string | null {
  // CRITICAL: Match FULL expressions after "y =" or function notation
  // Capture everything until a natural boundary (newline, end of sentence, or specific delimiters)
  const patterns = [
    // y = <full expression until newline or period or comma>
    /y\s*=\s*([^,.\n]+?)(?:[,.\n]|$)/i,
    // f(x) = <expression> or g(x) = <expression>
    /[a-z]\(x\)\s*=\s*([^,.\n]+?)(?:[,.\n]|$)/i,
    // Just = <expression> (fallback for edge cases)
    /=\s*([^,.\n]+?)(?:[,.\n]|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = questionText.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Skip if it's just "correct" or other non-mathematical content
      if (extracted && !/^(correct|the|a|is|are|correct answer)/i.test(extracted)) {
        return normalizeFormulaExpression(extracted);
      }
    }
  }
  
  return null;
}

/**
 * Normalize a mathematical expression to evaluable format.
 * - Adds explicit multiplication: (x-1)(x-3) → (x-1)*(x-3)
 * - Handles exponents: x^2 → x^2 (unchanged, evaluator handles it)
 * 
 * CRITICAL: Sign handling for exam math:
 * - (x-1) means root at x=1 (solving x-1=0 gives x=1)
 * - (x+2) means root at x=-2 (solving x+2=0 gives x=-2)
 * The normalizer preserves signs exactly as written.
 */
export function normalizeFormulaExpression(expr: string): string {
  let result = expr;
  
  // Step 1: Remove whitespace first
  result = result.replace(/\s+/g, '');
  
  // Step 2: Handle double negatives FIRST before other transformations
  // --x → x, --( → (, -(-x) → x
  result = result.replace(/--/g, '+');
  
  // Step 3: Handle sign at start of parentheses content: (-x) stays as (-x)
  // But we need to ensure operators aren't duplicated: +-x → -x, -+x → -x
  result = result.replace(/\+-/g, '-');
  result = result.replace(/-\+/g, '-');
  
  // Step 4: Add explicit multiplication operators
  // (...)(...) → (...)*(...)
  result = result.replace(/\)\(/g, ')*(');
  
  // Step 5: Number followed by parenthesis: 2(x) → 2*(x)
  result = result.replace(/(\d)\(/g, '$1*(');
  
  // Step 6: Parenthesis followed by number: (x)2 → (x)*2
  result = result.replace(/\)(\d)/g, ')*$1');
  
  // Step 7: Number followed by x: 2x → 2*x (but preserve -x as -x)
  result = result.replace(/(\d)x/gi, '$1*x');
  
  // Step 8: x followed by number: x2 → x*2
  result = result.replace(/x(\d)/gi, 'x*$1');
  
  // Step 9: Parenthesis followed by x: (...)x → (...)*x  
  result = result.replace(/\)x/gi, ')*x');
  
  // Step 10: x followed by parenthesis: x(...) → x*(...)
  result = result.replace(/x\(/gi, 'x*(');
  
  // Step 11: Parenthesis followed by negative: )- with no operator → )*-
  // e.g., (x-1)-(x+2) stays as subtraction, but (x-1)(-2) → (x-1)*(-2)
  // We only add * when ) is followed by ( or a number or x
  // Already handled above
  
  // Step 12: Clean up any ++ that might have appeared
  result = result.replace(/\+\+/g, '+');
  
  return result;
}

/**
 * Safely evaluate a mathematical formula at a given x value.
 * This is a safe evaluator that doesn't use eval().
 */
export function evaluateFormulaAtX(formula: string, x: number): number | null {
  try {
    // Tokenize and parse the expression
    const tokens = tokenizeFormula(formula);
    if (tokens.length === 0) return null;
    
    return parseAndEvaluateTokens(tokens, x);
  } catch (e) {
    console.warn('[MathEngine] Formula evaluation error:', e);
    return null;
  }
}

/**
 * Tokenize a formula string into tokens for parsing.
 */
function tokenizeFormula(formula: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  
  while (i < formula.length) {
    const char = formula[i];
    
    // Skip whitespace
    if (/\s/.test(char)) { i++; continue; }
    
    // Numbers (including decimals)
    if (/[0-9.]/.test(char)) {
      let num = '';
      while (i < formula.length && /[0-9.]/.test(formula[i])) {
        num += formula[i++];
      }
      tokens.push(num);
      continue;
    }
    
    // Variable x
    if (char === 'x' || char === 'X') {
      tokens.push('x');
      i++;
      continue;
    }
    
    // Operators and parentheses
    if ('+-*/^()'.includes(char)) {
      tokens.push(char);
      i++;
      continue;
    }
    
    // Function names
    if (/[a-zA-Z]/.test(char)) {
      let fn = '';
      while (i < formula.length && /[a-zA-Z]/.test(formula[i])) {
        fn += formula[i++];
      }
      tokens.push(fn.toLowerCase());
      continue;
    }
    
    i++;
  }
  
  return tokens;
}

/**
 * Parse and evaluate tokenized expression using recursive descent.
 */
function parseAndEvaluateTokens(tokens: string[], x: number): number | null {
  let pos = 0;
  
  function peek(): string | null { return pos < tokens.length ? tokens[pos] : null; }
  function consume(): string { return tokens[pos++]; }
  
  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }
  
  function parseTerm(): number | null {
    let left = parsePower();
    if (left === null) return null;
    
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parsePower();
      if (right === null) return null;
      if (op === '/') {
        if (right === 0) return null;
        left = left / right;
      } else {
        left = left * right;
      }
    }
    
    // Implicit multiplication
    while (peek() && (peek() === 'x' || peek() === '(' || /^[a-z]/.test(peek()!))) {
      const right = parsePower();
      if (right === null) return null;
      left = left * right;
    }
    
    return left;
  }
  
  function parsePower(): number | null {
    let base = parseUnary();
    if (base === null) return null;
    
    if (peek() === '^') {
      consume();
      const exp = parsePower();
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  }
  
  function parseUnary(): number | null {
    if (peek() === '-') { consume(); const v = parseUnary(); return v === null ? null : -v; }
    if (peek() === '+') { consume(); return parseUnary(); }
    return parsePrimary();
  }
  
  function parsePrimary(): number | null {
    const token = peek();
    if (token === null) return null;
    
    if (/^[0-9.]/.test(token)) { consume(); return parseFloat(token); }
    if (token === 'x') { consume(); return x; }
    
    if (token === '(') {
      consume();
      const val = parseExpression();
      if (peek() === ')') consume();
      return val;
    }
    
    // Functions
    if (['sin', 'cos', 'tan', 'sqrt', 'abs'].includes(token)) {
      consume();
      if (peek() !== '(') return null;
      consume();
      const arg = parseExpression();
      if (arg === null) return null;
      if (peek() === ')') consume();
      
      switch (token) {
        case 'sin': return Math.sin(arg);
        case 'cos': return Math.cos(arg);
        case 'tan': return Math.tan(arg);
        case 'sqrt': return arg < 0 ? null : Math.sqrt(arg);
        case 'abs': return Math.abs(arg);
        default: return null;
      }
    }
    
    if (token === 'pi') { consume(); return Math.PI; }
    if (token === 'e') { consume(); return Math.E; }
    
    return null;
  }
  
  return parseExpression();
}

/**
 * Generate curve data from a formula string with discontinuity detection.
 * 
 * REFINEMENT: Uses 300 points by default (not 150) to ensure smooth curves
 * for cubic and reciprocal functions with sharp turns.
 */
export function generateCurveFromMarkingFormula(
  formula: string,
  domain: [number, number],
  pointDensity: number = 300 // INCREASED for smoother curves
): GraphSeries[] {
  const branches: GraphSeries[] = [];
  let currentBranch: GraphPoint[] = [];
  const step = (domain[1] - domain[0]) / pointDensity;
  let prevY: number | null = null;
  
  for (let x = domain[0]; x <= domain[1]; x += step) {
    const y = evaluateFormulaAtX(formula, x);
    
    // Discontinuity detection with adjusted thresholds
    const isDisc = y === null || !Number.isFinite(y) || Math.abs(y) > 200 ||
      (prevY !== null && Math.abs(y - prevY) > 30); // Lowered from 50 for better detection
    
    if (isDisc) {
      if (currentBranch.length >= 3) {
        branches.push({
          id: `branch-${branches.length}`,
          label: branches.length === 0 ? 'Expected' : '',
          data: [...currentBranch],
          showLine: true,
          lineStyle: 'dashed',
          color: '#22c55e',
        });
      }
      currentBranch = [];
      prevY = null;
    } else {
      currentBranch.push({
        x: Math.round(x * 1000) / 1000, // 3 decimal places for smoother curves
        y: Math.round(y * 1000) / 1000,
      });
      prevY = y;
    }
  }
  
  if (currentBranch.length >= 3) {
    branches.push({
      id: `branch-${branches.length}`,
      label: branches.length === 0 ? 'Expected' : '',
      data: currentBranch,
      showLine: true,
      lineStyle: 'dashed',
      color: '#22c55e',
    });
  }
  
  return branches;
}

/**
 * Apply a transformation to a formula string algebraically.
 * 
 * CRITICAL EXAM MATH CONVENTIONS:
 * - f(x - a) means shift RIGHT by a (standard notation)
 * - f(x + a) means shift LEFT by a
 * - For f(x-2): we replace 'x' with '(x-2)' in the formula
 * 
 * Example: If f(x) = x^2 + 2x, then:
 *   f(x-2) = (x-2)^2 + 2(x-2) = (x-2)^2 + 2*(x-2)
 * 
 * The transformation is ALGEBRAIC: we substitute the new expression for x.
 */
export function applyFormulaTransform(
  baseFormula: string,
  transform: TransformSpec
): string {
  let formula = baseFormula;
  
  logMathEngineOperation('ApplyFormulaTransform:Input', {
    baseFormula,
    transform
  });
  
  // =================================================================
  // HORIZONTAL TRANSFORMATIONS: Replace 'x' with transformed expression
  // =================================================================
  
  // f(x - a): shift RIGHT by a → replace x with (x - a)
  // f(x + a): shift LEFT by a → replace x with (x + a)
  // Note: shiftX > 0 means shift RIGHT, which is f(x - shiftX)
  if (transform.shiftX !== 0) {
    const shift = transform.shiftX;
    // shiftX > 0 means shift RIGHT, so f(x - shiftX)
    // shiftX < 0 means shift LEFT, so f(x - shiftX) where shiftX is negative
    const replacement = shift > 0 ? `(x-${shift})` : `(x+${Math.abs(shift)})`;
    // Use word boundary to avoid replacing 'x' inside other variable names
    formula = formula.replace(/\bx\b/g, replacement);
    
    logMathEngineOperation('ApplyFormulaTransform:HorizontalShift', {
      shift,
      replacement,
      result: formula
    });
  }
  
  // f(-x): Horizontal reflection (reflect in y-axis)
  if (transform.reflectY) {
    formula = formula.replace(/\bx\b/g, '(-x)');
    
    logMathEngineOperation('ApplyFormulaTransform:HorizontalReflection', {
      result: formula
    });
  }
  
  // f(ax): Horizontal compression/stretch (less common but supported)
  if (transform.scaleX !== 1 && transform.scaleX !== 0) {
    formula = formula.replace(/\bx\b/g, `(${transform.scaleX}*x)`);
    
    logMathEngineOperation('ApplyFormulaTransform:HorizontalScale', {
      scaleX: transform.scaleX,
      result: formula
    });
  }
  
  // =================================================================
  // VERTICAL TRANSFORMATIONS: Wrap the entire formula
  // =================================================================
  
  let prefix = '';
  let suffix = '';
  
  // a*f(x): Vertical stretch/compression
  if (transform.scaleY !== 1) {
    prefix = `${transform.scaleY}*(`;
    suffix = ')';
  }
  
  // -f(x): Reflect in x-axis
  if (transform.reflectX) {
    prefix = '(-1)*(' + prefix;
    suffix = suffix + ')';
  }
  
  // f(x) + a or f(x) - a: Vertical shift
  if (transform.shiftY !== 0) {
    const shift = transform.shiftY;
    suffix = suffix + (shift > 0 ? `+${shift}` : `${shift}`);
  }
  
  // Apply vertical transformations by wrapping
  if (prefix || suffix) {
    formula = prefix + '(' + formula + ')' + suffix;
  }
  
  // Normalize the result to clean up redundant operators
  formula = normalizeFormulaExpression(formula);
  
  logMathEngineOperation('ApplyFormulaTransform:Output', {
    baseFormula,
    transformedFormula: formula,
    transform
  });
  
  return formula;
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

// ============================================
// SECRET MARKING FORMULA GENERATOR (Audit v5 Fix #2)
// ============================================

/**
 * Generates a "secret" marking formula from question text describing features.
 * 
 * When a question says "sketch a curve with maximum at (-2, 4) and minimum at (1, -3)",
 * this function reverse-engineers a polynomial that passes through those points.
 * 
 * This gives the marking engine a mathematical "source of truth" even when
 * the student never sees an explicit equation.
 * 
 * @param questionText - The full question text
 * @returns A formula string or null if features couldn't be extracted
 */
export function generateSecretMarkingFormula(questionText: string): {
  formula: string | null;
  features: { maxima: Array<{x: number, y: number}>, minima: Array<{x: number, y: number}>, intercepts: number[] };
  isSecret: boolean;
} {
  const result = {
    formula: null as string | null,
    features: { maxima: [] as Array<{x: number, y: number}>, minima: [] as Array<{x: number, y: number}>, intercepts: [] as number[] },
    isSecret: true
  };
  
  const text = questionText.toLowerCase();
  
  // Extract maxima: "maximum at (-2, 4)" or "max at (2, 5)"
  const maxRegex = /(?:maximum|max|local\s*max)\s*(?:at|point)?\s*\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?/gi;
  let maxMatch;
  while ((maxMatch = maxRegex.exec(text)) !== null) {
    result.features.maxima.push({ x: parseFloat(maxMatch[1]), y: parseFloat(maxMatch[2]) });
  }
  
  // Extract minima: "minimum at (1, -3)" or "min at (0, -2)"
  const minRegex = /(?:minimum|min|local\s*min)\s*(?:at|point)?\s*\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?/gi;
  let minMatch;
  while ((minMatch = minRegex.exec(text)) !== null) {
    result.features.minima.push({ x: parseFloat(minMatch[1]), y: parseFloat(minMatch[2]) });
  }
  
  // Extract x-intercepts: "crosses x-axis at 3" or "x-intercept at -1"
  const interceptRegex = /(?:x-intercept|crosses\s*(?:the\s*)?x-axis|root)\s*(?:at)?\s*(-?\d+(?:\.\d+)?)/gi;
  let interceptMatch;
  while ((interceptMatch = interceptRegex.exec(text)) !== null) {
    result.features.intercepts.push(parseFloat(interceptMatch[1]));
  }
  
  // Also check for "passes through origin"
  if (/passes?\s*(?:through\s*)?(?:the\s*)?origin/i.test(text)) {
    if (!result.features.intercepts.includes(0)) {
      result.features.intercepts.push(0);
    }
  }
  
  logMathEngineOperation('SecretFormulaExtraction', result.features);
  
  // ============================================
  // CASE 1: One max + one min → fit a cubic
  // ============================================
  if (result.features.maxima.length >= 1 && result.features.minima.length >= 1) {
    const max = result.features.maxima[0];
    const min = result.features.minima[0];
    
    // For a cubic y = ax³ + bx² + cx + d with turning points at max and min:
    // The derivative 3ax² + 2bx + c = 0 at x = max.x and x = min.x
    // We use the fact that (x - max.x)(x - min.x) = 0 at turning points
    // So derivative = 3a(x - max.x)(x - min.x) = 3a(x² - (max.x + min.x)x + max.x*min.x)
    
    // For simplicity, construct a cubic that:
    // 1. Has turning points at max.x and min.x
    // 2. Passes through those y-values
    
    // Use a normalized cubic: y = a(x - max.x)²(x - r) where we solve for 'a' and 'r'
    // to match the y-values at turning points
    
    // Simpler approach: Use the form y = a(x - p)(x - q)(x - r)
    // where p, q, r are chosen to create the desired shape
    
    // For a "S-curve" cubic with max at max.x and min at min.x:
    // The inflection point is at (max.x + min.x) / 2
    // We can use: y = A(x - max.x + d)(x - max.x)(x - min.x - d) where d controls shape
    
    // Actually, let's use a more direct approach:
    // A cubic with turning points at x = a and x = b has derivative proportional to (x-a)(x-b)
    // So y' = k(x - max.x)(x - min.x) = kx² - k(max.x + min.x)x + k*max.x*min.x
    // Integrating: y = (k/3)x³ - (k/2)(max.x + min.x)x² + k*max.x*min.x*x + C
    
    // To find k and C, we use the conditions:
    // y(max.x) = max.y
    // y(min.x) = min.y
    
    // For exam purposes, let's use a well-behaved cubic approximation:
    // Find the coefficient 'a' such that the cubic has the right amplitude
    
    const xMax = max.x;
    const yMax = max.y;
    const xMin = min.x;
    const yMin = min.y;
    
    // Use a cubic of form: y = a(x - xMax)(x - xMid)(x - xEnd) adjusted for turning points
    // Simplified: y = -a(x - xMax)²(x - (2*xMin - xMax)) for a curve with max then min
    
    // Even simpler - use a standard form and adjust:
    // For a downward-opening max at x=xMax: leading coef < 0
    // Cubic: y = -a(x - r1)(x - r2)(x - r3)
    
    // Best approach for exam: construct from the turning point condition
    // y = a * integrate((x - xMax)(x - xMin)) + offset
    // = a * (x³/3 - (xMax+xMin)x²/2 + xMax*xMin*x) + C
    
    // Let's use: a = 6 * (yMin - yMax) / ((xMin - xMax)³)
    // This scales the standard shape to match the amplitude
    
    const dx = xMin - xMax;
    const dy = yMin - yMax;
    
    if (Math.abs(dx) > 0.01) {
      // Coefficient that matches the amplitude between turning points
      const a = -4 * dy / (dx * dx * dx);
      
      // Construct the formula with the turning point positions
      // y = a(x - xMax)²(x - (2*xMin - xMax)) would have max at xMax
      // But we need a cleaner formula...
      
      // Use: y = a(x - xMax)(x - h)² where h is calculated
      // Actually for exam, use: y = a*(x - r1)(x - r2)(x - r3) form
      
      // Simplest robust approach: cubic through points
      // y = A*x³ + B*x² + C*x + D
      // With conditions: y'(xMax) = 0, y'(xMin) = 0, y(xMax) = yMax, y(xMin) = yMin
      
      // For a cleaner formula, use the form:
      // The curve is defined by its shape - let's construct from roots
      // If there's an intercept at origin, use that
      
      let formula: string;
      
      if (result.features.intercepts.includes(0)) {
        // Passes through origin - use factored form x(x - a)(x - b)
        // We need to find a and b such that turning points match
        // This is complex, so use a standard scaled form
        const scale = Math.abs(yMax) > Math.abs(yMin) ? Math.abs(yMax) : Math.abs(yMin);
        const sign = yMax > 0 ? 1 : -1;
        
        // Use: y = sign * scale * x * (x - xMax - 1) * (x - xMin + 1) / normalization
        const r1 = xMax - 1;
        const r2 = xMin + 1;
        
        // Evaluate at xMax to find scaling factor
        const yAtXMax = xMax * (xMax - r1) * (xMax - r2);
        const scaleFactor = yMax / (yAtXMax || 1);
        
        formula = `${scaleFactor.toFixed(4)}*x*(x${r1 >= 0 ? '-' : '+'}${Math.abs(r1).toFixed(2)})*(x${r2 >= 0 ? '-' : '+'}${Math.abs(r2).toFixed(2)})`;
      } else {
        // General cubic - use numerical fit
        // y = a(x - xMax)²(x - b) where b is chosen for min position
        // At xMin: y' = 0, so xMin is also a turning point
        // This form only has one TP at xMax, so we need a different form
        
        // Use: y = a(x - p)(x - xMax)(x - q) where p and q are roots
        // The turning points are at x = (p + xMax + q ± sqrt(...))/3
        
        // For robustness, use a simplified scaled form:
        const midX = (xMax + xMin) / 2;
        const amplitude = (yMax - yMin) / 2;
        const midY = (yMax + yMin) / 2;
        
        // Use a scaled "standard cubic" centered at midpoint
        // y = A(x - midX)³ + B(x - midX) + midY
        // where A and B are chosen to match turning points
        
        // For standard cubic x³ - 3x, turning points are at x = ±1 with y = ∓2
        // Scale x by (xMax - midX) and y by amplitude
        
        const xScale = Math.abs(xMax - midX);
        if (xScale > 0.01) {
          // y = A*((x - midX)/xScale)³ - 3*A*((x - midX)/xScale) + midY
          // At x = xMax: y = yMax
          // ((xMax - midX)/xScale)³ = 1, so 1 - 3 = -2
          // yMax = -2A + midY → A = (midY - yMax) / 2 = -amplitude
          
          const A = -amplitude / 2; // divided by standard amplitude of 2
          
          formula = `${A.toFixed(4)}*((x-${midX.toFixed(2)})/${xScale.toFixed(2)})^3-${(3*A).toFixed(4)}*((x-${midX.toFixed(2)})/${xScale.toFixed(2)})+${midY.toFixed(2)}`;
        } else {
          // Fallback: just a parabola-like shape
          formula = `${(yMax).toFixed(2)}-${(Math.abs(dy / 2)).toFixed(2)}*(x-${xMax.toFixed(2)})^2`;
        }
      }
      
      result.formula = formula;
      logMathEngineOperation('SecretFormula:CubicFromTurningPoints', { max, min, formula });
    }
  }
  
  // ============================================
  // CASE 2: Multiple x-intercepts → factored form
  // ============================================
  else if (result.features.intercepts.length >= 2) {
    const roots = result.features.intercepts.sort((a, b) => a - b);
    
    if (roots.length === 3) {
      // Cubic with three roots
      const terms = roots.map(r => r === 0 ? 'x' : `(x${r < 0 ? '+' : '-'}${Math.abs(r)})`);
      result.formula = terms.join('*');
    } else if (roots.length === 2) {
      // Quadratic or cubic through origin
      if (roots.includes(0)) {
        // x(x - r)
        const other = roots.find(r => r !== 0) || 1;
        result.formula = `x*(x${other < 0 ? '+' : '-'}${Math.abs(other)})`;
      } else {
        // (x - r1)(x - r2)
        result.formula = `(x${roots[0] < 0 ? '+' : '-'}${Math.abs(roots[0])})*(x${roots[1] < 0 ? '+' : '-'}${Math.abs(roots[1])})`;
      }
    }
    
    logMathEngineOperation('SecretFormula:FactoredFromIntercepts', { roots, formula: result.formula });
  }
  
  // ============================================
  // CASE 3: Single turning point → quadratic
  // ============================================
  else if (result.features.maxima.length === 1 && result.features.minima.length === 0) {
    const max = result.features.maxima[0];
    // Downward parabola: y = -(x - h)² + k
    result.formula = `-1*(x-${max.x})^2+${max.y}`;
    logMathEngineOperation('SecretFormula:ParabolaFromMax', { max, formula: result.formula });
  }
  else if (result.features.minima.length === 1 && result.features.maxima.length === 0) {
    const min = result.features.minima[0];
    // Upward parabola: y = (x - h)² + k
    result.formula = `(x-${min.x})^2+${min.y}`;
    logMathEngineOperation('SecretFormula:ParabolaFromMin', { min, formula: result.formula });
  }
  
  return result;
}

// ============================================
// ASYMPTOTE VALIDATION (Audit v5 Fix #3)
// ============================================

/**
 * Validates that a rational function question has a valid markingFormula
 * with correct asymptotic behavior.
 * 
 * @param questionText - The question text
 * @param markingFormula - The formula to validate
 * @returns Validation result with details
 */
export function validateAsymptoteQuestion(
  questionText: string,
  markingFormula: string | null
): {
  valid: boolean;
  reason?: string;
  expectedAsymptotes: number[];
  actualAsymptotes: number[];
  plotPointCount: number;
} {
  const result = {
    valid: true,
    expectedAsymptotes: [] as number[],
    actualAsymptotes: [] as number[],
    plotPointCount: 0,
    reason: undefined as string | undefined
  };
  
  // Extract expected asymptotes from question text
  const asymptoteRegex = /(?:vertical\s*)?asymptote\s*(?:at)?\s*x\s*=\s*(-?\d+(?:\.\d+)?)/gi;
  let match;
  while ((match = asymptoteRegex.exec(questionText)) !== null) {
    result.expectedAsymptotes.push(parseFloat(match[1]));
  }
  
  // If no asymptotes mentioned but text contains "1/" or "reciprocal", check for them
  if (result.expectedAsymptotes.length === 0) {
    if (/1\/|reciprocal|undefined\s*at/i.test(questionText)) {
      // There should be asymptotes but they weren't explicitly stated
      // This is a warning but not necessarily invalid
    }
  }
  
  // If no formula, can't validate
  if (!markingFormula) {
    if (result.expectedAsymptotes.length > 0) {
      result.valid = false;
      result.reason = 'Asymptote question has no markingFormula';
    }
    return result;
  }
  
  // Test the formula to find actual asymptotes and count valid points
  const domain: [number, number] = [-10, 10];
  const step = 0.05;
  let validPoints = 0;
  
  for (let x = domain[0]; x <= domain[1]; x += step) {
    const y = evaluateFormulaAtX(markingFormula, x);
    
    if (y !== null && Number.isFinite(y) && Math.abs(y) < 1000) {
      validPoints++;
    } else {
      // Check if this is near an expected asymptote
      const nearExpected = result.expectedAsymptotes.some(a => Math.abs(x - a) < 0.5);
      if (!nearExpected && (y === null || !Number.isFinite(y))) {
        // Found an asymptote not mentioned in the question
        const nearbyAsymptote = Math.round(x * 10) / 10;
        if (!result.actualAsymptotes.some(a => Math.abs(a - nearbyAsymptote) < 0.3)) {
          result.actualAsymptotes.push(nearbyAsymptote);
        }
      }
    }
  }
  
  result.plotPointCount = validPoints;
  
  // Validation checks
  
  // Check 1: Must have at least 50 valid plot points
  if (validPoints < 50) {
    result.valid = false;
    result.reason = `Insufficient plot points (${validPoints} < 50). Formula may be malformed.`;
    return result;
  }
  
  // Check 2: If asymptotes expected, formula must be undefined at those x values
  for (const expected of result.expectedAsymptotes) {
    const yAtAsymptote = evaluateFormulaAtX(markingFormula, expected);
    
    if (yAtAsymptote !== null && Number.isFinite(yAtAsymptote) && Math.abs(yAtAsymptote) < 100) {
      result.valid = false;
      result.reason = `Formula is defined at x=${expected} but should have asymptote there`;
      return result;
    }
  }
  
  logMathEngineOperation('AsymptoteValidation', {
    questionText: questionText.substring(0, 100),
    formula: markingFormula,
    expectedAsymptotes: result.expectedAsymptotes,
    actualAsymptotes: result.actualAsymptotes,
    plotPointCount: result.plotPointCount,
    valid: result.valid
  });
  
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
