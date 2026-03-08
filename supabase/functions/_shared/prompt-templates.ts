/**
 * Prompt template builders for practice question generation.
 * Extracted from generate-practice-questions/index.ts for maintainability.
 */

/** Auto-detect if graph questions are needed based on subtopics and notes */
export function detectVisualNeeds(subtopics: string[], notes: string) {
  const subtopicsLower = subtopics.map(s => s.toLowerCase());
  const notesLower = (notes || '').toLowerCase();

  const graphKeywords = [
    'graph', 'curve', 'plot', 'sketch', 'coordinate', 'transform', 'function',
    'f(x)', 'y=', 'linear', 'quadratic', 'cubic', 'parabola', 'asymptote',
    'gradient', 'intercept', 'tangent', 'differentiation', 'integration',
    'polynomial', 'exponential', 'logarithm', 'trigonometric', 'sine', 'cosine',
    'velocity', 'acceleration', 'force', 'displacement', 'momentum', 'energy',
    'supply', 'demand', 'cost', 'revenue', 'profit', 'equilibrium',
    'subsidy', 'tax', 'tariff', 'price floor', 'price ceiling', 'quota', 'welfare',
    'concentration', 'rate', 'temperature', 'pressure', 'volume'
  ];

  const tableKeywords = [
    'table', 'data', 'frequency', 'cumulative', 'statistics', 'probability',
    'tally', 'survey', 'grouped', 'class interval', 'histogram', 'chemistry',
    'periodic', 'element', 'compound', 'reaction', 'biology', 'physics'
  ];

  const needsGraphs = graphKeywords.some(kw =>
    subtopicsLower.some(s => s.includes(kw)) || notesLower.includes(kw)
  );

  const needsTables = tableKeywords.some(kw =>
    subtopicsLower.some(s => s.includes(kw)) || notesLower.includes(kw)
  );

  return { needsGraphs, needsTables };
}

/** Build visual question instructions based on auto-detection */
export function buildVisualInstructions(needsGraphs: boolean, needsTables: boolean, subtopics?: string[]): string {
  if (needsGraphs && needsTables) {
    return `
INTELLIGENT VISUAL QUESTIONS (AUTO-DETECTED REQUIREMENT):
Based on the subtopics selected, this set REQUIRES visual questions.
- When the question involves functions, coordinates, curves, or transformations: USE graph_plotting or graph_interpretation
- When the question involves data, frequencies, or tabular information: USE table_grid
- EVERY graph question MUST include complete graphConfig with series.data array containing at least 10 {x,y} points for smooth curves
- A graph question WITHOUT visible data points is INVALID and will be rejected
- If a question says "sketch", "plot", "draw", or "the graph shows" it MUST be a graph question type, NOT extended or short_answer`;
  } else if (needsGraphs) {
    return `
INTELLIGENT GRAPH QUESTIONS (AUTO-DETECTED REQUIREMENT):
Based on the subtopics selected (${subtopics?.join(', ')}), this set REQUIRES graph questions.
- AT LEAST 40% of questions MUST use graph_plotting or graph_interpretation types
- If a question mentions "sketch", "plot", "draw", "the graph shows", or any visual verb: USE graph_plotting, NOT extended
- EVERY graph question MUST include complete graphConfig with:
  - chartType: "line" or "scatter"
  - xLabel, yLabel: meaningful axis labels
  - domainX, domainY: [min, max] arrays
  - series: array with at least one object containing data: [{x, y}, ...] with at least 10 points for smooth curves
- A graph question WITHOUT visible data points is INVALID and will be rejected
- NEVER use question_type "extended" for questions that say "sketch" or "plot" - those MUST be graph_plotting`;
  } else if (needsTables) {
    return `
INTELLIGENT TABLE QUESTIONS (AUTO-DETECTED REQUIREMENT):
- At least 30% of questions MUST be table_grid
- Tables must have headers, rows, and columns arrays
- Use appropriate tableType: tick_cross, text_entry, number_entry, or mixed`;
  }
  return `
VISUAL QUESTION GUIDELINES:
- Use graph_plotting or graph_interpretation when the question naturally involves coordinates, curves, or visual analysis
- Use table_grid when the question involves data entry or tabular information
- IMPORTANT: If a question says "sketch", "plot", "draw", or "the graph shows", it MUST use graph_plotting type
- Never use "extended" type for questions that require visual/graphical answers`;
}

