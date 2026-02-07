/**
 * Client-side Formula Evaluator
 * 
 * Safe mathematical expression evaluator for rendering graph curves in review mode.
 * Evaluates formula strings like "(x-1)*(x-3)*(x+2)" to y values at given x coordinates.
 * 
 * This provides a "Desmos-like" experience where the displayed curve is computed
 * directly from the mathematical formula, ensuring mathematical accuracy.
 */

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

/**
 * Tokenize a mathematical expression into individual tokens
 */
function tokenize(formula: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  
  while (i < formula.length) {
    const char = formula[i];
    
    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    
    // Numbers (including decimals)
    if (/[0-9.]/.test(char)) {
      let num = '';
      while (i < formula.length && /[0-9.]/.test(formula[i])) {
        num += formula[i];
        i++;
      }
      tokens.push(num);
      continue;
    }
    
    // Variables (x)
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
    
    // Function names (sin, cos, tan, sqrt, abs)
    if (/[a-zA-Z]/.test(char)) {
      let fn = '';
      while (i < formula.length && /[a-zA-Z]/.test(formula[i])) {
        fn += formula[i];
        i++;
      }
      tokens.push(fn.toLowerCase());
      continue;
    }
    
    // Skip unknown characters
    i++;
  }
  
  return tokens;
}

/**
 * Parse and evaluate a tokenized expression at a given x value.
 * Uses recursive descent parsing with proper operator precedence.
 */
function parseAndEvaluate(tokens: string[], x: number): number | null {
  let pos = 0;
  
  function peek(): string | null {
    return pos < tokens.length ? tokens[pos] : null;
  }
  
  function consume(): string {
    return tokens[pos++];
  }
  
  // Expression: handles + and -
  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (right === null) return null;
      
      if (op === '+') {
        left = left + right;
      } else {
        left = left - right;
      }
    }
    
    return left;
  }
  
  // Term: handles * and /
  function parseTerm(): number | null {
    let left = parsePower();
    if (left === null) return null;
    
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parsePower();
      if (right === null) return null;
      
      if (op === '*') {
        left = left * right;
      } else {
        if (right === 0) return null; // Division by zero
        left = left / right;
      }
    }
    
    // Handle implicit multiplication: 2x, (x+1)(x-1), etc.
    while (
      peek() &&
      (peek() === 'x' || peek() === '(' || /^[a-z]/.test(peek()!))
    ) {
      const right = parsePower();
      if (right === null) return null;
      left = left * right;
    }
    
    return left;
  }
  
  // Power: handles ^
  function parsePower(): number | null {
    let base = parseUnary();
    if (base === null) return null;
    
    if (peek() === '^') {
      consume();
      const exp = parsePower(); // Right-associative
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    
    return base;
  }
  
  // Unary: handles - prefix
  function parseUnary(): number | null {
    if (peek() === '-') {
      consume();
      const val = parseUnary();
      if (val === null) return null;
      return -val;
    }
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }
  
  // Primary: handles numbers, x, parentheses, and functions
  function parsePrimary(): number | null {
    const token = peek();
    
    if (token === null) return null;
    
    // Number
    if (/^[0-9.]/.test(token)) {
      consume();
      return parseFloat(token);
    }
    
    // Variable x
    if (token === 'x') {
      consume();
      return x;
    }
    
    // Parenthesized expression
    if (token === '(') {
      consume(); // consume '('
      const val = parseExpression();
      if (val === null) return null;
      if (peek() === ')') {
        consume(); // consume ')'
      }
      return val;
    }
    
    // Functions
    if (['sin', 'cos', 'tan', 'sqrt', 'abs', 'ln', 'log', 'exp'].includes(token)) {
      consume();
      if (peek() !== '(') return null;
      consume(); // consume '('
      const arg = parseExpression();
      if (arg === null) return null;
      if (peek() === ')') {
        consume(); // consume ')'
      }
      
      switch (token) {
        case 'sin': return Math.sin(arg);
        case 'cos': return Math.cos(arg);
        case 'tan': return Math.tan(arg);
        case 'sqrt': return arg < 0 ? null : Math.sqrt(arg);
        case 'abs': return Math.abs(arg);
        case 'ln': return arg <= 0 ? null : Math.log(arg);
        case 'log': return arg <= 0 ? null : Math.log10(arg);
        case 'exp': return Math.exp(arg);
        default: return null;
      }
    }
    
    // Constants
    if (token === 'pi') {
      consume();
      return Math.PI;
    }
    if (token === 'e') {
      consume();
      return Math.E;
    }
    
    return null;
  }
  
  const result = parseExpression();
  
  // Ensure we consumed all tokens
  if (pos < tokens.length) {
    // There are leftover tokens, which might indicate a parsing error
    // But allow it for now as long as we got a result
  }
  
  return result;
}

