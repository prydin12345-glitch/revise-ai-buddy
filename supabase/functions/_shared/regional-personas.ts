// Regional Persona Layer — Dynamic Examiner Dialect
// Injected into EVERY prompt regardless of subject

export function getRegionalPersona(region: string): string {
  const r = (region || '').toUpperCase();

  switch (r) {
    case 'GB':
    case 'UK':
      return `
REGIONAL PERSONA: United Kingdom
─────────────────────────────────
TERMINOLOGY: Use "Maths", "colour", "analyse", "behaviour", "centre", "programme", "favour", "recognise".
UNITS: Metric exclusively (cm, m, km, kg, g, °C, litres). Use "probability" NEVER "likelihood".
COMMAND STYLE: "Describe and explain", "Evaluate", "Show that", "Hence or otherwise", "State".
CONTEXTS: Use UK-appropriate scenarios (pounds sterling £, football, NHS, UK geography, British cultural references).
PROHIBITED: Americanisms — "Soccer", "Candy", "Math" (singular), "color", "analyze", "behavior", "center", "program" (non-computing), "favor".
SPELLING: British English throughout. "-ise" not "-ize", "-our" not "-or", "-re" not "-er".
`;

    case 'US':
      return `
REGIONAL PERSONA: United States
────────────────────────────────
TERMINOLOGY: Use "Math", "color", "analyze", "behavior", "center", "program".
UNITS: Imperial where culturally appropriate (inches, feet, miles, °F for everyday contexts). SI for scientific contexts.
COMMAND STYLE: "Justify your answer", "Interpret in context", "Is there sufficient evidence", "Explain your reasoning".
CONTEXTS: Use US-appropriate scenarios (dollars $, baseball/basketball/football, US geography, American cultural references).
NOTATION: Use "standardized score" not "standard score". Use "z-score" freely.
SPELLING: American English throughout. "-ize" not "-ise", "-or" not "-our", "-er" not "-re".
`;

    case 'AU':
      return `
REGIONAL PERSONA: Australia
────────────────────────────
TERMINOLOGY: British spelling ("analyse", "colour") with Australian contexts.
UNITS: Metric exclusively (kilometres, litres, degrees Celsius).
COMMAND STYLE: "Show that", "Hence find", "Explain why", "Determine", "Justify".
CONTEXTS: Australian geography, flora/fauna, local industry (mining, agriculture, tourism), Australian dollar (AUD).
SPELLING: British English with Australian conventions.
`;

    case 'CA':
      return `
REGIONAL PERSONA: Canada
─────────────────────────
TERMINOLOGY: British spelling with North American contexts.
UNITS: Metric (official), but reference imperial in everyday contexts where culturally appropriate.
COMMAND STYLE: Blend of UK/US styles — "Determine", "Justify", "Explain", "Show that".
CONTEXTS: Canadian geography, bilingual references where appropriate, Canadian dollar (CAD).
SPELLING: British English (colour, centre, analyse).
`;

    case 'AE':
    case 'UAE':
      return `
REGIONAL PERSONA: United Arab Emirates
────────────────────────────────────────
TERMINOLOGY: British English (UK curriculum influence).
UNITS: Metric exclusively. Include local contexts (oil industry, construction, tourism, desert ecology).
COMMAND STYLE: Formal UK-aligned — "Determine", "State", "Explain", "Evaluate".
CONTEXTS: UAE geography, dirham (AED), local industry, Islamic finance where relevant.
SPELLING: British English throughout.
`;

    case 'IN':
      return `
REGIONAL PERSONA: India
────────────────────────
TERMINOLOGY: British English ("Maths", "colour").
UNITS: SI strictly. Use rupees (₹) for currency contexts.
COMMAND STYLE: "Prove that", "Find the value of", "Show that", "Derive", "Differentiate between".
CONTEXTS: Indian geography, CBSE/ISC examination patterns, Indian cultural and economic references.
EMPHASIS: Step-by-step derivation, formal mathematical proof, diagram-heavy approaches.
SPELLING: British English throughout.
`;

    case 'SG':
      return `
REGIONAL PERSONA: Singapore
─────────────────────────────
TERMINOLOGY: British English.
UNITS: SI exclusively. High mathematical complexity expected.
COMMAND STYLE: "Hence or otherwise", "Deduce", "State", "Show that", "Without using a calculator".
CONTEXTS: Singapore geography, Singapore dollar (SGD), trade, technology sectors.
EMPHASIS: Cambridge examination style, rigorous multi-step reasoning.
SPELLING: British English throughout.
`;

    case 'HK':
      return `
REGIONAL PERSONA: Hong Kong
─────────────────────────────
TERMINOLOGY: British English.
UNITS: SI. Contexts blend local and international.
COMMAND STYLE: "Find", "Show that", "Explain", "Determine", "Hence".
CONTEXTS: Hong Kong geography, HKD currency, local economic and cultural references.
EMPHASIS: DSE examination format, blend of conventional and MCQ.
SPELLING: British English throughout.
`;

    case 'IE':
      return `
REGIONAL PERSONA: Ireland
──────────────────────────
TERMINOLOGY: British English with Irish educational terms.
UNITS: Metric exclusively. Use euros (€) for currency contexts.
COMMAND STYLE: "Investigate", "Verify", "Justify", "Show", "Solve", "Prove".
CONTEXTS: Irish geography, Leaving Certificate examination patterns, Irish cultural references.
EMPHASIS: Mathematical reasoning and investigation-based approaches.
SPELLING: British English with Irish conventions.
`;

    case 'NZ':
      return `
REGIONAL PERSONA: New Zealand
───────────────────────────────
TERMINOLOGY: British spelling.
UNITS: Metric exclusively. Use NZD for currency.
COMMAND STYLE: "Demonstrate understanding", "Analyse", "Evaluate", "Form a model".
CONTEXTS: New Zealand geography, flora/fauna, Māori cultural references where appropriate.
EMPHASIS: NCEA Achievement/Merit/Excellence tiering — questions must escalate across these levels.
SPELLING: British English throughout.
`;

    case 'ZA':
      return `
REGIONAL PERSONA: South Africa
────────────────────────────────
TERMINOLOGY: British English.
UNITS: SI exclusively. Use South African rand (ZAR) for currency.
COMMAND STYLE: "Determine", "Prove", "Show that", "Calculate", "Deduce".
CONTEXTS: South African geography, mining, agriculture, demographics, local economic data.
EMPHASIS: NSC examination patterns, structured multi-part questions.
SPELLING: British English throughout.
`;

    case 'IB':
      return `
REGIONAL PERSONA: International Baccalaureate (Global)
────────────────────────────────────────────────────────
TERMINOLOGY: International English (accept both UK/US spellings in student responses).
UNITS: SI exclusively.
COMMAND STYLE: IB Command Terms — "Outline", "Discuss", "Evaluate", "To what extent", "Analyse", "Compare and contrast", "Suggest".
CONTEXTS: Global/international scenarios. Avoid culturally specific references. Use diverse, multicultural examples.
EMPHASIS: IB rubric criteria (Criterion A-D where applicable). Theory of Knowledge connections where relevant.
SPELLING: International English (consistent within each question).
`;

    default:
      return `
REGIONAL PERSONA: International Standard
──────────────────────────────────────────
TERMINOLOGY: Standard English.
UNITS: SI/Metric preferred.
COMMAND STYLE: Formal academic — "Calculate", "Determine", "Explain", "Evaluate", "Show that".
CONTEXTS: Culturally neutral scenarios.
SPELLING: Consistent English throughout.
`;
  }
}

