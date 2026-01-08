// Graph Question Types - Phase 1: Interpretation and Plotting

// Data point for graphs
export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
}

// Series configuration for interpretation graphs
export interface GraphSeries {
  id: string;
  label: string;
  data: GraphPoint[];
  color?: string;
  showLine?: boolean; // For scatter: whether to connect points
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

// Base graph configuration
export interface GraphConfig {
  chartType: 'line' | 'scatter';
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  domainX?: [number, number]; // Optional fixed domain
  domainY?: [number, number];
  gridEnabled?: boolean;
  showTooltip?: boolean;
}

// Configuration for interpretation questions
export interface GraphInterpretationConfig extends GraphConfig {
  series: GraphSeries[];
  // Optional data table to display alongside graph
  dataTable?: {
    headers: string[];
    rows: Array<{ label: string; values: (string | number)[] }>;
  };
}

// Configuration for plotting questions
export interface GraphPlottingConfig extends GraphConfig {
  maxPoints?: number; // Maximum points student can plot
  snapToGrid?: boolean;
  stepX?: number; // Grid step for snapping
  stepY?: number;
  toleranceUnits?: number; // Tolerance for point matching in graph units
  showConnectLine?: boolean; // Whether to connect plotted points
  requiredPointCount?: number; // Exact number of points required
}

// Answer field types for interpretation questions
export interface GraphInterpretationField {
  id: string;
  type: 'numeric' | 'text' | 'mcq' | 'boolean';
  question: string;
  correctAnswer: string | number | boolean;
  tolerance?: number; // For numeric: ±tolerance (default 0.01 = 1%)
  decimals?: number; // Expected decimal places
  synonyms?: string[]; // For text: acceptable alternatives
  options?: string[]; // For MCQ: list of options
  marks?: number;
  // Multiple accepted answer formats for flexible grading
  // e.g. for gradient: ["2", "y=2x", "m=2", "gradient=2"]
  // e.g. for y-intercept: ["0", "(0,0)", "c=0", "intercept at 0"]
  acceptedFormats?: string[];
}

// Expected points for plotting questions
export interface GraphPlottingAnswer {
  expectedPoints: GraphPoint[];
  toleranceUnits: number;
  marksPerPoint?: number;
  requireOrder?: boolean; // Whether points must be in specific order
}

// Student response for interpretation
export interface GraphInterpretationResponse {
  _type: 'graph_interpretation';
  version: 1;
  answers: Record<string, string | number | boolean>; // fieldId -> value
}

// Student response for plotting
export interface GraphPlottingResponse {
  _type: 'graph_plotting';
  version: 1;
  points: GraphPoint[];
}

// Marking result for interpretation fields
export interface GraphInterpretationMarkingResult {
  perFieldResults: Record<string, {
    correct: boolean;
    earned: number;
    max: number;
    studentAnswer: string | number | boolean;
    correctAnswer: string | number | boolean;
    status: 'correct' | 'incorrect' | 'missed';
  }>;
  totalScore: number;
  totalMarks: number;
}

// Marking result for plotting
export interface GraphPlottingMarkingResult {
  perPointResults: Array<{
    studentPoint?: GraphPoint;
    expectedPoint: GraphPoint;
    matched: boolean;
    distance?: number;
    status: 'correct' | 'incorrect' | 'missed';
  }>;
  totalScore: number;
  totalMarks: number;
}

// Full question data structure (stored in correct_answer JSON)
export interface GraphQuestionData {
  graphType: 'interpretation' | 'plotting';
  graphConfig: GraphInterpretationConfig | GraphPlottingConfig;
  // For interpretation questions
  interpretationFields?: GraphInterpretationField[];
  // For plotting questions
  plottingAnswer?: GraphPlottingAnswer;
}

// Helper to parse graph question from correct_answer JSON
export function parseGraphQuestionData(correctAnswer: string | null): GraphQuestionData | null {
  if (!correctAnswer) return null;
  try {
    const parsed = JSON.parse(correctAnswer);
    if (parsed.graphType === 'interpretation' || parsed.graphType === 'plotting') {
      return parsed as GraphQuestionData;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to serialize graph interpretation response
export function serializeGraphInterpretationResponse(
  answers: Record<string, string | number | boolean>
): string {
  const response: GraphInterpretationResponse = {
    _type: 'graph_interpretation',
    version: 1,
    answers
  };
  return JSON.stringify(response);
}

// Helper to serialize graph plotting response
export function serializeGraphPlottingResponse(points: GraphPoint[]): string {
  const response: GraphPlottingResponse = {
    _type: 'graph_plotting',
    version: 1,
    points
  };
  return JSON.stringify(response);
}

// Helper to parse student's graph response
export function parseGraphResponse(
  answerText: string | null
): GraphInterpretationResponse | GraphPlottingResponse | null {
  if (!answerText) return null;
  try {
    const parsed = JSON.parse(answerText);
    if (parsed._type === 'graph_interpretation' || parsed._type === 'graph_plotting') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper: calculate Euclidean distance between two points
export function pointDistance(p1: GraphPoint, p2: GraphPoint): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}