/**
 * Safely evaluate a mathematical formula at a given x value.
 * 
 * Supports:
 * - Operators: +, -, *, /, ^
 * - Parentheses
 * - Functions: sin, cos, tan, sqrt, abs, ln, log, exp
 * - Constants: pi, e
 * - Variable: x
 * 
 * @param formula - Mathematical expression like "(x-1)*(x-3)*(x+2)"
 * @param x - The x value to evaluate at
 * @returns The y value, or null if undefined/invalid
 */
export function evaluateFormula(formula: string, x: number): number | null {
  if (!formula || typeof formula !== 'string') {
    return null;
  }
  
  try {
    // CRITICAL: Strict sign handling for exam math
    // (x-1) means root at x=1; (x+2) means root at x=-2
    // Strip function definition prefixes like "f(x)=", "g(x)=", "p(x)=", "y="
    // These are common in AI-generated formulas but the evaluator only needs the RHS
    let stripped = formula.replace(/^[a-zA-Z]\(x\)\s*=\s*/, '').replace(/^y\s*=\s*/, '');
    
    let normalized = stripped
      .replace(/\s+/g, '') // Remove whitespace
      .replace(/--/g, '+') // Handle double negatives first
      .replace(/\+-/g, '-') // Clean up sign combinations
      .replace(/-\+/g, '-')
      .replace(/\+\+/g, '+')
      .replace(/\)\(/g, ')*(') // Add implicit multiplication between parentheses
      .replace(/(\d)\(/g, '$1*(') // Add implicit multiplication: 2(x) -> 2*(x)
      .replace(/\)(\d)/g, ')*$1') // Add implicit multiplication: (x)2 -> (x)*2
      .replace(/(\d)x/g, '$1*x') // Add implicit multiplication: 2x -> 2*x
      .replace(/x(\d)/g, 'x*$1') // Add implicit multiplication: x2 -> x*2
      .replace(/\)x/g, ')*x') // Add implicit multiplication: (...)x -> (...)*x
      .replace(/x\(/g, 'x*('); // Add implicit multiplication: x(...) -> x*(...)
    
    const tokens = tokenize(normalized);
    
    if (tokens.length === 0) {
      return null;
    }
    
    const result = parseAndEvaluate(tokens, x);
    
    // Validate result
    if (result === null || !Number.isFinite(result)) {
      return null;
    }
    
    return result;
  } catch (e) {
    console.warn('[FormulaEvaluator] Evaluation error:', e);
    return null;
  }
}

/**
 * Generate curve data from a formula string.
 * Automatically splits into branches at discontinuities (asymptotes).
 * 
 * REFINEMENT v4:
 * - Extended domain: Calculates points BEYOND visible axes to prevent "clipped" lines
 * - Increased Y-threshold: Allows curves to extend further before triggering discontinuity
 * - NO visual clamping: Let the SVG/canvas handle clipping naturally
 * 
 * @param formula - Mathematical expression
 * @param domain - [minX, maxX] range
 * @param pointDensity - Number of points to sample (default 300 for smoothness)
 * @returns Array of GraphSeries (one per continuous branch)
 */