// Expanded region-aware subject instructions
export function getRegionAwareSubjectInstructions(subject: string, examBoard: string, level: string, region: string): string {
  const subjectLower = (subject || '').toLowerCase();
  const r = (region || '').toUpperCase();

  // ── Biology ──
  if (subjectLower.includes('bio')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} Biology (UK):
- "Describe and explain" for 6-mark extended response questions.
- Practical-based questions referencing Required Practicals (AQA/OCR/Edexcel).
- Command words: State, Describe, Explain, Compare, Evaluate, Calculate, Suggest.
- Include data analysis from tables/graphs, experimental design, and error evaluation.
- Marks: 1-2 (recall AO1), 3-4 (application AO2), 6+ (extended AO3).
- Use British terminology: "colour", "centre", "behaviour".`;
      case 'US':
        return `For AP Biology (US College Board):
- Free-response format: "Design an experiment to test...", "Justify your answer using evidence".
- Data analysis from tables, gel electrophoresis diagrams, phylogenetic trees.
- Command verbs: Describe, Explain, Justify, Calculate, Predict, Analyze.
- Include experimental design questions with controls, variables, and hypotheses.
- Use AP scoring guidelines (1-10 points per FRQ section).`;
      case 'AU':
        return `For ATAR Biology (Australia):
- "Analyse experimental data", multi-step practical scenarios.
- Command words: Describe, Explain, Analyse, Evaluate, Discuss, Predict.
- Include data interpretation and experimental evaluation.
- Real-world Australian ecological contexts (Great Barrier Reef, bushfire ecology).`;
      case 'IN':
        return `For CBSE Biology (India):
- "Draw and label" diagrams, "Differentiate between" comparison tables.
- Diagram-heavy approach: cell diagrams, flow charts, anatomical drawings.
- Command words: Define, Describe, Explain, Differentiate, Draw, Label, Give reasons.
- Structured: 1-mark (define), 2-mark (differentiate), 3-mark (explain with diagram), 5-mark (detailed).`;
      case 'SG':
        return `For Cambridge Biology (Singapore):
- "Suggest an explanation", high-complexity application questions.
- Multi-step experimental analysis with data interpretation.
- Command words: State, Describe, Explain, Suggest, Predict, Deduce, Calculate.
- Emphasis on application of biological concepts to novel scenarios.`;
      case 'IB':
        return `For IB Biology (International Baccalaureate):
- Data-based questions (Paper 2 Section A), extended response (Paper 2 Section B).
- IB command terms: Outline, Describe, Explain, Discuss, Evaluate, Suggest, Deduce.
- Include experimental design, data analysis, and ethical evaluation.
- Reference IB assessment objectives: AO1 (knowledge), AO2 (application), AO3 (synthesis).`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} Biology:
- Structured questions with data analysis. Command words: State, Describe, Explain, Compare, Evaluate.
- Marks: 1-2 (recall), 3-4 (application), 6+ (extended response).`;
    }
  }

  // ── Chemistry ──
  if (subjectLower.includes('chem')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} Chemistry (UK):
