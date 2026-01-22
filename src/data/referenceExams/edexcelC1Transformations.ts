/**
 * Reference Exam: Edexcel C1 Transformations
 * 
 * This is a golden template exam modeled on actual Edexcel C1 Pure Mathematics papers.
 * Used to validate that graph_transformation questions render and grade correctly.
 * 
 * Each question includes:
 * - A reference function with labeled key points
 * - Multi-part questions covering coordinate transforms, sketching, and calculations
 * - Complete graphConfig with series data for curve rendering
 */

import type { GraphTransformationConfig, FunctionKeyPoint, Asymptote, GraphSeries } from '@/components/graph/types';

// Helper to generate cubic curve data points
function generateCubicCurve(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  step: number = 0.25
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let x = xMin; x <= xMax; x += step) {
    const y = fn(x);
    if (isFinite(y) && Math.abs(y) < 50) {
      points.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
  }
  return points;
}

// Question 1: Basic Transformation with Cubic Function
// f(x) = x(x+2)(1-x) has roots at -2, 0, 1 and max near (−0.5, 1.69)
const q1Fn = (x: number) => x * (x + 2) * (1 - x);
const q1CurveData = generateCubicCurve(q1Fn, -3, 2);

export const question1Config: GraphTransformationConfig = {
  chartType: 'line',
  xLabel: 'x',
  yLabel: 'y',
  domainX: [-5, 4],
  domainY: [-4, 6],
  originalFunction: {
    description: 'y = f(x) where f(x) = x(x + 2)(1 - x)',
    displayEquation: 'y = f(x)',
    keyPoints: [
      { id: 'O', type: 'y-intercept', coordinates: { x: 0, y: 0 }, label: 'O' },
      { id: 'A', type: 'maximum', coordinates: { x: -0.55, y: 1.63 }, label: 'A' },
      { id: 'B', type: 'x-intercept', coordinates: { x: -2, y: 0 }, label: 'B' },
      { id: 'C', type: 'x-intercept', coordinates: { x: 1, y: 0 }, label: 'C' },
    ],
    referenceCurve: {
      id: 'f',
      label: 'y = f(x)',
      data: q1CurveData,
      color: '#3B82F6',
      showLine: true,
    },
  },
  parts: [
    {
      id: 'a',
      transformation: 'y = f(x + 3)',
      transformationDescription: 'Translation 3 units left',
      questionType: 'coordinates',
      prompt: 'Write down the coordinates of the maximum point on the curve with equation y = f(x + 3).',
      marks: 2,
      correctAnswer: {
        coordinateAnswer: { x: -3.55, y: 1.63 },
      },
      tolerance: 0.1,
    },
    {
      id: 'b',
      transformation: 'y = 2f(x)',
      transformationDescription: 'Vertical stretch, scale factor 2',
      questionType: 'sketch',
      prompt: 'Sketch the curve with equation y = 2f(x), showing the coordinates of the maximum and any points where the curve crosses the x-axis.',
      marks: 3,
      correctAnswer: {
        transformedPoints: [
          { x: -0.55, y: 3.26, label: "A'", originalLabel: 'A' },
          { x: -2, y: 0, label: "B'", originalLabel: 'B' },
          { x: 0, y: 0, label: "O'", originalLabel: 'O' },
          { x: 1, y: 0, label: "C'", originalLabel: 'C' },
        ],
      },
    },
    {
      id: 'c',
      transformation: 'ff(x)',
      questionType: 'value',
      prompt: 'Given that f(x) = x(x + 2)(1 - x), find the value of ff(0).',
      marks: 3,
      correctAnswer: {
        numericAnswer: 0,
        textAnswer: '0',
        alternatives: ['0', 'zero'],
      },
    },
  ],
  showBlankCanvas: true,
  sketchGridStep: 1,
};

// Question 2: Transformation with Asymptotes (Rational Function Style)
// f(x) = 1/(x+3) has vertical asymptote at x = -3, horizontal at y = 0
const q2CurveData: Array<{ x: number; y: number }> = [];
for (let x = -7; x <= 5; x += 0.2) {
  if (Math.abs(x + 3) > 0.3) {
    q2CurveData.push({ x, y: 1 / (x + 3) });
  }
}