export function generateCurveFromFormula(
  formula: string,
  domain: [number, number],
  pointDensity: number = 300
): GraphSeries[] {
  const branches: GraphSeries[] = [];
  let currentBranch: GraphPoint[] = [];
  
  // CRITICAL FIX: Extend domain by 20% on each side to prevent edge truncation
  // This ensures curves continue beyond the visible viewport
  const domainRange = domain[1] - domain[0];
  const extendedDomain: [number, number] = [
    domain[0] - domainRange * 0.2,
    domain[1] + domainRange * 0.2
  ];
  
  const step = (extendedDomain[1] - extendedDomain[0]) / (pointDensity * 1.4); // More points for extended domain
  
  let prevY: number | null = null;
  
  for (let x = extendedDomain[0]; x <= extendedDomain[1]; x += step) {
    const y = evaluateFormula(formula, x);
    
    // CRITICAL FIX: Greatly increased Y-threshold to prevent premature cutoff
    // Y values up to 1000 are allowed - let the canvas clipping handle overflow
    // Only true discontinuities (asymptotes, NaN) should trigger branch splits
    const isDiscontinuity = y === null || 
      !Number.isFinite(y) || 
      Math.abs(y) > 1000 || // INCREASED from 200 to 1000 to prevent truncation
      (prevY !== null && Math.abs(y - prevY) > 100); // INCREASED from 30 to 100 for smooth cubics
    
    if (isDiscontinuity) {
      // Save current branch if it has enough points
      if (currentBranch.length >= 3) {
        branches.push({
          id: `branch-${branches.length}`,
          label: branches.length === 0 ? 'Correct Answer' : '',
          data: [...currentBranch],
          showLine: true,
          lineStyle: 'solid', // FIXED: Answer lines should be SOLID, not dashed
          color: 'hsl(var(--success))',
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
  
  // Don't forget the last branch
  if (currentBranch.length >= 3) {
    branches.push({
      id: `branch-${branches.length}`,
      label: branches.length === 0 ? 'Correct Answer' : '',
      data: currentBranch,
      showLine: true,
      lineStyle: 'solid', // FIXED: Answer lines should be SOLID, not dashed
      color: 'hsl(var(--success))',
    });
  }
  
  return branches;
}

/**
 * Extract key mathematical features from a formula.
 * Used for marking and validation.
 */
export function extractKeyPointsFromFormula(
  formula: string,
  domain: [number, number]
): {
  xIntercepts: number[];
  yIntercept: number | null;
  turningPoints: Array<{ x: number; y: number; type: 'max' | 'min' }>;
} {
  const result = {
    xIntercepts: [] as number[],
    yIntercept: null as number | null,
    turningPoints: [] as Array<{ x: number; y: number; type: 'max' | 'min' }>,
  };
  
  // Y-intercept: f(0)
  const y0 = evaluateFormula(formula, 0);
  if (y0 !== null && Number.isFinite(y0)) {
    result.yIntercept = Math.round(y0 * 100) / 100;
  }
  
  // Sample to find x-intercepts and turning points
  const step = (domain[1] - domain[0]) / 200;
  let prevY = evaluateFormula(formula, domain[0]);
  let prevSlope: number | null = null;
  
  for (let x = domain[0] + step; x <= domain[1]; x += step) {
    const y = evaluateFormula(formula, x);
    
    if (y !== null && prevY !== null) {
      // X-intercept detection (sign change)
      if (prevY * y < 0) {
        // Binary search for exact intercept
        let lo = x - step;
        let hi = x;
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2;
          const yMid = evaluateFormula(formula, mid);
          if (yMid === null) break;
          if (Math.abs(yMid) < 0.001) {
            result.xIntercepts.push(Math.round(mid * 100) / 100);
            break;
          }
          if (prevY! * yMid < 0) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        if (result.xIntercepts.length === 0 || 
            Math.abs(result.xIntercepts[result.xIntercepts.length - 1] - ((lo + hi) / 2)) > 0.1) {
          result.xIntercepts.push(Math.round(((lo + hi) / 2) * 100) / 100);
        }
      }
      
      // Turning point detection
      const slope = y - prevY;
      if (prevSlope !== null) {
        if (prevSlope > 0.01 && slope < -0.01) {
          // Local maximum
          result.turningPoints.push({
            x: Math.round((x - step) * 100) / 100,
            y: Math.round(prevY * 100) / 100,
            type: 'max',
          });
        } else if (prevSlope < -0.01 && slope > 0.01) {
          // Local minimum
          result.turningPoints.push({
            x: Math.round((x - step) * 100) / 100,
            y: Math.round(prevY * 100) / 100,
            type: 'min',
          });
        }
      }
      prevSlope = slope;
    }
    
    prevY = y;
  }
  
  // Remove duplicate intercepts
  result.xIntercepts = [...new Set(result.xIntercepts)].sort((a, b) => a - b);
  
  return result;
}

/**
 * Parse a graph transformation from question text.
 * Detects patterns like f(x-2), -f(x), f(x)+3, 2f(x), f(-x), etc.
 * Returns a transform spec that can be applied to coordinate data or formulas.
 */
export function parseTransformFromQuestionText(text: string): {
  shiftX: number;
  shiftY: number;
  scaleX: number;
  scaleY: number;
  reflectX: boolean;
  reflectY: boolean;
} | null {
  const transform = { shiftX: 0, shiftY: 0, scaleX: 1, scaleY: 1, reflectX: false, reflectY: false };
  let found = false;
  
  // Match any single-letter function name: f, g, h, p, etc.
  // Pattern: [optional -][optional number] letter(expression) [optional +/- number]
  const fullPattern = /(-?\s*)?(\d+\.?\d*)?\s*([a-zA-Z])\s*\(\s*([^)]+)\s*\)\s*([+-]\s*\d+\.?\d*)?/;
  const match = text.match(fullPattern);
  
  if (!match) return null;
  
  const negPrefix = match[1]?.trim() === '-';
  const scaleFactor = match[2] ? parseFloat(match[2]) : 1;
  const innerExpr = match[4]?.trim();
  const verticalShift = match[5] ? parseFloat(match[5].replace(/\s/g, '')) : 0;
  
  // Parse inner expression for horizontal transforms
  if (innerExpr) {
    // f(-x) → reflect in y-axis
    if (/^-\s*x$/i.test(innerExpr)) {
      transform.reflectY = true;
      found = true;
    }
    // f(x - a) → shift RIGHT by a
    else if (/^x\s*-\s*(\d+\.?\d*)$/i.test(innerExpr)) {
      const shiftMatch = innerExpr.match(/^x\s*-\s*(\d+\.?\d*)$/i);
      if (shiftMatch) {
        transform.shiftX = parseFloat(shiftMatch[1]);
        found = true;
      }
    }
    // f(x + a) → shift LEFT by a
    else if (/^x\s*\+\s*(\d+\.?\d*)$/i.test(innerExpr)) {
      const shiftMatch = innerExpr.match(/^x\s*\+\s*(\d+\.?\d*)$/i);
      if (shiftMatch) {
        transform.shiftX = -parseFloat(shiftMatch[1]);
        found = true;
      }
    }
    // f(ax) or h(2x) → horizontal compression by factor a
    else if (/^(\d+\.?\d*)\s*x$/i.test(innerExpr)) {
      const scaleMatch = innerExpr.match(/^(\d+\.?\d*)\s*x$/i);
      if (scaleMatch) {
        transform.scaleX = parseFloat(scaleMatch[1]);
        found = true;
      }
    }
    // Just "x" means no horizontal transform
    else if (/^x$/i.test(innerExpr)) {
      found = true; // Still valid, just no horizontal transform
    }
  }
  
  // Vertical scale
  if (scaleFactor !== 1) {
    transform.scaleY = scaleFactor;
    found = true;
  }
  
  // -f(x) → reflect in x-axis
  if (negPrefix) {
    transform.reflectX = true;
    found = true;
  }
  
  // Vertical shift: f(x) + a or f(x) - a
  if (verticalShift !== 0) {
    transform.shiftY = verticalShift;
    found = true;
  }
  
  return found ? transform : null;
}

/**
 * Apply a coordinate-level transformation to an array of graph points.
 * Used as a fallback when no formula is available.
 */
export function applyCoordinateTransform(
  points: GraphPoint[],
  transform: { shiftX: number; shiftY: number; scaleX?: number; scaleY: number; reflectX: boolean; reflectY: boolean }
): GraphPoint[] {
  return points.map(pt => {
    let x = pt.x;
    let y = pt.y;
    
    // Horizontal scale: f(ax) compresses x by factor a
    // Each point (x, y) on f(x) maps to (x/a, y) on f(ax)
    if (transform.scaleX && transform.scaleX !== 1 && transform.scaleX !== 0) {
      x = x / transform.scaleX;
    }
    
    // Horizontal shift: f(x - a) shifts the curve RIGHT by a
    // Each point (x, y) on f(x) maps to (x + a, y) on f(x - a)
    x += transform.shiftX;
    
    // Horizontal reflection: f(-x) reflects in y-axis
    if (transform.reflectY) {
      x = -pt.x; // Use original x, not shifted
    }
    
    // Vertical scale
    y *= transform.scaleY;
    
    // Vertical reflection: -f(x)
    if (transform.reflectX) {
      y = -y;
    }
    
    // Vertical shift
    y += transform.shiftY;
    
    return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  });
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
 * @param baseFormula - Original formula like "x*(x+2)*(1-x)"
 * @param transform - Transformation specification
 * @returns New formula string with transformation applied
 */
export function applyFormulaTransform(
  baseFormula: string,
  transform: {
    shiftX?: number;
    shiftY?: number;
    scaleY?: number;
    scaleX?: number;
    reflectX?: boolean;
    reflectY?: boolean;
  }
): string {
  let formula = baseFormula;
  
  // =================================================================
  // HORIZONTAL TRANSFORMATIONS: Replace 'x' with transformed expression
  // =================================================================
  
  // f(x - a): shift RIGHT by a → replace x with (x - a)
  // f(x + a): shift LEFT by a → replace x with (x + a)
  // Note: shiftX > 0 means shift RIGHT, which is f(x - shiftX)
  if (transform.shiftX && transform.shiftX !== 0) {
    const shift = transform.shiftX;
    // shiftX > 0 means shift RIGHT, so f(x - shiftX)
    const replacement = shift > 0 ? `(x-${shift})` : `(x+${Math.abs(shift)})`;
    formula = formula.replace(/\bx\b/g, replacement);
  }
  
  // f(-x): Horizontal reflection (reflect in y-axis)
  if (transform.reflectY) {
    formula = formula.replace(/\bx\b/g, '(-x)');
  }
  
  // f(ax): Horizontal compression/stretch
  if (transform.scaleX && transform.scaleX !== 1 && transform.scaleX !== 0) {
    formula = formula.replace(/\bx\b/g, `(${transform.scaleX}*x)`);
  }
  
  // =================================================================
  // VERTICAL TRANSFORMATIONS: Wrap the entire formula
  // =================================================================
  
  let prefix = '';
  let suffix = '';
  
  // a*f(x): Vertical stretch/compression
  if (transform.scaleY && transform.scaleY !== 1) {
    prefix = `${transform.scaleY}*(`;
    suffix = ')';
  }
  
  // -f(x): Reflect in x-axis
  if (transform.reflectX) {
    prefix = '(-1)*(' + prefix;
    suffix = suffix + ')';
  }
  
  // f(x) + a or f(x) - a: Vertical shift
  if (transform.shiftY && transform.shiftY !== 0) {
    const shift = transform.shiftY;
    suffix = suffix + (shift > 0 ? `+${shift}` : `${shift}`);
  }
  
  // Apply vertical transformations by wrapping
  if (prefix || suffix) {
    formula = prefix + '(' + formula + ')' + suffix;
  }
  
  // Normalize the result to clean up redundant operators
  formula = formula
    .replace(/--/g, '+')
    .replace(/\+-/g, '-')
    .replace(/-\+/g, '-')
    .replace(/\+\+/g, '+');
  
  return formula;
}