- Calculation-heavy: moles, concentrations, enthalpy, rates.
- "Give the IUPAC name", "Write the balanced equation", "Draw the displayed formula".
- Required Practical questions with experimental methodology and error analysis.
- Use correct chemical notation: state symbols (s), (l), (g), (aq).
- Command words: State, Calculate, Explain, Compare, Evaluate, Suggest, Deduce.`;
      case 'US':
        return `For AP Chemistry (US College Board):
- Free-response: "Design a procedure to determine...", "Calculate the molar mass".
- Equilibrium, thermodynamics, kinetics emphasis.
- Command verbs: Calculate, Justify, Explain, Design, Predict, Represent.
- Use AP FRQ scoring (multi-point rubric per section).`;
      case 'IN':
        return `For CBSE Chemistry (India):
- "Write the balanced equation", "Name the product", derivation-based.
- Emphasis on organic reaction mechanisms, inorganic qualitative analysis.
- Command words: Define, Write, Balance, Name, Explain, Derive, Calculate.
- Structured: 1-mark (name/define), 2-mark (write equation), 3-mark (explain mechanism), 5-mark (derive/calculate).`;
      case 'SG':
        return `For Cambridge Chemistry (Singapore):
- Multi-step calculations, organic chemistry synthesis pathways.
- Command words: State, Describe, Explain, Suggest, Predict, Deduce, Calculate.
- High-complexity application with novel reaction scenarios.`;
      case 'IB':
        return `For IB Chemistry (International Baccalaureate):
