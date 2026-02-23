// Graph Question Validator
// Ensures all graph questions have valid graphSpec before saving

export interface GraphSpec {
  chartType: 'line' | 'scatter' | 'bar';
  xLabel: string;
  yLabel: string;
  xDomain: [number, number];
  yDomain: [number, number];
  grid?: { show: boolean; stepX?: number; stepY?: number };
  series: Array<{
    id: string;
    label: string;
    data: Array<{ x: number; y: number }>;
    showLine?: boolean;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    color?: string;
  }>;
}

export interface GraphInterpretationField {
  id: string;
  type: 'numeric' | 'text' | 'mcq' | 'boolean';
  question: string;
  correctAnswer: string | number | boolean;
  tolerance?: number;
  marks?: number;
  options?: string[];
  acceptedFormats?: string[];
}

export interface GraphPlottingAnswer {
  expectedPoints: Array<{ x: number; y: number }>;
  toleranceUnits: number;
  marksPerPoint?: number;
  // Expected curve data for review mode rendering
  expectedCurve?: {
    id: string;
    label: string;
    data: Array<{ x: number; y: number }>;
    showLine?: boolean;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    color?: string;
  };
}

export interface GraphQuestionData {
  graphType: 'interpretation' | 'plotting';
  graphConfig: GraphSpec;
  interpretationFields?: GraphInterpretationField[];
  plottingAnswer?: GraphPlottingAnswer;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  repairHint?: string;
}

/**
 * Validates that a graph question has all required graphSpec data
 */
