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
    // Generate reciprocal y = 1/x
    domainX = [-5, 5];
    domainY = [-5, 5];
    for (let x = domainX[0]; x <= domainX[1]; x += 0.1) {
      if (Math.abs(x) > 0.15) {
        const y = 1 / x;
        if (Number.isFinite(y) && Math.abs(y) <= 8) {
          curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
        }
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
    // Default: simple parabola y = x^2
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