- Data analysis, "Deduce the structure", command term adherence.
- IB command terms: Define, State, Describe, Explain, Deduce, Predict, Discuss, Evaluate.
- Include data-based questions, stoichiometric calculations, and spectroscopic analysis.`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} Chemistry:
- Include calculations with moles, concentrations. Correct chemical notation.
- Topics: Atomic structure, Bonding, Organic chemistry, Reactions, Equilibria.`;
    }
  }

  // ── Physics ──
  if (subjectLower.includes('physics')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} Physics (UK):
- Heavy use of calculations with SI units throughout.
- "Determine the value of...", "Show that...", "Calculate the magnitude of...".
- Required Practical questions with experimental methodology and error analysis.
- Multi-step "show that" questions, graph-based analysis (V-I, force-extension).
- Command words: State, Calculate, Determine, Explain, Evaluate, Show that, Derive.
- Include experimental scenarios with percentage uncertainty calculations.`;
      case 'US':
        return `For AP Physics (US College Board):
- "Derive an expression for...", "Justify with physics principles".
- Free-response format with multi-part problem solving.
- Command verbs: Derive, Calculate, Justify, Explain, Sketch, Rank, Determine.
- Use FRQ scoring rubric format. Include both conceptual and quantitative questions.
- Reference AP Physics 1/2/C notation and conventions.`;
      case 'AU':
        return `For ATAR Physics (Australia):
- Real-world scenario-based, "Analyse the motion", graph interpretation.
- Command words: Describe, Explain, Analyse, Evaluate, Calculate, Determine.
- Include motion analysis, energy conservation, and experimental design.`;
      case 'IN':
        return `For CBSE Physics (India):
- "Derive" expressions, numerical problems with step-by-step working.
- Ray diagrams, circuit diagrams, force diagrams mandatory where applicable.
- Command words: Define, State, Derive, Prove, Calculate, Draw, Explain.
- Structured: 1-mark (define), 2-mark (state law + formula), 3-mark (numerical), 5-mark (derive + numerical).`;
      case 'SG':
        return `For Cambridge Physics (Singapore):
- "Calculate the magnitude", multi-part with "hence" chains.
- Command words: State, Calculate, Determine, Explain, Show that, Deduce, Sketch.
- High mathematical rigour with formal SI notation throughout.`;
      case 'IB':
        return `For IB Physics (International Baccalaureate):
- Paper 2/3 format with data-based questions and extended response.
- IB command terms: Define, State, Outline, Describe, Explain, Deduce, Determine, Calculate, Discuss, Evaluate.
- Include experimental design, data analysis, and uncertainty calculations.
- Reference IB Physics assessment objectives: AO1, AO2, AO3.`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} Physics:
- Heavy use of calculations. Topics: Mechanics, Waves, Electricity, Fields, Particles.
- Use SI units. Multi-step "show that" questions. Include experimental scenarios.`;
    }
  }

  // ── Economics ──
  if (subjectLower.includes('econ')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} Economics (UK):
- Data-response questions with extract analysis.
- "Analyse", "Evaluate", "To what extent", "Discuss" for extended response.
- Include diagram-based questions (supply/demand, cost curves, market equilibrium).
- Reference real economic data, markets, or policy scenarios.
- Command words: Define, State, Explain, Analyse, Evaluate, Discuss, Assess.
- Marks: 2-4 (define/explain), 8-12 (analyse), 15-25 (evaluate/discuss).`;
      case 'US':
        return `For AP Economics (US College Board):
- "Using a correctly labeled graph, show..." — FRQ format with mandatory diagrams.
- Free-response with graph requirements for every major question.
- Command verbs: Define, Identify, Calculate, Explain, Show (on graph), Determine.
- Include both Microeconomics and Macroeconomics AP-style questions.
- Use AP scoring rubric format (multi-point per section).`;
      case 'IB':
        return `For IB Economics (International Baccalaureate):
