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
  // Join points mode configuration
  joinPointsMode?: {
    enabled: boolean;
    graded?: boolean; // If true, adds 1 mark for correct mode selection
    correctMode?: 'straight' | 'curved'; // Required answer if graded
    defaultMode?: 'straight' | 'curved';
  };
  // Tolerance for x and y separately (default ±0.2)
  toleranceX?: number;
  toleranceY?: number;
}

// Configuration for bearings questions
export interface BearingsQuestionConfig {
  prompt: string;
  correctBearing: number; // 0-360
  tolerance?: number; // Default ±1°
  acceptedFormats?: string[]; // e.g., ["N45E", "045°"]
  marks?: number;
}

// Bearings question response
export interface BearingsResponse {
  _type: 'bearings';
  version: 1;
  bearing: number | string; // Student's answer
}

// Bearings marking result
export interface BearingsMarkingResult {
  correct: boolean;
  studentBearing: number | null;
  correctBearing: number;
  tolerance: number;
  difference: number | null;
  status: 'correct' | 'incorrect' | 'missed';
  earned: number;
  max: number;
}

// Answer field types for interpretation questions
export interface GraphInterpretationField {
  id: string;
  type: 'numeric' | 'text' | 'mcq' | 'boolean';
  question: string;
  correctAnswer: string | number | boolean;
  tolerance?: number; // For numeric: relative tolerance (default 0.01 = 1%)
  estimateTolerance?: number; // For "read-off" questions: absolute tolerance in units (default ±1)
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

// Line segment for connecting points
export interface LineSegment {
  id: string;
  from: GraphPoint;
  to: GraphPoint;
  mode: 'straight' | 'curved';
  /**
   * Control point for curved segments (in data coordinates).
   * When undefined, a default curve is calculated.
   * User can drag to adjust bulge/direction.
   */
  controlPoint?: GraphPoint;
}

// Freeform drawing path (stores pixel coordinates)
export interface DrawingPath {
  id: string;
  points: Array<{ pixelX: number; pixelY: number }>;
}

/**
 * Student response for plotting questions.
 * 
 * Join modes work differently:
 * - 'straight': Uses explicit `segments` array - student draws individual line segments between points
 * - 'curved': Renders a smooth Catmull-Rom spline through ALL points (sorted by x).
 *             Requires 3+ points. No explicit segments needed - the curve is defined by point positions.
 * - 'freeform': Uses `drawnPaths` array - student draws freehand lines
 * 
 * For grading curved mode:
 * - Backend reconstructs the spline from `points` array using the same Catmull-Rom algorithm
 * - Samples the curve at multiple positions to verify it passes through expected regions
 */
export interface GraphPlottingResponse {
  _type: 'graph_plotting';
  version: 1;
  points: GraphPoint[];
  /** 
   * Selected join mode:
   * - 'straight': Individual line segments (uses segments array)
   * - 'curved': Smooth spline through all points (3+ required, sorted by x)
   * - 'freeform': Freehand drawing (uses drawnPaths array)
   */
  joinMode?: 'straight' | 'curved' | 'freeform';
  /** Line segments for straight mode. Ignored in curved/freeform mode. */
  segments?: LineSegment[];
  /** Freeform drawn paths. Used only in freeform mode. */
  drawnPaths?: DrawingPath[];
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
  graphType: 'interpretation' | 'plotting' | 'bearings';
  graphConfig: GraphInterpretationConfig | GraphPlottingConfig;
  // For interpretation questions
  interpretationFields?: GraphInterpretationField[];
  // For plotting questions
  plottingAnswer?: GraphPlottingAnswer;
  // For bearings questions
  bearingsConfig?: BearingsQuestionConfig;
}

// Helper to normalize graph config field names (handles xDomain vs domainX variations)
function normalizeGraphConfig(config: any): any {
  if (!config || typeof config !== 'object') return config;
  
  const normalized = { ...config };
  
  // Normalize domain field names: xDomain -> domainX, yDomain -> domainY
  if (normalized.xDomain && !normalized.domainX) {
    normalized.domainX = normalized.xDomain;
    delete normalized.xDomain;
  }
  if (normalized.yDomain && !normalized.domainY) {
    normalized.domainY = normalized.yDomain;
    delete normalized.yDomain;
  }
  
  // Ensure series is an array
  if (!Array.isArray(normalized.series)) {
    normalized.series = [];
  }
  
  // Normalize grid settings
  if (normalized.grid && typeof normalized.grid === 'object') {
    normalized.gridEnabled = normalized.grid.show ?? true;
    if (normalized.grid.stepX) normalized.stepX = normalized.grid.stepX;
    if (normalized.grid.stepY) normalized.stepY = normalized.grid.stepY;
  }
  
  return normalized;
}

// Helper to parse graph question from correct_answer JSON
export function parseGraphQuestionData(correctAnswer: string | null): GraphQuestionData | null {
  if (!correctAnswer) return null;
  try {
    const parsed = JSON.parse(correctAnswer);
    if (parsed.graphType === 'interpretation' || parsed.graphType === 'plotting') {
      // Normalize the graphConfig to handle field name variations
      if (parsed.graphConfig) {
        parsed.graphConfig = normalizeGraphConfig(parsed.graphConfig);
      }
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
export function serializeGraphPlottingResponse(
  points: GraphPoint[],
  joinMode?: 'straight' | 'curved' | 'freeform',
  segments?: LineSegment[],
  drawnPaths?: DrawingPath[]
): string {
  const response: GraphPlottingResponse = {
    _type: 'graph_plotting',
    version: 1,
    points,
    joinMode,
    segments,
    drawnPaths
  };
  return JSON.stringify(response);
}

// Helper to serialize bearings response
export function serializeBearingsResponse(bearing: number | string): string {
  const response: BearingsResponse = {
    _type: 'bearings',
    version: 1,
    bearing
  };
  return JSON.stringify(response);
}

// Normalize bearing input to degrees (0-360)
export function normalizeBearing(input: string | number): number | null {
  if (typeof input === 'number') {
    return ((input % 360) + 360) % 360;
  }
  
  const str = String(input).trim().toUpperCase();
  
  // Try direct number: "045", "45°", "45"
  const numMatch = str.match(/^(\d+(?:\.\d+)?)\s*°?$/);
  if (numMatch) {
    const deg = parseFloat(numMatch[1]);
    return ((deg % 360) + 360) % 360;
  }
  
  // Try compass notation: N45E, S30W, etc.
  const compassMatch = str.match(/^([NSEW])(\d+(?:\.\d+)?)([NSEW])?$/);
  if (compassMatch) {
    const [, start, angle, end] = compassMatch;
    const deg = parseFloat(angle);
    
    // N = 0/360, E = 90, S = 180, W = 270
    if (start === 'N' && end === 'E') return deg;
    if (start === 'N' && end === 'W') return 360 - deg;
    if (start === 'S' && end === 'E') return 180 - deg;
    if (start === 'S' && end === 'W') return 180 + deg;
    if (start === 'N' && !end) return deg <= 90 ? deg : 360 - deg;
    if (start === 'E' && !end) return 90;
    if (start === 'S' && !end) return 180;
    if (start === 'W' && !end) return 270;
  }
  
  return null;
}

// Helper to parse student's graph response
export function parseGraphResponse(
  answerText: string | null
): GraphInterpretationResponse | GraphPlottingResponse | BearingsResponse | null {
  if (!answerText) return null;
  try {
    const parsed = JSON.parse(answerText);
    if (parsed._type === 'graph_interpretation' || parsed._type === 'graph_plotting' || parsed._type === 'bearings') {
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
