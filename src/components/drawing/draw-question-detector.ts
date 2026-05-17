// ─── Patterns that belong to the GRAPH PLOTTING system ───────────────────────
// These must NEVER trigger the drawing canvas.
// The graph plotting system already handles all of these correctly.

const GRAPH_SYSTEM_PATTERNS = [
  // Mathematical function notation:
  /\by\s*=\s*[\dx\+\-\*\/\^\(\)²³]/i,
  /\bf\s*\(\s*x\s*\)/i,
  /\bg\s*\(\s*x\s*\)/i,

  // Explicit maths curve types:
  /sketch\s+(?:the\s+)?(?:curve|graph|line)\s+y\s*=/i,
  /draw\s+(?:the\s+)?(?:curve|graph|line)\s+y\s*=/i,
  /plot\s+(?:the\s+)?(?:curve|graph|line)/i,
  /sketch\s+(?:the\s+)?(?:quadratic|cubic|reciprocal|exponential)/i,
  /draw\s+(?:the\s+)?(?:quadratic|cubic|reciprocal|exponential)/i,
  /sketch\s+(?:the\s+)?(?:parabola|hyperbola)/i,

  // Trigonometric graphs:
  /sketch\s+(?:the\s+)?(?:y\s*=\s*)?(?:sin|cos|tan)\s*[\(x]/i,
  /draw\s+(?:the\s+)?(?:y\s*=\s*)?(?:sin|cos|tan)\s*[\(x]/i,

  // Coordinate and table plotting:
  /plot\s+(?:the\s+)?(?:points|coordinates)/i,
  /draw\s+(?:a\s+)?(?:straight\s+)?line\s+(?:through|from|with\s+gradient)/i,
  /draw\s+(?:a\s+graph\s+)?(?:from\s+the\s+table|using\s+the\s+table)/i,

  // f(x) transformations — graph system:
  /y\s*=\s*f\s*\(/i,
  /sketch\s+(?:the\s+)?transformation/i,
  /graph\s+transformation/i,

  // Line of best fit — graph system (scatter questions):
  /line\s+of\s+best\s+fit/i,

  // Science graphs — handled by graph plotting:
  /(?:velocity|distance|speed|displacement|acceleration)\s*[-–]\s*time\s+graph/i,
  /(?:v|s|d|a)-t\s+graph/i,
  /plot\s+(?:the\s+)?(?:velocity|distance|speed|displacement)/i,

  // Bearings — graph system:
  /draw\s+(?:a\s+)?(?:north\s+line|bearing)/i,

  // Any explicit mathematical axis labelling:
  /on\s+the\s+(?:grid|axes|graph)\s+(?:below\s+)?(?:provided\s+)?(?:plot|draw|sketch)\s+(?:the\s+)?(?:curve|line|graph)\s+y/i,
];

// ─── Patterns that DO need the freehand drawing canvas ───────────────────────

const ECONOMICS_DRAW_PATTERNS = [
  // Supply and demand:
  /draw\s+(?:a\s+)?supply\s+(?:and\s+)?demand/i,
  /sketch\s+(?:a\s+)?supply\s+(?:and\s+)?demand/i,
  /draw\s+(?:a\s+)?(?:supply|demand)\s+(?:curve|diagram)/i,
  /using\s+a\s+(?:supply\s+and\s+demand\s+)?diagram[,\s]+(?:explain|show|illustrate)/i,
  /illustrate\s+(?:the\s+concept\s+of\s+)?(?:a\s+)?(?:negative|positive)\s+externality/i,
  /illustrate\s+(?:using\s+)?(?:a\s+)?(?:supply\s+and\s+demand\s+)?diagram/i,
  /draw\s+a\s+diagram\s+to\s+show\s+(?:the\s+)?(?:impact|effect)\s+of\s+(?:a\s+)?(?:tax|subsidy|price\s+floor|price\s+ceiling)/i,
  /show\s+(?:the\s+effect\s+of\s+)?(?:a\s+)?(?:price\s+floor|price\s+ceiling|minimum\s+price|maximum\s+price)/i,
  /on\s+a\s+(?:supply\s+and\s+demand\s+)?diagram[,\s]+show/i,

  // PPF:
  /draw\s+(?:a\s+)?(?:ppf|ppc|production\s+possibility)/i,
  /sketch\s+(?:a\s+)?(?:ppf|ppc|production\s+possibility)/i,
  /show\s+(?:on\s+)?(?:a\s+)?ppf/i,
  /using\s+(?:a\s+)?(?:ppf|production\s+possibility)/i,

  // Lorenz curve:
  /draw\s+(?:a\s+)?lorenz\s+curve/i,
  /sketch\s+(?:a\s+)?lorenz\s+curve/i,
  /(?:explain|illustrate)\s+using\s+(?:a\s+)?lorenz\s+curve/i,

  // Break-even:
  /draw\s+(?:a\s+)?break.?even\s+(?:chart|diagram|graph)/i,
  /sketch\s+(?:a\s+)?break.?even/i,
  /on\s+(?:a\s+)?break.?even\s+(?:chart|diagram)/i,

  // Aggregate demand / supply (IB / A-Level Macro):
  /draw\s+(?:an?\s+)?(?:aggregate\s+demand|aggregate\s+supply|ad.as)/i,
  /sketch\s+(?:an?\s+)?(?:aggregate\s+demand|aggregate\s+supply)/i,

  // Circular flow (IB / HSC / AP):
  /draw\s+(?:a\s+)?circular\s+flow/i,
];

const BIOLOGY_DRAW_PATTERNS = [
  /draw\s+(?:and\s+label\s+)?(?:an?\s+)?animal\s+cell/i,
  /draw\s+(?:and\s+label\s+)?(?:a\s+)?plant\s+cell/i,
  /draw\s+(?:and\s+label\s+)?(?:a\s+)?(?:bacterial|prokaryot)/i,
  /draw\s+(?:and\s+label\s+)?(?:a\s+)?(?:neuron|nerve\s+cell)/i,
  /draw\s+(?:and\s+label\s+)?(?:a\s+)?food\s+(?:web|chain)/i,
  /draw\s+(?:a\s+)?punnett\s+square/i,
  /complete\s+(?:the\s+)?punnett\s+square/i,
  /draw\s+(?:a\s+)?(?:dna\s+)?double\s+helix/i,
  /draw\s+(?:and\s+label\s+)?(?:a\s+)?leaf\s+(?:cross.section|section)/i,
];

const PHYSICS_DIAGRAM_DRAW_PATTERNS = [
  // Free body / forces — student-drawn:
  /draw\s+(?:a\s+)?free\s+body\s+diagram/i,
  /draw\s+(?:the\s+)?(?:force|forces)\s+(?:acting|on)/i,
  // Circuit diagrams — circuit SVG system handles these but keep canvas fallback:
  /draw\s+(?:a\s+)?circuit\s+diagram/i,

  // Magnetism — only when student is explicitly asked to sketch/draw the
  // field pattern themselves (not for calculation questions that just
  // reference a field):
  /sketch\s+(?:the\s+)?magnetic\s+field\s+(?:pattern|lines?|around|near|of)/i,
  /draw\s+(?:the\s+)?magnetic\s+field\s+(?:pattern|lines?|around|near|of)/i,
  /sketch\s+(?:the\s+)?field\s+(?:pattern|lines?)\s+(?:around|near|of|for)/i,

  // Ray diagrams — student-drawn:
  /sketch\s+(?:a\s+)?ray\s+diagram/i,
  /draw\s+(?:a\s+)?ray\s+diagram/i,
  /draw\s+(?:the\s+)?rays?\s+(?:through|from|to)/i,

  // Waves — student-drawn:
  /sketch\s+(?:a\s+)?(?:transverse|longitudinal|standing|stationary)\s+wave/i,
  /draw\s+(?:a\s+)?(?:transverse|longitudinal|standing|stationary)\s+wave/i,
  /sketch\s+(?:the\s+)?wave\s+(?:pattern|profile|diagram)/i,
];

const MATHS_DRAW_PATTERNS = [
  /draw\s+(?:a\s+)?(?:probability\s+)?tree\s+diagram/i,
  /complete\s+(?:the\s+)?(?:probability\s+)?tree\s+diagram/i,
  /draw\s+(?:a\s+)?venn\s+diagram/i,
  /complete\s+(?:the\s+)?venn\s+diagram/i,
  /shade\s+(?:the\s+region|on\s+the\s+venn)/i,
  /complete\s+(?:the\s+)?two.?way\s+table/i,
  /copy\s+and\s+complete\s+(?:the\s+)?table/i,
  /draw\s+(?:a\s+)?sample\s+space\s+diagram/i,
  /complete\s+(?:the\s+)?sample\s+space/i,
];

// ─── Main detection function ──────────────────────────────────────────────────

export interface DrawQuestionInfo {
  needsDrawingCanvas: boolean;
  diagramCategory: 'economics' | 'biology' | 'physics' | 'maths' | 'generic' | null;
  axisLabels: { x: string; y: string };
}

export const detectDrawQuestion = (
  questionText: string,
  subject?: string,
  questionType?: string,
): DrawQuestionInfo => {

  const NO_CANVAS: DrawQuestionInfo = {
    needsDrawingCanvas: false,
    diagramCategory: null,
    axisLabels: { x: 'Quantity', y: 'Price' },
  };

  if (!questionText) return NO_CANVAS;

  const text = questionText;
  const subj = (subject ?? '').toLowerCase();

  // Guard 1: question_type already handled by graph system
  if (
    questionType === 'graph_plotting' ||
    questionType === 'graph_interpretation' ||
    questionType === 'graph_transformation' ||
    questionType === 'bearings'
  ) {
    return NO_CANVAS;
  }

  // Guard 2: content matches graph system patterns
  if (GRAPH_SYSTEM_PATTERNS.some(p => p.test(text))) {
    return NO_CANVAS;
  }

  // Guard 3: subject must be economics, business, biology, physics, or maths
  const isRelevantSubject =
    /economics|business|commerce|finance|accounting|biology|life\s*science|biolog|physics|science|mathematics|maths|math\b|statistics|probability|computer\s*science|computing/i.test(subj) ||
    subj === '';

  if (!isRelevantSubject) return NO_CANVAS;

  // Economics and business draw questions
  if (ECONOMICS_DRAW_PATTERNS.some(p => p.test(text))) {
    const axisLabels =
      /ppf|production\s+possibility/i.test(text)
        ? { y: 'Good A', x: 'Good B' }
        : /lorenz/i.test(text)
        ? { y: 'Cumulative % income', x: 'Cumulative % population' }
        : /break.?even/i.test(text)
        ? { y: 'Revenue / Cost (£)', x: 'Output (units)' }
        : /labour\s+market|labor\s+market/i.test(text)
        ? { y: 'Wage', x: 'Quantity of Labour' }
        : { y: 'Price', x: 'Quantity' };

    return {
      needsDrawingCanvas: true,
      diagramCategory: 'economics',
      axisLabels,
    };
  }

  // Biology draw questions
  if (BIOLOGY_DRAW_PATTERNS.some(p => p.test(text))) {
    return {
      needsDrawingCanvas: true,
      diagramCategory: 'biology',
      axisLabels: { y: '', x: '' },
    };
  }

  // Physics diagram draw questions
  if (PHYSICS_DIAGRAM_DRAW_PATTERNS.some(p => p.test(text))) {
    return {
      needsDrawingCanvas: true,
      diagramCategory: 'physics',
      axisLabels: { y: '', x: '' },
    };
  }

  // Maths draw questions (probability tree, Venn, two-way table, sample space)
  if (MATHS_DRAW_PATTERNS.some(p => p.test(text))) {
    return {
      needsDrawingCanvas: true,
      diagramCategory: 'maths',
      axisLabels: { y: '', x: '' },
    };
  }

  return NO_CANVAS;
};