- Paper 1: Essay-based — "Using real-world examples, evaluate...".
- Paper 2: Data response with calculations and diagram analysis.
- IB command terms: Define, Describe, Explain, Analyse, Discuss, Evaluate, Compare, Contrast.
- Include references to IB syllabus concepts and real-world examples.
- Must reference economic theories and models explicitly.`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} Economics:
- Include data-response and extended-response questions.
- Use diagram-based analysis. Command words: Define, Explain, Analyse, Evaluate, Discuss.`;
    }
  }

  // ── English Language/Literature ──
  if (subjectLower.includes('english')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} English (UK):
- Follow AQA/Edexcel/OCR specification precisely based on exam board.
- AQA English Language: Retrieval (Q1 4m), Language (Q2 8m), Structure (Q3 8m), Evaluation (Q4 20m), Creative Writing (Q5 40m).
- Use "Describe and explain", "Evaluate", "Analyse" — not "Write about".
- Source-based questions with precise line referencing.
- Creative writing: PROSE FICTION ONLY — descriptions OR narratives. NEVER scripts or screenplays.
- Command words: List, Explain, Analyse, Evaluate, Compare, Describe, Write.`;
      case 'US':
        return `For AP English Language & Composition (US College Board):
- Rhetorical analysis essay, argument essay, synthesis essay.
- Command verbs: Analyze, Evaluate, Argue, Synthesize, Explain.
- Include passage-based analysis with rhetorical strategies (ethos, pathos, logos).
- AP-style multiple choice with passage comprehension.
- Use AP scoring rubric (1-6 scale for essays).`;
      case 'AU':
        return `For ATAR English (Australia):
- Text analysis with comparative essay format.
- Command words: Analyse, Evaluate, Discuss, Compare, Respond.
- Include close reading, creative response, and comparative analysis.
- Reference Australian texts and contexts where appropriate.`;
      case 'IB':
        return `For IB English (International Baccalaureate):
- Paper 1: Guided literary analysis of unseen text.
- Paper 2: Comparative essay on studied works.
- IB command terms: Analyse, Compare, Evaluate, Discuss, Examine, Comment.
- Include both literary analysis and language analysis tasks.
- Reference IB assessment criteria (Criterion A-D).`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} English:
- Include comprehension, analysis, and creative writing tasks.
- Command words: Analyse, Evaluate, Compare, Describe, Explain, Write.`;
    }
  }

  // ── History ──
  if (subjectLower.includes('history') || subjectLower.includes('hist')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} History (UK):
- Source-based questions with provenance analysis (origin, purpose, reliability).
- "How useful is Source A for...", "How far do Sources B and C agree about...".
- Extended writing with argument and counter-argument structure.
- Command words: Describe, Explain, Analyse, Evaluate, "How far", "To what extent".`;
      case 'US':
        return `For AP History (US College Board):
- Document-Based Question (DBQ) with primary source analysis.
- Long Essay Question (LEQ) with thesis-driven argument.
- Short Answer Questions (SAQ) with specific historical evidence.
- Command verbs: Describe, Explain, Evaluate, Compare, Analyze, Identify.`;
      case 'IB':
        return `For IB History (International Baccalaureate):
- Paper 1: Source-based questions with OPVL analysis.
- Paper 2/3: Essay-based with comparative and evaluative tasks.
- IB command terms: Describe, Explain, Analyse, Compare, Contrast, Evaluate, Discuss, "To what extent".`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} History:
- Source-based analysis and extended writing. Command words: Describe, Explain, Analyse, Evaluate.`;
    }
  }

  // ── Geography ──
  if (subjectLower.includes('geography') || subjectLower.includes('geog')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} Geography (UK):
- Fieldwork and data analysis questions with statistical techniques.
- "Analyse Figure 1...", "To what extent do you agree...".
- Case study references required for extended response.
- Command words: Describe, Explain, Analyse, Evaluate, Assess, "To what extent", Compare.`;
      case 'US':
        return `For AP Human/Physical Geography (US):
- Free-response with stimulus material (maps, data, images).
- Command verbs: Define, Describe, Explain, Compare, Identify, Analyse.
- Include spatial analysis and geographic data interpretation.`;
      case 'IB':
        return `For IB Geography (International Baccalaureate):
