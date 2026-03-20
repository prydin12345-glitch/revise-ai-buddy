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

/** Build circuit diagram consistency instructions for multi-part physics questions */
export function buildCircuitInstructions(): string {
  return `
CIRCUIT DIAGRAM LABEL CONSISTENCY (MANDATORY):
When generating multi-part questions involving circuit diagrams:
1. LABEL PERSISTENCE: Every component label (R₁, R₂, ε, r) MUST remain consistent across ALL parts of the question. Never rename R₁ to just "R" in later parts.
2. FULL CIRCUIT RETENTION: If Q1 establishes a parallel/series arrangement, Q2 and Q3 MUST show the COMPLETE circuit — do not simplify to a single resistor unless explicitly computing a Thévenin equivalent.
3. VALUE CONSISTENCY: If Q1 says R₁ = 12.0Ω, every subsequent question referencing that resistor must use R₁ = 12.0Ω — never change the value.
4. HIGHLIGHTING: When a later part asks the student to calculate a property of a specific component, include "highlightLabel" in the circuit_description JSON set to the component label (e.g. "R₁") so the diagram can visually emphasise that component.
5. CIRCUIT_DESCRIPTION FORMAT: Always include a JSON circuit_description field with the full circuit topology, even for follow-up questions. Do not rely on "refer to previous question."
6. LABEL FORMAT: Use Unicode subscripts (R₁, R₂, R₃) not LaTeX subscripts in diagram labels. Use ε for EMF, r for internal resistance.
`;
}

/** Translate exam board to board-specific style instruction */
export function translateExamBoard(examBoard: string | undefined): string {
  if (!examBoard) return '';
  const boardTranslation: Record<string, string> = {
    'aqa': 'Generate content according to the AQA specification. Use AQA command words (evaluate, explain, compare, give) and AO1/AO2/AO3 mark allocation.',
    'edexcel': 'Generate content according to the Pearson Edexcel specification. Use Edexcel-style data-response and multi-part questions with progressive difficulty.',
    'ocr': 'Generate content according to the OCR specification. Use OCR command terms (show that, determine, describe) with synoptic assessment.',
    'wjec': 'Generate content according to the WJEC specification. Use WJEC structured mark schemes with Welsh context where appropriate.',
    'cie': 'Generate content according to the Cambridge International (CAIE) specification. Use Cambridge-style structured data response and essay-type questions.',
    'ib': 'Generate content according to the IB programme specification. Use IB internal assessment style and extended response questions.',
    'college_board': 'Generate content according to the College Board AP/SAT specification. Use AP-style free response and multiple-choice sections.',
    'cbse': 'Generate content according to the CBSE specification. Use CBSE-style comprehensive questions with detailed step-marking.',
    'icse': 'Generate content according to the ICSE specification. Use ICSE-style application-based questions with step-by-step marking.',
    'ncea': 'Generate content according to NCEA (New Zealand) standards. Use Achievement/Merit/Excellence criteria levels.',
    'vce': 'Generate content according to VCE (Victoria, Australia) study design. Use key knowledge and key skills framework.',
    'hsc': 'Generate content according to HSC (NSW, Australia) syllabi. Use Band descriptors for extended responses.',
    'leaving_cert': 'Generate content according to the Irish Leaving Certificate specification. Use Ordinary/Higher level differentiation.',
  };
  // Try lowercase key first, then original
  return boardTranslation[examBoard.toLowerCase()] || boardTranslation[examBoard] || examBoard;
}

/** Board-specific mark scheme language */
export function getBoardMarkSchemeStyle(boardId: string): string {
  const styles: Record<string, string> = {
    aqa: `Use AQA-style mark schemes: "Allow" for alternatives, "Accept" for equivalents, "Do not accept" for wrong answers. Award B1/M1/A1 marks.`,
    edexcel: `Use Edexcel-style: "Award 1 mark for..." format. Progressive marking. QWC for 6-mark questions.`,
    ocr: `Use OCR-style: "Credit any sensible answer that..." AO1/AO2/AO3 labelling. Level of response for extended answers.`,
    ib: `Use IB-style: Assessment criteria bands (A/B/C/D). "Award [1] for..." format. Level descriptors for extended response.`,
    college_board: `Use AP-style rubrics: Point-based FRQ rubrics. "Acceptable"/"Not acceptable" for alternatives. Include "Scoring Note".`,
    cbse: `Use CBSE-style: Step marking with "Value Points" per mark. Include "Any other relevant answer".`,
    wjec: `Use WJEC-style: B/M/A notation. "Credit" for alternatives. Indicative content for extended responses.`,
    cie: `Use Cambridge-style: M1/A1/B1 notation. "or equivalent" for alternatives. [1] notation.`,
  };
  return styles[boardId] || '';
}
