// Graph Question Types - Phase 1: Interpretation and Plotting

// Data point for graphs
export interface GraphPoint {
  /**
   * Stable identifier for a plotted point.
   * Used for drag-mode tracking and to keep connected segments synced while points move.
   */
  id?: string;
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

// ============= Universal Subject-Aware Graphing Engine Types =============

// Annotation for labeling points, intercepts, text, or regions on the graph
export interface GraphAnnotation {
  id: string;
  type: 'point' | 'intercept' | 'text' | 'region';
  /** For point/intercept: the coordinates to label */
  coords?: { x: number; y: number };
  /** For intercept: which axis */
  axis?: 'x' | 'y';
  /** Display label (e.g., "Terminal Velocity", "A(3, 5)") */
  label: string;
  /** Whether to show coordinate values in the label */
  showCoordinates?: boolean;
  /** For region shading */
  fillBetween?: {
    curveSeriesId: string;
    fromX?: number;
    toX?: number;
    fillColor?: string;
  };
}

// Subject profile for axis/viewport defaults
export interface SubjectProfile {
  subject?: string; // 'Mathematics' | 'Physics' | 'Economics' | etc.
  axisLabels?: { x: string; y: string }; // Override "x"/"y"
  quadrantMode?: 'all' | 'q1' | 'q1q2'; // Default: 'all'
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
  // Universal Subject-Aware Graphing Engine (additive, all optional)
  annotations?: GraphAnnotation[];
  subjectProfile?: SubjectProfile;
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

// ============= Camera-Based Graph System Types =============

/**
 * Camera state for Desmos-style graph viewport.
 * 
 * The camera defines how we view the infinite graph coordinate space.
 * All graph data is stored in graph coordinates; the camera only affects rendering.
 * 
 * Core principle: "Graph data lives in math space. Camera controls how we look at it."
 */
export interface CameraState {
  /** Graph x-coordinate at the center of the viewport */
  centerX: number;
  /** Graph y-coordinate at the center of the viewport */
  centerY: number;
  /** Graph units per 100 pixels (unified scale for x and y) */
  scale: number;
}

/**
 * Complete viewport information combining camera state with pixel dimensions.
 */
export interface GraphViewport {
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
  /** Current camera state */
  camera: CameraState;
}

/**
 * Calculate the visible domain from camera state and viewport dimensions.
 */
export function getVisibleDomain(
  camera: CameraState,
  viewportWidth: number,
  viewportHeight: number
): { domainX: [number, number]; domainY: [number, number] } {
  const halfWidthUnits = (viewportWidth * camera.scale) / 200;
  const halfHeightUnits = (viewportHeight * camera.scale) / 200;
  
  return {
    domainX: [camera.centerX - halfWidthUnits, camera.centerX + halfWidthUnits],
    domainY: [camera.centerY - halfHeightUnits, camera.centerY + halfHeightUnits],
  };
}

/**
 * Create a default camera state that centers on a given domain.
 */
export function createCameraFromDomain(
  domainX: [number, number],
  domainY: [number, number],
  viewportWidth: number,
  viewportHeight: number
): CameraState {
  const centerX = (domainX[0] + domainX[1]) / 2;
  const centerY = (domainY[0] + domainY[1]) / 2;
  
  // Guard against invalid viewport dimensions
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { centerX, centerY, scale: 1 }; // Safe default
  }
  
  // Calculate scale to fit the larger dimension
  const rangeX = Math.max(domainX[1] - domainX[0], 0.1); // Avoid zero range
  const rangeY = Math.max(domainY[1] - domainY[0], 0.1);
  
  // Scale = graph units per 100 pixels
  // We want the domain to fit with some padding
  const scaleX = (rangeX * 100) / (viewportWidth * 0.9);
  const scaleY = (rangeY * 100) / (viewportHeight * 0.9);
  
  // Use the larger scale to ensure both dimensions fit
  // Clamp to reasonable range to prevent rendering issues
  const rawScale = Math.max(scaleX, scaleY);
  const scale = Math.max(0.5, Math.min(100, rawScale)); // Between 0.5 and 100
  