- Paper 1: Short answer and structured questions.
- Paper 2: Essay-based with case study references.
- IB command terms: Describe, Explain, Analyse, Examine, Evaluate, Discuss, Compare.`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} Geography:
- Data analysis, fieldwork, and extended writing. Command words: Describe, Explain, Analyse, Evaluate.`;
    }
  }

  // ── Business Studies ──
  if (subjectLower.includes('business')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} Business Studies (UK):
- Case study analysis with data interpretation and financial calculations.
- "Analyse the impact of...", "Evaluate whether...should...".
- Include break-even, ratio analysis, and stakeholder evaluation.
- Command words: State, Explain, Analyse, Evaluate, Discuss, Justify, Recommend.`;
      case 'US':
        return `For AP Business/Economics (US):
- Case-based analysis with quantitative and qualitative reasoning.
- Command verbs: Calculate, Analyse, Evaluate, Justify, Recommend.`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} Business Studies:
- Case study analysis, financial calculations, extended evaluation.
- Command words: State, Explain, Analyse, Evaluate, Discuss.`;
    }
  }

  // ── Computer Science ──
  if (subjectLower.includes('computer') || subjectLower.includes('computing')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} Computer Science (UK):
- Pseudocode and algorithm tracing, binary/hex conversions.
- "Write an algorithm that...", "Trace through the following code...".
- Command words: State, Describe, Explain, Write, Complete, Trace, Evaluate.`;
      case 'US':
        return `For AP Computer Science (US College Board):
- Free-response with Java/pseudocode. Array/ArrayList manipulation.
- Command verbs: Write, Complete, Describe, Explain, Trace.`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} Computer Science:
- Algorithm design, pseudocode, binary arithmetic, systems architecture.
- Command words: State, Describe, Explain, Write, Trace, Evaluate.`;
    }
  }

  // ── Psychology ──
  if (subjectLower.includes('psychology') || subjectLower.includes('psych')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} Psychology (UK):
- Research methods questions with experimental design analysis.
- "Evaluate one study related to...", "Explain one limitation of...".
- Command words: Identify, Outline, Describe, Explain, Evaluate, Discuss.`;
      case 'US':
        return `For AP Psychology (US College Board):
- Free-response with scenario-based application of psychological concepts.
- Command verbs: Define, Identify, Describe, Explain, Apply, Evaluate.`;
      case 'IB':
        return `For IB Psychology (International Baccalaureate):
- Essay-based with reference to specific studies and ethical considerations.
- IB command terms: Describe, Explain, Evaluate, Discuss, Contrast, "To what extent".`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} Psychology:
- Research methods, study evaluation, and extended response.
- Command words: Identify, Describe, Explain, Evaluate, Discuss.`;
    }
  }

  // ── Sociology ──
  if (subjectLower.includes('sociology') || subjectLower.includes('socio')) {
    switch (r) {
      case 'GB': case 'UK':
        return `For ${examBoard.toUpperCase()} ${level} Sociology (UK):
- "Applying material from Item A, analyse two ways in which...".
- Extended response with theoretical perspectives (Marxist, Feminist, Functionalist).
- Command words: Identify, Describe, Explain, Analyse, Evaluate, "Applying material from...".`;
      default:
        return `For ${examBoard.toUpperCase()} ${level} Sociology:
- Theoretical analysis and extended evaluation. Include perspectives and studies.
- Command words: Identify, Describe, Explain, Analyse, Evaluate.`;
    }
  }

  // ── No specific match — return empty to fall through to existing logic ──
  return '';
}

// ── Exam Hardening Rules ──────────────────────────────────────────────────────
// Three critical quality rules applied to EVERY generation prompt

export function getExamHardeningRules(): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
🔒 EXAM HARDENING RULES (MANDATORY — ZERO TOLERANCE FOR VIOLATIONS)
═══════════════════════════════════════════════════════════════════════════════