export function validateGraphQuestion(
  questionType: string,
  correctAnswer: unknown
): ValidationResult {
  const errors: string[] = [];

  // Only validate graph question types
  if (!questionType.startsWith('graph_')) {
    return { valid: true, errors: [] };
  }

  // Parse correct_answer if it's a string
  let graphData: any;
  if (typeof correctAnswer === 'string') {
    try {
      graphData = JSON.parse(correctAnswer);
    } catch {
      errors.push('correct_answer is not valid JSON');
      return {
        valid: false,
        errors,
        repairHint: 'Return correct_answer as a valid JSON object with graphType and graphConfig'
      };
    }
  } else if (typeof correctAnswer === 'object' && correctAnswer !== null) {
    graphData = correctAnswer;
  } else {
    errors.push('correct_answer is missing or invalid');
    return {
      valid: false,
      errors,
      repairHint: 'Include correct_answer with graphType, graphConfig, and series data'
    };
  }

  // Validate graphType
  if (!graphData.graphType) {
    errors.push('Missing graphType (must be "interpretation" or "plotting")');
  } else if (!['interpretation', 'plotting'].includes(graphData.graphType)) {
    errors.push(`Invalid graphType: ${graphData.graphType}`);
  }

  // Validate graphConfig exists
  if (!graphData.graphConfig) {
    errors.push('Missing graphConfig object');
    return {
      valid: false,
      errors,
      repairHint: 'Include graphConfig with chartType, xLabel, yLabel, xDomain, yDomain, and series array'
    };
  }

  const config = graphData.graphConfig;

  // Validate chartType
  if (!config.chartType) {
    errors.push('Missing chartType in graphConfig');
  } else if (!['line', 'scatter', 'bar'].includes(config.chartType)) {
    errors.push(`Invalid chartType: ${config.chartType}`);
  }

  // Validate axis labels
  if (!config.xLabel || typeof config.xLabel !== 'string') {
    errors.push('Missing or invalid xLabel');
  }
  if (!config.yLabel || typeof config.yLabel !== 'string') {
    errors.push('Missing or invalid yLabel');
  }

  // Validate domains (accept both domainX/domainY and xDomain/yDomain)
  const xDomain = config.domainX || config.xDomain;
  const yDomain = config.domainY || config.yDomain;
  
  if (!Array.isArray(xDomain) || xDomain.length !== 2) {
    errors.push('Missing or invalid domainX/xDomain (must be [min, max])');
  } else if (typeof xDomain[0] !== 'number' || typeof xDomain[1] !== 'number') {
    errors.push('domainX/xDomain values must be numbers');
  }

  if (!Array.isArray(yDomain) || yDomain.length !== 2) {
    errors.push('Missing or invalid domainY/yDomain (must be [min, max])');
  } else if (typeof yDomain[0] !== 'number' || typeof yDomain[1] !== 'number') {
    errors.push('domainY/yDomain values must be numbers');
  }

  // Validate series data (required for rendering a visible graph)
  if (!Array.isArray(config.series) || config.series.length === 0) {
    errors.push('Missing or empty series array in graphConfig - graph will not render');
  } else {
    config.series.forEach((s: any, idx: number) => {
      if (!s.id) errors.push(`Series ${idx}: missing id`);
      if (!s.label) errors.push(`Series ${idx}: missing label`);
      if (!Array.isArray(s.data) || s.data.length === 0) {
        errors.push(`Series ${idx}: missing or empty data array - graph will not render`);
      } else {
        // Validate we have enough valid points for a visible graph
        const validPoints = s.data.filter((p: any) => 
          typeof p.x === 'number' && typeof p.y === 'number'
        );
        if (validPoints.length === 0) {
          errors.push(`Series ${idx}: no valid {x, y} points - graph will not render`);
        } else if (validPoints.length < 3) {
          errors.push(`Series ${idx}: only ${validPoints.length} data points - need at least 3 for a visible graph`);
        }
      }
    });
  }

  // Type-specific validation
  if (graphData.graphType === 'interpretation') {
    // Must have interpretationFields
    if (!Array.isArray(graphData.interpretationFields) || graphData.interpretationFields.length === 0) {
      errors.push('graph_interpretation requires interpretationFields array');
    } else {
      graphData.interpretationFields.forEach((field: any, idx: number) => {
        if (!field.id) errors.push(`Field ${idx}: missing id`);
        if (!field.type) errors.push(`Field ${idx}: missing type`);
        if (!field.question) errors.push(`Field ${idx}: missing question`);
        if (field.correctAnswer === undefined) errors.push(`Field ${idx}: missing correctAnswer`);
      });
    }
  }

  if (graphData.graphType === 'plotting') {
    // Must have plottingAnswer
    if (!graphData.plottingAnswer) {
      errors.push('graph_plotting requires plottingAnswer object');
    } else {
      if (!Array.isArray(graphData.plottingAnswer.expectedPoints)) {
        errors.push('plottingAnswer.expectedPoints must be an array');
      } else if (graphData.plottingAnswer.expectedPoints.length === 0) {
        errors.push('plottingAnswer.expectedPoints cannot be empty');
      }
      if (typeof graphData.plottingAnswer.toleranceUnits !== 'number') {
        // Default tolerance is acceptable
        graphData.plottingAnswer.toleranceUnits = 0.5;
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      repairHint: `Graph question is missing required data. Ensure correct_answer includes:
- graphType: "${graphData.graphType || 'interpretation'}"
- graphConfig: { chartType, xLabel, yLabel, xDomain: [min, max], yDomain: [min, max], series: [{ id, label, data: [{x, y}] }] }
${graphData.graphType === 'interpretation' ? '- interpretationFields: [{ id, type, question, correctAnswer, marks }]' : ''}
${graphData.graphType === 'plotting' ? '- plottingAnswer: { expectedPoints: [{x, y}], toleranceUnits: 0.5 }' : ''}`
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Parses linear economics equations from question text.
 * Detects patterns like P = 150 - 3Q, P_D = 30 + 2Q, C = 5Q + 10
 */
export function parseLinearEquations(questionText: string): Array<{
  label: string;
  slope: number;
  intercept: number;
  variable: string;
}> {
  const equations: Array<{label: string; slope: number; intercept: number; variable: string}> = [];
  
  // Pattern 1: P = 150 - 3Q (intercept first, then slope*Q)
  const pattern1 = /(?:(P_?[DS]?|C|Y|TC|TR|MC|MR|AC|AR))\s*=\s*(-?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*Q/gi;
  let match;
  while ((match = pattern1.exec(questionText)) !== null) {
    const varName = match[1];
    const intercept = parseFloat(match[2]);
    const sign = match[3] === '+' ? 1 : -1;
    const slopeAbs = parseFloat(match[4]);
     const label = varName.includes('S') ? 'Supply (S)' : varName.includes('D') ? 'Demand (D)' : varName;
     equations.push({ label, slope: sign * slopeAbs, intercept, variable: 'Q' });
  }
  
  // Pattern 2: P = 3Q + 30 (slope*Q first, then intercept)
  const pattern2 = /(?:(P_?[DS]?|C|Y|TC|TR|MC|MR|AC|AR))\s*=\s*(-?\d+(?:\.\d+)?)\s*Q\s*([+-])\s*(\d+(?:\.\d+)?)/gi;
  while ((match = pattern2.exec(questionText)) !== null) {
    const varName = match[1];
    const slope = parseFloat(match[2]);
    const sign = match[3] === '+' ? 1 : -1;
    const intercept = sign * parseFloat(match[4]);
    // Skip if we already found this variable from pattern 1
     if (!equations.some(e => e.label === (varName.includes('S') ? 'Supply (S)' : varName.includes('D') ? 'Demand (D)' : varName))) {
       const label = varName.includes('S') ? 'Supply (S)' : varName.includes('D') ? 'Demand (D)' : varName;
       equations.push({ label, slope, intercept, variable: 'Q' });
    }
  }
  
  return equations;
}

/**
 * Generates a fallback graphSpec when LLM fails to provide one.
 * Now tries to intelligently parse the question to generate appropriate curves.
 */
export function generateFallbackGraphSpec(
  questionType: string,
  questionText: string
): GraphQuestionData | null {
  const isInterpretation = questionType === 'graph_interpretation';
  const isPlotting = questionType === 'graph_plotting';

  if (!isInterpretation && !isPlotting) return null;

  // Try to determine function type from question text
  const text = questionText.toLowerCase();
  const isQuadratic = /\(x[-+]?\d*\)\s*\^?\s*2|parabola|quadratic/i.test(text);
  const isCubic = /x\s*\([^)]+\)\s*\([^)]+\)|cubic|x\^3/i.test(text);
  const isReciprocal = /1\/\s*\(x|1\/x|reciprocal/i.test(text);
  
  // Extract key points mentioned in question
  const pointMatches = questionText.matchAll(/\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/g);
  const keyPoints: Array<{x: number, y: number}> = [];
  for (const match of pointMatches) {
    keyPoints.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
  }
  
  // Determine domain from key points
  let domainX: [number, number] = [-5, 5];
  let domainY: [number, number] = [-5, 10];
  
  if (keyPoints.length >= 2) {
    const xs = keyPoints.map(p => p.x);
    const ys = keyPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const xPad = Math.max(2, (maxX - minX) * 0.3);
    const yPad = Math.max(2, (maxY - minY) * 0.3);
    domainX = [Math.floor(minX - xPad), Math.ceil(maxX + xPad)];
    domainY = [Math.floor(minY - yPad), Math.ceil(maxY + yPad)];
  }
  
  // Generate curve data based on function type
  let curveData: Array<{x: number, y: number}> = [];
  
  if (isCubic) {
    // Generate cubic y = x(x+2)(1-x)
    domainX = [-4, 3];
    domainY = [-6, 4];
    for (let x = domainX[0]; x <= domainX[1]; x += 0.12) {
      const y = x * (x + 2) * (1 - x);
      if (Number.isFinite(y) && Math.abs(y) <= 20) {
        curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
      }
    }
  } else if (isReciprocal) {
    // Generate reciprocal y = 1/x as TWO SEPARATE BRANCHES
    // This prevents the rendering engine from connecting across the asymptote
    domainX = [-6, 6];
    domainY = [-5, 5];
    
    // Negative branch (x < 0)
    for (let x = domainX[0]; x <= -0.15; x += 0.1) {
      const y = 1 / x;
      if (Number.isFinite(y) && Math.abs(y) <= 8) {
        curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
      }
    }
    // Add a break point (NaN y-value) to separate branches visually
    // Note: connectNulls=false is needed in the renderer for this to work
    curveData.push({ x: 0, y: NaN });
    
    // Positive branch (x > 0)
    for (let x = 0.15; x <= domainX[1]; x += 0.1) {
      const y = 1 / x;
      if (Number.isFinite(y) && Math.abs(y) <= 8) {
        curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
      }
    }
  } else if (isQuadratic) {
    // Generate parabola y = (x-1)^2
    domainX = [-3, 5];
    domainY = [-1, 10];
    for (let x = domainX[0]; x <= domainX[1]; x += 0.15) {
      const y = Math.pow(x - 1, 2);
      curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
  } else if (keyPoints.length >= 3) {
    // Use Lagrange interpolation through key points
    const step = (domainX[1] - domainX[0]) / 50;
    for (let x = domainX[0]; x <= domainX[1]; x += step) {
      let y = 0;
      for (let i = 0; i < keyPoints.length; i++) {
        let term = keyPoints[i].y;
        for (let j = 0; j < keyPoints.length; j++) {
          if (i !== j && keyPoints[i].x !== keyPoints[j].x) {
            term *= (x - keyPoints[j].x) / (keyPoints[i].x - keyPoints[j].x);
          }
        }
        y += term;
      }
      if (Number.isFinite(y) && Math.abs(y) < 50) {
        curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
      }
    }
  } else {
    // *** NEW: Detect linear economics equations before defaulting to parabola ***
    const linearEquations = parseLinearEquations(questionText);
    
    if (linearEquations.length > 0) {
      console.info(`[Graph Fallback] Detected ${linearEquations.length} linear equation(s) in question text`);
      
      // Build multi-series from detected equations
      const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'];
      const allPoints: Array<{x: number, y: number}> = [];
      const series: Array<{id: string; label: string; data: Array<{x: number; y: number}>; showLine: boolean; lineStyle: 'solid'; color: string}> = [];
      
      // Solve for equilibrium if we have 2+ equations
      let equilibriumPoint: {x: number, y: number} | null = null;
      if (linearEquations.length >= 2) {
        const eq1 = linearEquations[0];
        const eq2 = linearEquations[1];
        // Solve: eq1.intercept + eq1.slope*Q = eq2.intercept + eq2.slope*Q
        const slopeDiff = eq1.slope - eq2.slope;
        if (slopeDiff !== 0) {
          const qEq = (eq2.intercept - eq1.intercept) / slopeDiff;
          const pEq = eq1.intercept + eq1.slope * qEq;
          if (qEq >= 0 && pEq >= 0) {
            equilibriumPoint = { 
              x: Math.round(qEq * 100) / 100, 
              y: Math.round(pEq * 100) / 100 
            };
          }
        }
      }
      
      linearEquations.forEach((eq, idx) => {
        const points: Array<{x: number; y: number}> = [];
        // Calculate x-intercept (where y=0) and y-intercept
        const xIntercept = eq.slope !== 0 ? -eq.intercept / eq.slope : 50;
        const maxX = Math.max(Math.abs(xIntercept), 10);
        const numPoints = 6;
        const step = maxX / (numPoints - 1);
        
        for (let i = 0; i < numPoints; i++) {
          const x = Math.round(i * step * 100) / 100;
          const y = Math.round((eq.intercept + eq.slope * x) * 100) / 100;
          if (y >= 0) { // Economics: only positive quadrant
            points.push({ x, y });
          }
        }
        
        // Inject equilibrium point if it doesn't already exist
        if (equilibriumPoint && !points.some(p => Math.abs(p.x - equilibriumPoint!.x) < 0.5)) {
          points.push(equilibriumPoint);
          points.sort((a, b) => a.x - b.x);
        }
        
        if (points.length < 2) {
          points.length = 0;
          points.push({ x: 0, y: eq.intercept });
          const endX = eq.slope !== 0 ? Math.abs(eq.intercept / eq.slope) : 50;
          points.push({ x: endX, y: 0 });
        }
        
        allPoints.push(...points);
        series.push({
          id: eq.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          label: eq.label,
          data: points,
          showLine: true,
          lineStyle: 'solid',
          color: colors[idx % colors.length]
        });
      });
      
      // Calculate domains from all points
      const allXs = allPoints.map(p => p.x);
      const allYs = allPoints.map(p => p.y);
      const maxXVal = Math.max(...allXs);
      const maxYVal = Math.max(...allYs);
      domainX = [0, Math.ceil(maxXVal * 1.1 / 5) * 5]; // Round up to nearest 5
      domainY = [0, Math.ceil(maxYVal * 1.1 / 10) * 10]; // Round up to nearest 10
      
      // Return early with multi-series economics graph
      const ecoConfig: GraphSpec = {
        chartType: 'line',
        xLabel: 'Quantity (Q)',
        yLabel: 'Price (P)',
        xDomain: domainX,
        yDomain: domainY,
        grid: { show: true, stepX: Math.ceil(domainX[1] / 10), stepY: Math.ceil(domainY[1] / 10) },
        series
      };
      
      if (isInterpretation) {
        return {
          graphType: 'interpretation',
          graphConfig: ecoConfig,
          interpretationFields: [{
            id: 'answer',
            type: 'text',
            question: 'Enter your answer based on the graph',
            correctAnswer: '',
            marks: 2,
          }]
        };
      }
      if (isPlotting) {
        return {
          graphType: 'plotting',
          graphConfig: { ...ecoConfig, series: [] },
          plottingAnswer: {
            expectedPoints: allPoints.slice(0, 5),
            toleranceUnits: Math.ceil(domainX[1] / 20),
            marksPerPoint: 1,
            expectedCurve: series[0] ? { ...series[0], lineStyle: 'dashed', color: '#22c55e' } : undefined
          }
        };
      }
    }
    
    // Default: simple parabola y = x^2 (only for math-like contexts)
    domainX = [-4, 4];
    domainY = [-2, 10];
    for (let x = domainX[0]; x <= domainX[1]; x += 0.15) {
      const y = x * x;
      curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
  }
  
  // Ensure we have enough points
  if (curveData.length < 10) {
    // Fallback to simple parabola
    curveData = [];
    domainX = [-4, 4];
    domainY = [-2, 10];
    for (let x = domainX[0]; x <= domainX[1]; x += 0.15) {
      curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(x * x * 100) / 100 });
    }
  }

  const baseConfig: GraphSpec = {
    chartType: 'line',
    xLabel: 'x',
    yLabel: 'y',
    xDomain: domainX,
    yDomain: domainY,
    grid: { show: true, stepX: 1, stepY: 1 },
    series: [{
      id: 'reference',
      label: 'y = f(x)',
      data: curveData,
      showLine: true,
      lineStyle: 'solid'
    }]
  };

  if (isInterpretation) {
    return {
      graphType: 'interpretation',
      graphConfig: baseConfig,
      interpretationFields: [
        {
          id: 'answer',
          type: 'text',
          question: 'Enter your answer based on the graph',
          correctAnswer: '',
          marks: 2,
        }
      ]
    };
  }

  if (isPlotting) {
    return {
      graphType: 'plotting',
      graphConfig: {
        ...baseConfig,
        series: [{
          id: 'reference',
          label: 'y = f(x)',
          data: curveData,
          showLine: true,
          lineStyle: 'solid',
          color: 'hsl(var(--primary))'
        }]
      },
      plottingAnswer: {
        expectedPoints: keyPoints.length > 0 ? keyPoints.slice(0, 5) : curveData.slice(0, 5).map(p => ({ x: p.x, y: p.y })),
        toleranceUnits: 0.5,
        marksPerPoint: 1,
        expectedCurve: {
          id: 'expected',
          label: 'Expected',
          data: curveData,
          showLine: true,
          lineStyle: 'dashed',
          color: '#22c55e'
        }
      }
    };
  }

  return null;
}

/**
 * Logs graph validation results for debugging
 */
export function logGraphValidation(
  questionNumber: string,
  result: ValidationResult
): void {
  if (!result.valid) {
    console.warn(`[Graph Validation] Question ${questionNumber} failed:`, result.errors);
    if (result.repairHint) {
      console.info(`[Graph Validation] Repair hint: ${result.repairHint}`);
    }
  }
}