  return { centerX, centerY, scale };
}

// Freeform drawing path
// IMPORTANT: All coordinates are stored in graph/data coordinates for stability.
// The camera system converts to pixels only at render time.
export interface DrawingPath {
  id: string;
  /** 
   * Canonical: data/graph coordinates (x, y in math space).
   * This is the primary storage format - stable across viewports, zoom, and resize.
   */
  dataPoints: Array<{ x: number; y: number }>;
  /** 
   * @deprecated Legacy pixel coordinates. Only used for backward compatibility 
   * with existing saved responses from before the camera-based refactor.
   * New paths should NOT populate this field.
   */
  points?: Array<{ pixelX: number; pixelY: number }>;
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

// ============= Graph Transformation Types (A-Level f(x) questions) =============

// Key point on a function curve (maxima, minima, intercepts, asymptotes)
export interface FunctionKeyPoint {
  id: string;
  type: 'maximum' | 'minimum' | 'x-intercept' | 'y-intercept' | 'turning_point' | 'point';
  coordinates: { x: number; y: number };
  label?: string; // e.g., "A", "B", "P"
}

// Asymptote definition
export interface Asymptote {
  type: 'horizontal' | 'vertical' | 'oblique';
  equation: string; // e.g., "y = 1", "x = -2"
  value?: number; // For horizontal: y-value; for vertical: x-value
}

// Original function definition with labeled points
export interface OriginalFunctionConfig {
  description: string; // e.g., "y = f(x) where f(x) = (x+3)^2(x-1)"
  displayEquation?: string; // For rendering, e.g., "y = f(x)"
  keyPoints: FunctionKeyPoint[];
  asymptotes?: Asymptote[];
  // Series data for rendering the reference curve
  referenceCurve?: GraphSeries;
  // Domain/range if relevant
  domain?: [number, number];
  range?: [number, number];
}

// A single part of a multi-part transformation question
export interface TransformationPart {
  id: string; // "a", "b", "c", etc.
  transformation: string; // "y = f(x + 2)", "y = 3f(x)", "y = -f(x)"
  transformationDescription?: string; // "Translation 2 units left"
  questionType: 'sketch' | 'coordinates' | 'equation' | 'value' | 'set' | 'text';
  prompt: string; // The actual question text
  marks: number;
  correctAnswer: {
    // For sketch: expected transformed key points
    transformedPoints?: Array<{ x: number; y: number; label?: string; originalLabel?: string }>;
    // For sketch: expected asymptotes after transformation
    transformedAsymptotes?: Asymptote[];
    // For coordinates: specific point coordinates
    coordinateAnswer?: { x: number; y: number };
    // For equation/value/text: text or numeric answer
    textAnswer?: string;
    numericAnswer?: number;
    // For set notation: e.g., "{x : x > 0}"
    setAnswer?: string;
    // Alternative accepted answers
    alternatives?: string[];
  };
  // Tolerance for numeric/coordinate answers
  tolerance?: number;
}

// Complete graph transformation question configuration
export interface GraphTransformationConfig extends GraphConfig {
  originalFunction: OriginalFunctionConfig;
  parts: TransformationPart[];
  // Whether to show a blank canvas for student sketching
  showBlankCanvas?: boolean;
  // Grid configuration for sketch canvas
  sketchGridStep?: number;
}

// Student response for a transformation question
export interface GraphTransformationResponse {
  _type: 'graph_transformation';
  version: 1;
  partAnswers: Record<string, {
    // For sketch parts
    sketchPoints?: GraphPoint[];
    sketchCurve?: DrawingPath[];
    // For other answer types
    textAnswer?: string;
    numericAnswer?: number;
    coordinateAnswer?: { x: number; y: number };
  }>;
}

// Marking result for transformation questions
export interface GraphTransformationMarkingResult {
  perPartResults: Record<string, {
    partId: string;
    correct: boolean;
    earned: number;
    max: number;
    feedback?: string;
    status: 'correct' | 'incorrect' | 'partial' | 'missed';
    // For sketch: per-point matching results
    pointResults?: Array<{
      expectedPoint: { x: number; y: number; label?: string };
      studentPoint?: GraphPoint;
      matched: boolean;
      distance?: number;
    }>;
  }>;
  totalScore: number;
  totalMarks: number;
}

// Full question data structure (stored in correct_answer JSON)
export interface GraphQuestionData {
  graphType: 'interpretation' | 'plotting' | 'bearings' | 'transformation';
  graphConfig: GraphInterpretationConfig | GraphPlottingConfig | GraphTransformationConfig;
  // For interpretation questions
  interpretationFields?: GraphInterpretationField[];
  // For plotting questions
  plottingAnswer?: GraphPlottingAnswer;
  // For bearings questions
  bearingsConfig?: BearingsQuestionConfig;
  // For transformation questions
  transformationConfig?: GraphTransformationConfig;
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
    if (parsed.graphType === 'interpretation' || parsed.graphType === 'plotting' || parsed.graphType === 'transformation') {
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
  joinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | null,
  segments?: LineSegment[],
  drawnPaths?: DrawingPath[]
): string {
  // Filter out 'angle' mode for serialization (it's UI-only, not a drawing mode)
  const serializableMode = joinMode === 'angle' ? undefined : joinMode ?? undefined;
  const response: GraphPlottingResponse = {
    _type: 'graph_plotting',
    version: 1,
    points,
    joinMode: serializableMode,
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
): GraphInterpretationResponse | GraphPlottingResponse | BearingsResponse | GraphTransformationResponse | null {
  if (!answerText) return null;
  try {
    const parsed = JSON.parse(answerText);
    if (parsed._type === 'graph_interpretation' || parsed._type === 'graph_plotting' || parsed._type === 'bearings' || parsed._type === 'graph_transformation') {
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



// Helper to serialize graph transformation response
export function serializeGraphTransformationResponse(
  partAnswers: GraphTransformationResponse['partAnswers']
): string {
  const response: GraphTransformationResponse = {
    _type: 'graph_transformation',
    version: 1,
    partAnswers
  };
  return JSON.stringify(response);
}
