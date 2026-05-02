/**
 * Shared types for practice quiz and exam components.
 */
import type {
  GraphPoint,
  GraphSeries,
  BearingsMarkingResult,
  BestFitLine,
} from "@/components/graph";

export interface PracticeQuestion {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: any;
  correct_answer?: string;
  has_math?: boolean;
  question_latex?: string;
  subtopic: string;
  worked_solution?: string;
}

export interface UserAnswer {
  answer: string;
  answerLatex?: string;
  workingOut?: string;
  submitted: boolean;
  isCorrect?: boolean;
  score?: number;
  methodMarks?: number;
  accuracyMarks?: number;
  feedback?: string;
  useMathInput?: boolean;
  tableGridAnswers?: Record<string, number[]>;
  tableGridInputs?: Record<string, Record<number, string | number>>;
  markingData?: {
    perRowResults?: Record<string, { correct: boolean; earned: number; max: number; details: string; status: 'correct' | 'incorrect' | 'missed' | 'partial' }>;
    correctAnswers?: Record<string, number[]>;
    correctInputs?: Record<string, Record<number, string | number>>;
  };
  graphInterpretationAnswers?: Record<string, string | number | boolean>;
  graphPlottedPoints?: GraphPoint[];
  graphJoinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null;
  graphSegments?: Array<{ id: string; from: GraphPoint; to: GraphPoint; mode: 'straight' | 'curved'; controlPoint?: GraphPoint }>;
  graphDrawnPaths?: Array<{ id: string; dataPoints: Array<{ x: number; y: number }>; points?: Array<{ pixelX: number; pixelY: number }> }>;
  graphMarkingData?: {
    perFieldResults?: Record<string, { correct: boolean; earned: number; max: number; studentAnswer: any; correctAnswer: any; status: 'correct' | 'incorrect' | 'missed' }>;
    perPointResults?: Array<{ studentPoint?: GraphPoint; expectedPoint: GraphPoint; matched: boolean; distance?: number; status: 'correct' | 'incorrect' | 'missed' }>;
  };
  bearingsAnswer?: string;
  bearingsMarkingData?: BearingsMarkingResult;
  protractorState?: { x: number; y: number; rotationDeg: number; visible: boolean };
}

export interface ExamQuestion {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: string[];
  figure_urls?: string[];
  correct_answer?: string;
  has_math?: boolean;
  question_latex?: string;
}

export const GRAPH_QUESTION_TYPES = new Set(['graph_interpretation', 'graph_plotting', 'bearings', 'graph_transformation']);

export const looksLikeGraphJson = (value?: string | null) => {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.startsWith('{') && trimmed.includes('"graphType"');
};

export const shouldParseGraphData = (questionType?: string, correctAnswer?: string | null) => {
  if (questionType && GRAPH_QUESTION_TYPES.has(questionType)) return true;
  return looksLikeGraphJson(correctAnswer);
};

/** Convert toggle answers from number[] to Record<number, boolean> format */
export function convertTogglesForSerialization(
  toggles: Record<string, number[]>
): Record<string, Record<number, boolean>> {
  const result: Record<string, Record<number, boolean>> = {};
  for (const [rowId, colIndices] of Object.entries(toggles)) {
    result[rowId] = {};
    for (const idx of colIndices) {
      result[rowId][idx] = true;
    }
  }
  return result;
}

/** Helper to add opacity to hex color */
export const addOpacity = (hex: string, opacity: number): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/** Marks-adaptive answer box sizing */
export function getAnswerBoxHeight(marks: number, isMath: boolean): string {
  if (marks <= 2) return isMath ? 'min-h-[150px]' : 'min-h-[120px]';
  if (marks <= 4) return isMath ? 'min-h-[220px]' : 'min-h-[200px]';
  if (marks <= 7) return 'min-h-[300px]';
  return 'min-h-[400px]';
}

/** Strip inline MCQ options from question text for student view */
export const stripInlineMCQOptions = (text: string, questionType: string): string => {
  if (questionType !== 'mcq') return text;
  
  let cleanedText = text;
  const lineOptionsPattern = /(?:\n|^)\s*A[).]\s+[\s\S]*$/i;
  const inlineOptionsPattern = /\s+A[).]\s+.+?\s+B[).]\s+.+?\s+C[).]\s+.+?\s+D[).]\s+.+$/i;
  
  if (inlineOptionsPattern.test(cleanedText)) {
    cleanedText = cleanedText.replace(inlineOptionsPattern, '').trim();
  } else if (lineOptionsPattern.test(cleanedText)) {
    cleanedText = cleanedText.replace(lineOptionsPattern, '').trim();
  }
  
  return cleanedText;
};

export const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}m ${secs}s`;
};

export const formatExamTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hrs > 0 
    ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins}:${secs.toString().padStart(2, '0')}`;
};