/** Build complexity instructions based on educational tier */
export function buildComplexityInstructions(tier: string, examPatterns: string): string {
  const tierLower = tier.toLowerCase();
  const isFoundation = tierLower.includes('foundation') || tierLower.includes('basic');
  const isGCSE = tierLower === 'secondary_14_16' || tierLower.includes('gcse') || tierLower.includes('ks4') || tierLower.includes('o-level') || tierLower.includes('secondary');
  const isALevel = tierLower === 'college_16_18' || tierLower.includes('a-level') || tierLower.includes('a level') || tierLower.includes('ib') || tierLower.includes('pre-u') || tierLower.includes('advanced') || tierLower.includes('college');
  const isUniversity = tierLower === 'university_18plus' || tierLower.includes('university') || tierLower.includes('undergraduate') || tierLower.includes('degree') || tierLower.includes('postgraduate') || tierLower.includes('masters');

  if (isFoundation) {
    return `
COMPLEXITY LEVEL: Foundation / Basic Rigor
- Use simple, scaffolded questions with clear step-by-step guidance
- Avoid abstract notation; use concrete numbers and straightforward language
- Include worked examples within multi-part questions
- Keep calculations to single-step or two-step maximum
- Use friendly, encouraging language
- Provide visual aids (diagrams, number lines) where helpful`;
  } else if (isGCSE) {
    return `
COMPLEXITY LEVEL: Foundation Rigor — High School / Secondary (Ages 14–16)
- Questions should require multi-step reasoning
- Use standard mathematical notation but explain any unfamiliar symbols
- Include some abstract elements but ground in practical contexts
- Mix procedural fluency with problem-solving
- 2-4 mark questions with clear mark allocation
- Include "show that" and "explain" command words`;
  } else if (isALevel || isUniversity) {
    const minMarks = isUniversity ? 6 : 4;
    return `
COMPLEXITY LEVEL: ${isUniversity ? `Expert Rigor — University / Undergraduate (Ages 18+)` : `Advanced Rigor — College / Sixth Form (Ages 16–18)`}
CRITICAL REQUIREMENTS:
- Use formal mathematical language and notation throughout
- Require abstract reasoning and proof-style arguments
- Use f(x) notation for ALL function questions; students must work with transformations
- Questions should connect multiple concepts (e.g., calculus with trigonometry)
- Include "hence or otherwise", "deduce", "prove", "show that" command words
- NO scaffolding or hints; professional exam-style layout only
- Multi-part questions (a, b, c) where parts BUILD ON EACH OTHER
- Include asymptote analysis, set notation for domains/ranges
- MINIMUM ${minMarks} marks per question - no simple 1-2 mark procedural tasks

BANNED FOR THIS LEVEL:
- Simple "plot this single point" questions
- Questions asking only for a single coordinate read-off
- Basic arithmetic without conceptual reasoning
- Any question that could appear on a GCSE paper

MANDATORY THREE-TIER QUESTION STRUCTURE:
Every parent question MUST follow this cognitive progression:
  Part (a) Calculation — Straightforward formula application.
  Part (b) Constraint/Assumption — Condition, assumption, or model justification.
  Part (c) 'Show That' / Reverse — Higher-difficulty: logarithms, algebraic rearrangement, inverse reasoning.

MANDATORY FORMAL NOTATION:
- Use formal probability/mathematical notation in EVERY question.
- State distributions explicitly.
- Use "probability" NEVER "likelihood" or "chance".

CLINICAL LINGUISTIC STYLING:
- Use exam board command verbs ONLY: 'Calculate', 'Determine', 'Evaluate', 'Verify', 'State', 'Show that', 'Hence', 'Deduce', 'Justify'.
- Include significant figures or decimal places specifications where appropriate.

MARK SCHEME (M1/A1/B1) ALIGNMENT:
- Every sub-part's worked_solution MUST include M1/A1/B1 marking breakdown.

REQUIRED STYLE:
- Every question should require REASONING, not just procedure
- Use abstract function notation: f(x), g(x), fg(x), f^(-1)(x)
- Include phrases like "Hence find...", "Deduce that...", "Prove that...", "Show that..."
${isUniversity ? '- Expect rigorous justification for all steps\n- Include epsilon-delta arguments, formal set theory where appropriate' : ''}
${examPatterns}`;
  }

  return `
COMPLEXITY LEVEL: Standard
- Balance procedural and conceptual questions
- Use clear mathematical notation
- Include a range of difficulty within the set`;
}

/** Translate exam board to generic style description */
export function translateExamBoard(examBoard: string | undefined): string {
  if (!examBoard) return '';
  const boardTranslation: Record<string, string> = {
    'AQA': 'UK exam style (structured, clear mark allocation)',
    'Edexcel': 'UK exam style (progressive difficulty, multi-part)',
    'OCR': 'UK exam style (applied contexts, problem-solving)',
    'WJEC': 'UK/Welsh exam style (bilingual, applied)',
    'CIE': 'International exam style (rigorous, theory-heavy)',
    'IB': 'International Baccalaureate style (inquiry-based, holistic)',
    'AP': 'US Advanced Placement style (college-level, free response)',
    'SAT': 'US standardized test style (efficient, multiple choice)',
    'CBSE': 'Indian exam style (comprehensive, detailed)',
    'ICSE': 'Indian exam style (application-based)',
  };
  return boardTranslation[examBoard] || examBoard;
}
