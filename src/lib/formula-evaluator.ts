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
    // Normalize the formula
    let normalized = formula
      .replace(/\s+/g, '') // Remove whitespace
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
 * @param formula - Mathematical expression
 * @param domain - [minX, maxX] range
 * @param pointDensity - Number of points to sample (default 150)
 * @returns Array of GraphSeries (one per continuous branch)
 */
export function generateCurveFromFormula(
  formula: string,
  domain: [number, number],
  pointDensity: number = 150
): GraphSeries[] {
  const branches: GraphSeries[] = [];
  let currentBranch: GraphPoint[] = [];
  const step = (domain[1] - domain[0]) / pointDensity;
  
  let prevY: number | null = null;
  
  for (let x = domain[0]; x <= domain[1]; x += step) {
    const y = evaluateFormula(formula, x);
    
    // Check for discontinuity
    const isDiscontinuity = y === null || 
      !Number.isFinite(y) || 
      Math.abs(y) > 200 || // Clamp to reasonable range
      (prevY !== null && Math.abs(y - prevY) > 50); // Large jump
    
    if (isDiscontinuity) {
      // Save current branch if it has enough points
      if (currentBranch.length >= 3) {
        branches.push({
          id: `branch-${branches.length}`,
          label: branches.length === 0 ? 'Correct Answer' : '',
          data: [...currentBranch],
          showLine: true,
          lineStyle: 'dashed',
          color: 'hsl(var(--success))',
        });
      }
      currentBranch = [];
      prevY = null;
    } else {
      currentBranch.push({
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
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
      lineStyle: 'dashed',
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
 * Apply a transformation to a formula string.
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
    reflectX?: boolean;
  }
): string {
  let formula = baseFormula;
  
  // Horizontal shift: f(x - a) means replace x with (x - a)
  if (transform.shiftX && transform.shiftX !== 0) {
    const shift = transform.shiftX;
    // Replace x with (x - shift)
    // Note: shiftX > 0 means shift RIGHT, so we use (x - shiftX)
    const replacement = shift > 0 ? `(x-${shift})` : `(x+${Math.abs(shift)})`;
    formula = formula.replace(/\bx\b/g, replacement);
  }
  
  // Vertical transformations are applied to the whole expression
  let prefix = '';
  let suffix = '';
  
  // Vertical scale: a*f(x)
  if (transform.scaleY && transform.scaleY !== 1) {
    prefix = `${transform.scaleY}*(`;
    suffix = ')';
  }
  
  // Vertical reflection: -f(x)
  if (transform.reflectX) {
    prefix = '-(' + prefix;
    suffix = suffix + ')';
  }
  
  // Vertical shift: f(x) + b
  if (transform.shiftY && transform.shiftY !== 0) {
    const shift = transform.shiftY;
    suffix = suffix + (shift > 0 ? `+${shift}` : `${shift}`);
  }
  
  if (prefix || suffix) {
    formula = prefix + formula + suffix;
  }
  
  return formula;
}