export const question2Config: GraphTransformationConfig = {
  chartType: 'line',
  xLabel: 'x',
  yLabel: 'y',
  domainX: [-8, 6],
  domainY: [-4, 4],
  originalFunction: {
    description: 'y = f(x) where f(x) = 1/(x + 3)',
    displayEquation: 'y = f(x)',
    keyPoints: [
      { id: 'P', type: 'point', coordinates: { x: -2, y: 1 }, label: 'P' },
      { id: 'Q', type: 'point', coordinates: { x: 0, y: 0.33 }, label: 'Q' },
    ],
    asymptotes: [
      { type: 'vertical', value: -3, equation: 'x = -3' },
      { type: 'horizontal', value: 0, equation: 'y = 0' },
    ],
    referenceCurve: {
      id: 'f',
      label: 'y = f(x)',
      data: q2CurveData,
      color: '#8B5CF6',
      showLine: true,
    },
  },
  parts: [
    {
      id: 'a',
      transformation: 'y = f(x - 1)',
      transformationDescription: 'Translation 1 unit right',
      questionType: 'text',
      prompt: 'State the equation of the vertical asymptote of the curve y = f(x - 1).',
      marks: 1,
      correctAnswer: {
        textAnswer: 'x = -2',
        alternatives: ['x=-2', 'x = -2', '-2'],
      },
    },
    {
      id: 'b',
      transformation: 'y = f(2x)',
      transformationDescription: 'Horizontal stretch, scale factor 1/2',
      questionType: 'text',
      prompt: 'State the equation of the vertical asymptote of the curve y = f(2x).',
      marks: 2,
      correctAnswer: {
        textAnswer: 'x = -1.5',
        alternatives: ['x=-1.5', 'x = -3/2', 'x=-3/2', '-1.5', '-3/2'],
      },
    },
    {
      id: 'c',
      transformation: 'y = f(-x)',
      transformationDescription: 'Reflection in the y-axis',
      questionType: 'sketch',
      prompt: 'Sketch the curve y = f(-x), showing clearly the equation of the asymptote.',
      marks: 3,
      correctAnswer: {
        transformedPoints: [
          { x: 2, y: 1, label: "P'" },
          { x: 0, y: 0.33, label: "Q'" },
        ],
        transformedAsymptotes: [
          { type: 'vertical', value: 3, equation: 'x = 3' },
        ],
      },
    },
  ],
  showBlankCanvas: true,
  sketchGridStep: 1,
};

// Question 3: Reflections and Combined Transformations (Parabola)
// f(x) = (x-1)^2 has vertex at (1, 0)
const q3Fn = (x: number) => (x - 1) * (x - 1);
const q3CurveData = generateCubicCurve(q3Fn, -2, 4, 0.2);

export const question3Config: GraphTransformationConfig = {
  chartType: 'line',
  xLabel: 'x',
  yLabel: 'y',
  domainX: [-4, 6],
  domainY: [-6, 8],
  originalFunction: {
    description: 'y = f(x) where f(x) = (x - 1)^2',
    displayEquation: 'y = f(x)',
    keyPoints: [
      { id: 'V', type: 'minimum', coordinates: { x: 1, y: 0 }, label: 'V (vertex)' },
      { id: 'A', type: 'point', coordinates: { x: 0, y: 1 }, label: 'A' },
      { id: 'B', type: 'point', coordinates: { x: 3, y: 4 }, label: 'B' },
    ],
    referenceCurve: {
      id: 'f',
      label: 'y = f(x)',
      data: q3CurveData,
      color: '#10B981',
      showLine: true,
    },
  },
  parts: [
    {
      id: 'a',
      transformation: 'y = -f(x)',
      transformationDescription: 'Reflection in the x-axis',
      questionType: 'coordinates',
      prompt: 'Write down the coordinates of the image of point B under the transformation y = -f(x).',
      marks: 2,
      correctAnswer: {
        coordinateAnswer: { x: 3, y: -4 },
      },
    },
    {
      id: 'b',
      transformation: 'y = f(-x)',
      transformationDescription: 'Reflection in the y-axis',
      questionType: 'coordinates',
      prompt: 'Write down the coordinates of the vertex of the curve y = f(-x).',
      marks: 2,
      correctAnswer: {
        coordinateAnswer: { x: -1, y: 0 },
      },
    },
    {
      id: 'c',
      transformation: 'y = 2f(x) + 3',
      transformationDescription: 'Vertical stretch factor 2, then translation 3 up',
      questionType: 'sketch',
      prompt: 'Sketch the curve y = 2f(x) + 3, showing the coordinates of the vertex and one other labeled point.',
      marks: 4,
      correctAnswer: {
        transformedPoints: [
          { x: 1, y: 3, label: "V'" },
          { x: 0, y: 5, label: "A'" },
          { x: 3, y: 11, label: "B'" },
        ],
      },
    },
  ],
  showBlankCanvas: true,
  sketchGridStep: 1,
};