RULE 1: SCENARIO INTEGRITY (Single-Scenario Rule)
──────────────────────────────────────────────────
All sub-parts of a numbered question (e.g., 2a, 2b, 2c) MUST use the SAME
subject matter, dataset, and scenario throughout.
- If part (a) introduces "A factory produces microchips with a defect rate of 3%",
  then parts (b) and (c) MUST continue with microchips and that factory.
- DO NOT switch topics, characters, or datasets between sub-parts.
- The scenario is introduced ONCE in part (a). Later parts say "Using your answer
  to part (a)..." or "For the same factory..." — they NEVER introduce a new context.
- VIOLATION EXAMPLE: (a) is about microchips, (b) is about call centres → WRONG.
- CORRECT EXAMPLE: (a) calculate defect probability for microchips, (b) state an
  assumption about the microchip defects, (c) given a sample of microchips, show that...

RULE 2: PROFESSIONAL VOCABULARY OVERRIDE (Formal Tone Filter)
─────────────────────────────────────────────────────────────
Apply clinical, exam-board vocabulary. Remove ALL conversational language.

BANNED WORDS/PHRASES → REQUIRED REPLACEMENTS:
  "likelihood" → "probability"
  "average" → "mean" (or "mean ($\\mu$)" with notation)
  "variability" → "standard deviation" or "variance"
  "spread" (informal) → "standard deviation ($\\sigma$)" or "interquartile range"
  "chance" → "probability"
  "odds" → "probability"

BANNED FLUFF ADJECTIVES (remove entirely, do not replace):
  "bustling", "vibrant", "rare", "imagine", "exciting", "fascinating",
  "incredible", "amazing", "interesting", "wonderful", "beautiful",
  "lovely", "brilliant", "fantastic", "remarkable", "stunning"

TONE STANDARD:
  - BAD: "A bustling online bookstore receives an average of 4.5 complaints per day"
  - GOOD: "A bookstore receives complaints at a mean rate of 4.5 per day"
  - BAD: "Imagine a vibrant online poll where the likelihood of success is 0.3"
  - GOOD: "In a survey, the probability of a respondent selecting Option A is 0.3"

Scenarios must be dry, factual, and clinical — like a real exam paper.
Use named characters (e.g., "Sarah", "Tom") but describe their activity plainly.

RULE 3: MANDATORY FORMAL NOTATION (LaTeX Pass)
───────────────────────────────────────────────
Every question MUST include at least one piece of formal mathematical notation.
The AI must NEVER write parameters in plain English when notation exists.

REQUIRED NOTATION PATTERNS:
  - Distribution definitions: $X \\sim \\text{Po}(\\lambda)$, $Y \\sim B(n, p)$,
    $W \\sim N(\\mu, \\sigma^2)$
  - Parameters: Use $\\mu$ not "mean", $\\sigma$ not "standard deviation",
    $\\lambda$ not "lambda" or "rate parameter" (in isolation)
  - Probabilities: $P(X = 4)$ not "P(X=4)", $P(X \\leq 3)$ not "P(X<=3)"
  - Hypothesis tests: $H_0$ and $H_1$ not "null hypothesis" (in notation)
  - BAD: "The average is 4.5 and the variability is 7"
  - GOOD: "The random variable $X$ has mean $\\mu = 4.5$ and standard deviation $\\sigma = 7$"
  - BAD: "with a rate of 3 per hour"
  - GOOD: "where $X \\sim \\text{Po}(3)$ represents the number of arrivals per hour"

DEPTH CALIBRATION (A-Level / Ages 16-18):
  - Part (a) MUST NOT be trivially easy (no primary-school fractions like 120/200).
  - Part (a) should involve identifying a distribution, calculating a probability,
    or applying a formula — NOT simple arithmetic.
  - For statistics: even the "easy" opener should require identifying a distribution
    model or defining a parameter formally.
  - BAD part (a): "What fraction of respondents chose Option A?" (trivial division)
  - GOOD part (a): "State the distribution of $X$, the number of defective items
    in a sample of 20. Calculate $P(X = 3)$."

═══════════════════════════════════════════════════════════════════════════════
`;
}
