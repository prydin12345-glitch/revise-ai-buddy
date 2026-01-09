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

  // Validate series data (required for rendering)
  if (!Array.isArray(config.series) || config.series.length === 0) {
    errors.push('Missing or empty series array in graphConfig');
  } else {
    config.series.forEach((s: any, idx: number) => {
      if (!s.id) errors.push(`Series ${idx}: missing id`);
      if (!s.label) errors.push(`Series ${idx}: missing label`);
      if (!Array.isArray(s.data) || s.data.length === 0) {
        errors.push(`Series ${idx}: missing or empty data array`);
      } else {
        // Validate at least some points
        const validPoints = s.data.filter((p: any) => 
          typeof p.x === 'number' && typeof p.y === 'number'
        );
        if (validPoints.length === 0) {
          errors.push(`Series ${idx}: no valid {x, y} points`);
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
 * Generates a fallback graphSpec when LLM fails to provide one
 */
export function generateFallbackGraphSpec(
  questionType: string,
  questionText: string
): GraphQuestionData | null {
  const isInterpretation = questionType === 'graph_interpretation';
  const isPlotting = questionType === 'graph_plotting';

  if (!isInterpretation && !isPlotting) return null;

  // Extract potential context from question text
  const xLabelMatch = questionText.match(/x[- ]?axis[:\s]+([^,.]+)/i);
  const yLabelMatch = questionText.match(/y[- ]?axis[:\s]+([^,.]+)/i);

  // Generate sample linear data: y = 2x + 1
  const sampleData = Array.from({ length: 5 }, (_, i) => ({
    x: i * 2,
    y: 2 * (i * 2) + 1
  }));

  const baseConfig: GraphSpec = {
    chartType: 'line',
    xLabel: xLabelMatch?.[1]?.trim() || 'x',
    yLabel: yLabelMatch?.[1]?.trim() || 'y',
    xDomain: [0, 10],
    yDomain: [0, 25],
    grid: { show: true, stepX: 2, stepY: 5 },
    series: [{
      id: 's1',
      label: 'Data',
      data: sampleData,
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
          id: 'gradient',
          type: 'numeric',
          question: 'What is the gradient of the line?',
          correctAnswer: 2,
          tolerance: 0.1,
          marks: 1,
          acceptedFormats: ['2', 'y=2x', 'm=2']
        },
        {
          id: 'intercept',
          type: 'numeric',
          question: 'What is the y-intercept?',
          correctAnswer: 1,
          tolerance: 0.1,
          marks: 1,
          acceptedFormats: ['1', '(0,1)', 'c=1']
        }
      ]
    };
  }

  if (isPlotting) {
    return {
      graphType: 'plotting',
      graphConfig: {
        ...baseConfig,
        series: [] // Empty for plotting questions
      },
      plottingAnswer: {
        expectedPoints: sampleData.slice(0, 3), // First 3 points
        toleranceUnits: 0.5,
        marksPerPoint: 1
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