// Question 4: Domain and Range with Set Notation
// f(x) = sqrt(x) for x >= 0
const q4CurveData: Array<{ x: number; y: number }> = [];
for (let x = 0; x <= 9; x += 0.25) {
  q4CurveData.push({ x, y: Math.sqrt(x) });
}

export const question4Config: GraphTransformationConfig = {
  chartType: 'line',
  xLabel: 'x',
  yLabel: 'y',
  domainX: [-2, 10],
  domainY: [-2, 5],
  originalFunction: {
    description: 'f(x) = sqrt(x), x >= 0',
    displayEquation: 'y = f(x) = sqrt(x)',
    domain: [0, Infinity],
    range: [0, Infinity],
    keyPoints: [
      { id: 'O', type: 'y-intercept', coordinates: { x: 0, y: 0 }, label: 'O' },
      { id: 'A', type: 'point', coordinates: { x: 1, y: 1 }, label: 'A' },
      { id: 'B', type: 'point', coordinates: { x: 4, y: 2 }, label: 'B' },
      { id: 'C', type: 'point', coordinates: { x: 9, y: 3 }, label: 'C' },
    ],
    referenceCurve: {
      id: 'f',
      label: 'y = sqrt(x)',
      data: q4CurveData,
      color: '#F59E0B',
      showLine: true,
    },
  },
  parts: [
    {
      id: 'a',
      transformation: 'y = 3f(x)',
      questionType: 'set',
      prompt: 'State the range of 3f(x) in set notation.',
      marks: 2,
      correctAnswer: {
        setAnswer: '{y : y >= 0}',
        textAnswer: '{y : y >= 0}',
        alternatives: ['y >= 0', '[0, infinity)', 'y > 0 or y = 0', '{y : y >= 0, y in R}'],
      },
    },
    {
      id: 'b',
      transformation: 'y = f(x + 2)',
      questionType: 'set',
      prompt: 'State the domain of f(x + 2) in set notation.',
      marks: 2,
      correctAnswer: {
        setAnswer: '{x : x >= -2}',
        textAnswer: '{x : x >= -2}',
        alternatives: ['x >= -2', '[-2, infinity)', 'x > -2 or x = -2'],
      },
    },
    {
      id: 'c',
      transformation: 'y = f(x) - 1',
      questionType: 'coordinates',
      prompt: 'Write down the coordinates of the point where the curve y = f(x) - 1 meets the x-axis.',
      marks: 2,
      correctAnswer: {
        coordinateAnswer: { x: 1, y: 0 },
      },
    },
  ],
  showBlankCanvas: false,
  sketchGridStep: 1,
};

// Question 5: Composite Functions
// f(x) = 2x + 1, g(x) = x^2
const q5fData = generateCubicCurve((x) => 2 * x + 1, -3, 3);
const q5gData = generateCubicCurve((x) => x * x, -3, 3, 0.2);

export const question5Config: GraphTransformationConfig = {
  chartType: 'line',
  xLabel: 'x',
  yLabel: 'y',
  domainX: [-4, 4],
  domainY: [-4, 10],
  originalFunction: {
    description: 'f(x) = 2x + 1 and g(x) = x^2',
    displayEquation: 'f(x) = 2x + 1, g(x) = x^2',
    keyPoints: [
      { id: 'A', type: 'y-intercept', coordinates: { x: 0, y: 1 }, label: 'f(0) = 1' },
      { id: 'B', type: 'point', coordinates: { x: 2, y: 5 }, label: 'f(2) = 5' },
      { id: 'C', type: 'minimum', coordinates: { x: 0, y: 0 }, label: 'g(0) = 0' },
      { id: 'D', type: 'point', coordinates: { x: 2, y: 4 }, label: 'g(2) = 4' },
    ],
    referenceCurve: {
      id: 'f',
      label: 'y = f(x)',
      data: q5fData,
      color: '#3B82F6',
      showLine: true,
    },
  },
  parts: [
    {
      id: 'a',
      transformation: 'gf(x)',
      questionType: 'value',
      prompt: 'Find gf(2).',
      marks: 2,
      correctAnswer: {
        numericAnswer: 25,
        textAnswer: '25',
        alternatives: ['25', 'twenty five'],
      },
    },
    {
      id: 'b',
      transformation: 'fg(x)',
      questionType: 'value',
      prompt: 'Find fg(2).',
      marks: 2,
      correctAnswer: {
        numericAnswer: 9,
        textAnswer: '9',
        alternatives: ['9', 'nine'],
      },
    },
    {
      id: 'c',
      transformation: 'gf(x)',
      questionType: 'text',
      prompt: 'Show that gf(x) = 4x^2 + 4x + 1.',
      marks: 3,
      correctAnswer: {
        textAnswer: 'gf(x) = g(2x + 1) = (2x + 1)^2 = 4x^2 + 4x + 1',
        alternatives: ['(2x+1)^2', '4x^2 + 4x + 1', 'gf(x) = (2x+1)^2'],
      },
    },
  ],
  showBlankCanvas: false,
};

// Question 6: Inverse Functions
// f(x) = (x - 3)/2
const q6CurveData = generateCubicCurve((x) => (x - 3) / 2, -2, 8);
const q6InverseData = generateCubicCurve((x) => 2 * x + 3, -4, 4);

export const question6Config: GraphTransformationConfig = {
  chartType: 'line',
  xLabel: 'x',
  yLabel: 'y',
  domainX: [-4, 8],
  domainY: [-4, 8],
  originalFunction: {
    description: 'f(x) = (x - 3)/2',
    displayEquation: 'y = f(x) = (x - 3)/2',
    keyPoints: [
      { id: 'A', type: 'x-intercept', coordinates: { x: 3, y: 0 }, label: 'A' },
      { id: 'B', type: 'y-intercept', coordinates: { x: 0, y: -1.5 }, label: 'B' },
      { id: 'C', type: 'point', coordinates: { x: 5, y: 1 }, label: 'C' },
    ],
    referenceCurve: {
      id: 'f',
      label: 'y = f(x)',
      data: q6CurveData,
      color: '#EC4899',
      showLine: true,
    },
  },
  parts: [
    {
      id: 'a',
      transformation: 'f^(-1)(x)',
      questionType: 'text',
      prompt: 'Find f^(-1)(x).',
      marks: 2,
      correctAnswer: {
        textAnswer: 'f^(-1)(x) = 2x + 3',
        alternatives: ['2x + 3', 'f^-1(x) = 2x + 3', 'y = 2x + 3'],
      },
    },
    {
      id: 'b',
      transformation: 'f^(-1)(x)',
      questionType: 'value',
      prompt: 'Find f^(-1)(4).',
      marks: 2,
      correctAnswer: {
        numericAnswer: 11,
        textAnswer: '11',
      },
    },
    {
      id: 'c',
      transformation: 'ff^(-1)(x)',
      questionType: 'text',
      prompt: 'Show that ff^(-1)(x) = x.',
      marks: 3,
      correctAnswer: {
        textAnswer: 'ff^(-1)(x) = f(2x + 3) = ((2x + 3) - 3)/2 = 2x/2 = x',
        alternatives: ['x', 'ff^-1(x) = x', 'identity'],
      },
    },
  ],
  showBlankCanvas: false,
};

// Export all questions as an array for easy iteration
export const edexcelC1TransformationsExam = {
  title: 'Edexcel C1 Pure Mathematics - Transformations',
  examBoard: 'Edexcel',
  level: 'A-Level',
  totalMarks: 47,
  questions: [
    { number: 1, config: question1Config, totalMarks: 8 },
    { number: 2, config: question2Config, totalMarks: 6 },
    { number: 3, config: question3Config, totalMarks: 8 },
    { number: 4, config: question4Config, totalMarks: 6 },
    { number: 5, config: question5Config, totalMarks: 7 },
    { number: 6, config: question6Config, totalMarks: 7 },
  ],
};

export default edexcelC1TransformationsExam;
