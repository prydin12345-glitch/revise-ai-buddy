// Shared prompts and helpers for exam extraction

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to repair incomplete JSON
export function repairJSON(jsonStr: string): string {
  let repaired = jsonStr.trim();
  
  repaired = repaired
    .replace(/\\([a-zA-Z]+)\{/g, '\\\\$1{')
    .replace(/\\([a-zA-Z]+)\s/g, '\\\\$1 ')
    .replace(/\\_/g, '\\\\_')
    .replace(/\\,/g, '\\\\,')
    .replace(/\\;/g, '\\\\;')
    .replace(/\\\\"/g, '\\"')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }
  
  repaired = repaired.replace(/,(\s*[\]}])/g, '$1');
  
  return repaired;
}

// Helper function to determine image handling strategy
export function determineImageStrategy(question: any): 'concept_replacement' | 'original_reference' {
  const imageKeywords = ['graph', 'diagram', 'chart', 'figure', 'table', 'image', 'illustration', 'plot'];
  const questionLower = question.question_text.toLowerCase();
  
  const hasComplexVisual = imageKeywords.some(kw => questionLower.includes(kw));
  
  if (hasComplexVisual && question.marks >= 4) {
    return 'original_reference';
  }
  
  return 'concept_replacement';
}

// Helper function to normalize question numbers for sorting
export function normalizeQuestionNumber(qNum: string): string {
  const match = qNum.match(/^(\d+)([a-z]?)(?:\(([ivxlcdm]+)\))?$/i);
  if (!match) return qNum.padStart(10, '0');
  
  const [, num, letter, roman] = match;
  const paddedNum = num.padStart(3, '0');
  const letterPart = letter ? `_${letter}` : '';
  
  const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  const romanPart = roman ? `_${String(romanMap[roman.toLowerCase()] || 0).padStart(3, '0')}` : '';
  
  return `${paddedNum}${letterPart}${romanPart}`;
}

// Universal Assessment Objective (AO) Analysis Instructions
export function getUniversalAOInstructions(): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
🎯 UNIVERSAL QUESTION PAPER DECONSTRUCTION PROTOCOL
═══════════════════════════════════════════════════════════════════════════════

PHASE 1: DECONSTRUCT THE QP LOGIC
─────────────────────────────────
For EVERY question in the uploaded Question Paper, you MUST identify:

1. ASSESSMENT OBJECTIVE (AO) MAPPING:
   • AO1 = Knowledge & Understanding (recall facts, definitions, processes)
   • AO2 = Application & Analysis (apply knowledge, analyze data/sources)
   • AO3 = Evaluation & Synthesis (evaluate arguments, form judgments)
   • AO4 = Communication/Extended Writing (quality of written communication)

2. COMMAND VERB ANALYSIS - Extract the EXACT verb and respect its cognitive level:
   LOW-LEVEL (AO1): List, State, Identify, Name, Define, Label, Give
   MID-LEVEL (AO2): Describe, Explain, Calculate, Compare, Outline, Suggest
   HIGH-LEVEL (AO3/4): Evaluate, Assess, Discuss, Analyze, "To what extent", Justify

   ⚠️ CRITICAL: A 4-mark "List" question must NEVER use "Analyze" logic.
   ⚠️ CRITICAL: A 20-mark "Evaluate" question must NEVER use "Identify" logic.

PHASE 2: MAP THE ASSESSMENT JOURNEY
────────────────────────────────────
Identify the MARK SCALING pattern in the original QP:

1. LOW-MARK QUESTIONS (1-4 marks):
   • Simple retrieval or identification
   • Single-step tasks
   • Confidence builders - keep accessible
   • Example: "List four things from Source A about..."

2. MID-MARK QUESTIONS (5-12 marks):
   • Multi-step reasoning required
   • Source analysis or application
   • Requires structured response
   • Example: "Explain how the writer uses language to..."

3. HIGH-MARK QUESTIONS (12-25+ marks):
   • Extended writing or essays
   • Evaluation, judgment, or synthesis
   • Must show balanced argument if applicable
   • Example: "To what extent do you agree that..."

4. COMPOSITE QUESTIONS (e.g., 16+4, 12+3):
   • Main content marks + SPaG/communication marks
   • Preserve this split in generated questions

PHASE 3: FORMAT STRICTNESS
──────────────────────────
ONLY generate tasks in formats EXPLICITLY found in the uploaded QP:

• If QP uses prose/essay format → NEVER generate scripts, screenplays, letters
• If QP uses "statement + agree/disagree" → Mirror this exact structure
• If QP uses bullet-pointed guidance → Include identical guidance style
• If QP uses specific rubrics → Preserve them exactly

PHASE 4: SOURCE/INSERT INTEGRATION
──────────────────────────────────
When the exam includes an Insert/Source Booklet:

1. LINE REFERENCING: Use same style as original (e.g., "lines 5-12", "paragraph 3")
2. SOURCE LABELLING: Use identical format (e.g., "Source A", "Extract 1", "Figure 2")
3. CROSS-REFERENCING: If original QP requires comparing sources, preserve this:
   "Using Source A and Source B, explain..." or "How far do Sources C and D agree..."
4. QUOTATION REQUIREMENTS: If original expects embedded quotes, specify this clearly

PHASE 5: VALIDATION CHECKLIST
─────────────────────────────
For each generated question, internally verify:

□ Does the command verb match the original question's cognitive level?
□ Does the mark allocation reflect appropriate depth?
□ Is the format identical to the specification requirements?
□ Are source references accurate and in the correct style?
□ Would this question be "on-spec" for the exam board?

═══════════════════════════════════════════════════════════════════════════════
`
;
}

// Get subject-specific generation instructions
export function getSubjectSpecificInstructions(subject: string, examBoard: string, level: string): string {
  const subjectLower = (subject || '').toLowerCase();
  const boardLower = (examBoard || '').toLowerCase();
  
  // AQA English Language specific rules
  if ((subjectLower.includes('english') && subjectLower.includes('language')) || 
      (boardLower === 'aqa' && subjectLower.includes('english'))) {
    return `For ${examBoard.toUpperCase()} ${level} English Language - STRICT AQA SPECIFICATION ADHERENCE:

QUESTION 1 (4 marks) - RETRIEVAL ONLY:
- Command verb: "List" ONLY (never "examine", "analyze", "explore")
- Task: "List four things from lines X-Y about [simple topic]"
- Requires BASIC IDENTIFICATION of explicit facts - NO inference required
- Example: "List four things from lines 1-10 about Rosabel's journey home"
- This builds student confidence - keep it LITERAL and LOW-EFFORT

QUESTION 2 (8 marks) - LANGUAGE ANALYSIS (AO2):
- Focus on HOW the writer uses language to describe/create effect
- MUST include standard AQA bullet points:
  "You could include the writer's choice of:
  • words and phrases
  • language features and techniques
  • sentence forms"
- Focus on "effect" and "atmosphere", not abstract concepts like "social positions"

QUESTION 3 (8 marks) - STRUCTURE ANALYSIS (AO3):
- Focus PURELY on STRUCTURAL shifts - NOT narrative voice or perspective
- Use phrases: "at the beginning", "then shifts to", "at the end"
- Ask how writer structures text to "interest you as a reader"
- Analyze the JOURNEY of the reader's focus through the text
- NEVER mention "narrative perspective" or "internal states" - those are AO2/AO4

QUESTION 4 (20 marks) - EVALUATION (AO4):
- Use "student statement" format with quoted opinion
- Statement must be BALANCED to allow partial agreement
- Focus on human-interest themes (sympathy, admiration, concern)
- Include three guidance bullet points after the statement
- Avoid overly literary-critical statements like "passive observer"

QUESTION 5 (40 marks) - CREATIVE WRITING (AO5/AO6):
- PROSE FICTION ONLY - descriptions OR narratives
- NEVER request scripts, screenplays, plays, or technical formats
- Two options: "Write a description of..." OR "Write a story about/titled..."
- Focus on descriptive language and narrative craft
- Example: "Describe a busy market" or "Write a story titled 'The Discovery'"

CRITICAL: Questions MUST scale in difficulty from 4 marks (simple retrieval) to 40 marks (extended creative writing). Follow the AQA "Assessment Journey".`;
  }
  
  if (subjectLower.includes('biology')) {
    return `For ${examBoard.toUpperCase()} ${level} Biology — APPLICATION-FIRST RUBRIC (model on OCR H420/01, AQA 7402, Edexcel 9BN0, CIE 9700, IB Biology HL):

COGNITIVE MIX (HARD RULE):
- ≤ 25% AO1 recall (State / Name / Define / Identify).
- ≥ 50% AO2 application & data-handling (Calculate, Deduce, Use Figure X, Use the data in Table Y).
- ≥ 25% AO3 analysis & evaluation (Evaluate, Suggest reasons for, Critique the method, Explain the evidence).

MCQ RULE:
- Every MCQ must be STIMULUS-BASED — built around a short data table, graph, micrograph description, experimental setup, or short results passage. The stem must require the student to interpret the stimulus, not recall a textbook fact.
- BANNED: pure-definition MCQs ("What is the definition of …?", "Which term describes …?"), single-word recall ("Which is a carbohydrate?"), four-textbook-term distractor sets.

DATA-HANDLING REQUIREMENT:
- At least one third of structured (non-MCQ) questions must reference a provided data table, graph, or experimental result and ask the student to calculate, deduce, interpret, or compare values from it. Use diagram_config with type "data_table" or "bar_chart" so the data is rendered.

EXPERIMENTAL RIGOUR REQUIREMENT:
- At least two questions per paper must involve experimental methodology: identifying the independent / dependent / controlled variables, suggesting an appropriate control, justifying the number of repeats, evaluating a stated method, or commenting on validity / reliability / accuracy / precision.

MATHEMATICAL PRECISION REQUIREMENT:
- Include at least one quantitative calculation ("show that …", percentage change, rate of reaction / uptake / transpiration, magnification, surface area : volume, Hardy–Weinberg p² + 2pq + q² = 1, chi-squared interpretation against critical values, water potential ψ = ψs + ψp, Simpson's index). Specify the required number of significant figures or decimal places.

PREFERRED STEMS:
- "Figure 1 shows … Use the graph to calculate …"
- "Table 2 shows the results of an investigation into … Suggest one reason for the trend shown."
- "A student investigated … Evaluate the student's method."
- "Calculate the percentage increase in rate of oxygen uptake between 20 °C and 35 °C."
- "Explain the evidence in Figure 3 for …"

MARK BANDS (caps governed centrally):
- 1–2 marks: short application or data read-off (not bare recall).
- 3–5 marks: multi-step calculation, structured explanation, or short evaluation.
- 6–8 marks: extended explanation linking two concepts, or full method evaluation.

Topics: Cell biology, Biological molecules, Genetics & inheritance, Ecology, Physiology, Evolution, Biochemistry. Use IUPAC chemistry notation where relevant. Keep MCQ option text short.`;
  }
  
  if (subjectLower.includes('chemistry')) {
    return `For ${examBoard.toUpperCase()} ${level} Chemistry — APPLICATION-FIRST RUBRIC (model on OCR H432, AQA 7405, Edexcel 9CH0, CIE 9701, IB Chemistry HL):

COGNITIVE MIX (HARD RULE):
- ≤ 25% AO1 recall. ≥ 50% AO2 application & data-handling. ≥ 25% AO3 analysis & evaluation.

MCQ RULE:
- Every MCQ must be stimulus-based — built around a reaction, mechanism, spectrum, titration curve, energy profile, or numerical data. No pure-definition MCQs.

REQUIRED CONTENT:
- Include calculations with moles, concentrations, limiting reagents, percentage yield, atom economy, enthalpy (ΔH), Hess cycles, Kc / Kp, pH and Ksp, rate equations and orders, Arrhenius, and electrochemistry where appropriate to the level.
- At least one third of structured questions must reference experimental data (titration, calorimetry, kinetics, spectra) and require calculation or interpretation.
- Include at least one "show that …" calculation per paper, with explicit significant figures.
- Include at least one question on experimental method (errors, controls, accuracy, percentage uncertainty, suitable apparatus).

Topics: Atomic structure, Bonding, Energetics, Kinetics, Equilibria, Organic chemistry, Transition metals, Spectroscopy. Use correct chemical notation, state symbols, and SI units.`;
  }
  
  if (subjectLower.includes('physics')) {
    return `For ${examBoard.toUpperCase()} ${level} Physics — APPLICATION-FIRST RUBRIC (model on OCR H556, AQA 7408, Edexcel 9PH0, CIE 9702, IB Physics HL):

COGNITIVE MIX (HARD RULE):
- ≤ 25% AO1 recall. ≥ 50% AO2 application & data-handling. ≥ 25% AO3 analysis & evaluation.

MCQ RULE:
- Every MCQ must be stimulus-based — built around a circuit, graph, vector diagram, ray diagram, or numerical data set. No bare definition MCQs.

REQUIRED CONTENT:
- Heavy use of multi-step calculations with SI units and significant figures.
- At least one third of structured questions must reference a graph, table, or experimental setup and require calculation, gradient/area interpretation, or uncertainty analysis.
- Include at least one "show that …" derivation per paper.
- Include at least one question on experimental method: variables, controls, repeats, sources of error, percentage uncertainty, suitable apparatus and resolution.
- Include synoptic links between topics where the level allows.

Topics: Mechanics, Materials, Waves, Electricity, Fields, Particle physics, Thermal physics, Nuclear. Use SI units (ms⁻¹, ms⁻², Nm⁻¹) and standard symbols.`;
  }
  
  if (subjectLower.includes('math') || subjectLower.includes('statistics') || subjectLower.includes('stats')) {
    return `For ${examBoard.toUpperCase()} ${level} Mathematics/Statistics:
NO MCQs. Main questions with sub-parts (a), (b), (c). Topics: Calculus, Algebra, Trigonometry, Statistics, Probability.
Marks 4-14 per question. Heavy LaTeX notation. Include "show that" and "hence" questions.

THREE-TIER STRUCTURE (MANDATORY):
- Part (a): Straightforward calculation using a formula. e.g., "Calculate $P(X = 4)$."
- Part (b): State an assumption or explain why a model is appropriate. e.g., "State one assumption for this model."
- Part (c): 'Show that' or reverse question requiring algebraic rearrangement/logarithms. e.g., "Given that $P(X=0) = 0.05$, show that $\\lambda \\approx 3.0$."

FORMAL NOTATION (MANDATORY):
- Use $P(X = k)$, $P(X \\leq n)$, $P(X > n)$ — NEVER "Find the likelihood" or "What are the chances".
- State distributions: $X \\sim \\text{Po}(\\lambda)$, $Y \\sim B(n, p)$, $W \\sim N(\\mu, \\sigma^2)$.
- Use "probability" not "likelihood". Do NOT name the distribution model in the question — let students identify it.
- Use command verbs: Calculate, Determine, State, Show that, Hence, Deduce, Verify, Justify.
- Include "Give your answer to 3 significant figures" where appropriate.

MARK SCHEME:
- correct_answer must include M1 (Method), A1 (Accuracy), B1 (Independent) breakdown.
- At least one sub-part per question must require a text-based contextual explanation.`;
  }
  
  return `Generate balanced mix for ${examBoard.toUpperCase()} ${level}. Various question types. Appropriate command words. Mix of short answer (1-4 marks) and extended response (6+ marks).`;
}

// Build resource pack context for strict source adherence
export function buildResourcePackContext(resourceItems: any[]): { context: string; hasResourcePack: boolean } {
  if (!resourceItems || resourceItems.length === 0) {
    return { context: '', hasResourcePack: false };
  }

  const allResourceText = resourceItems.map((r: any) => r.content_text || '').join(' ');
  const properNouns = allResourceText.match(/\b[A-Z][a-z]+\b/g) || [];
  const uniqueNames = [...new Set(properNouns)].slice(0, 20).join(', ');
  
  let context = `
🚨 RESOURCE-BASED EXAM - MANDATORY SOURCE ADHERENCE 🚨
ALL questions MUST reference sources below. Character names MUST be from source: "${uniqueNames}".
DO NOT INVENT names like "Elara", "Sarah", "Silas". Use ONLY source content.

VALIDATION: Every question must reference "Source A", "Source B", etc. and use only provided characters/events.

📚 SOURCE MATERIAL:
`;
  
  for (const item of resourceItems) {
    context += `\n--- ${item.source_label} ---\n`;
    context += `Type: ${item.resource_type}\n`;
    if (item.attribution) context += `Attribution: ${item.attribution}\n`;
    if (item.content_text) context += `Content:\n"${item.content_text}"\n`;
    if (item.content_json) context += `Data: ${JSON.stringify(item.content_json)}\n`;
  }
  
  context += `\n--- END SOURCES ---\n`;
  
  return { context, hasResourcePack: true };
}

// System prompt for resource-based exams
export function getSystemPrompt(hasResourcePack: boolean): string {
  if (hasResourcePack) {
    return `You are an expert exam question generator with STRICT source adherence.
CRITICAL: This exam has an INSERT/RESOURCE PACK. You MUST:
1. ONLY use characters, names, places from the provided source material
2. NEVER invent new characters (if source has "Rosabel", do NOT use "Elara")
3. EVERY question must reference the sources ("Read Source A...", "Using Source A...")
4. Line references must be accurate to actual source content
Return valid JSON only. Escape LaTeX backslashes as \\\\.`;
  }
  
  return `You are an expert exam question generator. Create NEW, original questions inspired by exam content, never copying verbatim. Generate fresh wording while preserving educational objectives. Return valid JSON only. Escape LaTeX backslashes as \\\\.`;
}

// Build the extraction prompt with full AO deconstruction
export function buildExtractionPrompt(params: {
  examBoard: string;
  qualificationLevel: string;
  subjectId: string;
  specTopics: any[];
  pdfText: string;
  useOriginalStructure: boolean;
  resourcePackContext: string;
  subjectInstructions: string;
}): string {
  const { examBoard, qualificationLevel, subjectId, specTopics, pdfText, useOriginalStructure, resourcePackContext, subjectInstructions } = params;
  
  const universalAO = getUniversalAOInstructions();
  
  const specSection = specTopics.length > 0 
    ? `\nSPECIFICATION TOPICS:\n${specTopics.map((s: any) => `- ${s.topic_name}`).join('\n')}\n`
    : '';

  const truncatedPdf = pdfText.substring(0, 50000);

  return `You are generating questions for a ${examBoard.toUpperCase()} ${qualificationLevel} ${subjectId} exam.

${universalAO}

${resourcePackContext}

${specSection}

${subjectInstructions}

═══════════════════════════════════════════════════════════════════════════════
📄 ORIGINAL QUESTION PAPER (QP) FOR ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

INSTRUCTIONS:
${useOriginalStructure 
  ? `ANALYZE this QP to understand its Assessment Journey, then generate NEW questions that:
     • Mirror the EXACT mark allocations (e.g., Q1=4, Q2=8, Q3=8, Q4=20, Q5=40)
     • Use the SAME command verbs at each position (if Q1 uses "List", your Q1 uses "List")
     • Follow the SAME format patterns (bullet guidance, statement structures, etc.)
     • Reference the Insert/Sources in the SAME style as the original
     • Scale difficulty identically from retrieval → analysis → evaluation → extended writing`
  : `Use this QP as INSPIRATION ONLY to understand the exam board style, then generate COMPLETELY ORIGINAL questions with:
     • Fresh scenarios, contexts, and focus areas
     • Different source references while maintaining the referencing style
     • New balanced statements for evaluation questions
     • Original creative writing prompts in permitted formats only`
}

CRITICAL RULES:
1. COMMAND VERB DISCIPLINE: Match cognitive level to marks exactly
2. FORMAT STRICTNESS: Only use formats found in the original QP (NO screenplays if not in original)
3. SOURCE INTEGRATION: Use exact same line-referencing/labelling style as original
4. CROSS-REFERENCING: If high-mark questions require comparing sources, preserve this requirement
5. SCIENTIFIC NOTATION: Use LaTeX: "$2.15 \\times 10^{-12}$", "$H_2O$", "$v^2$". NEVER use HTML tags.

UPLOADED QUESTION PAPER:
---
${truncatedPdf}
---

═══════════════════════════════════════════════════════════════════════════════

Return JSON with this structure:
{
  "detected_subject": "string",
  "subject_confidence": number,
  "subject_reasoning": "string",
  "qp_analysis": {
    "mark_distribution": [{"question": "1", "marks": 4, "ao": "AO1", "command_verb": "List"}],
    "format_patterns": ["prose_only", "statement_format", "bullet_guidance"],
    "source_referencing_style": "lines X-Y / Source A"
  },
  "questions": [...],
  "topics": [...]
}

Question format: {
  "question_number": "string",
  "question_type": "string", 
  "question_text": "string",
  "question_latex": "string",
  "has_math": boolean,
  "parent_question_number": "string|null",
  "root_question_number": "string|null",
  "marks": number,
  "ao_mapping": "AO1|AO2|AO3|AO4",
  "command_verb": "string",
  "options": [...] (MCQ only),
  "correct_answer": "string",
  "topic_tag": "string",
  "difficulty_level": "string",
  "has_figures": boolean,
  "has_tables": boolean,
  "extraction_confidence": number,
  "spec_alignment_notes": "string (brief note on why this question is on-spec)"
}`;
}

// Regeneration prompt for individual questions with AO awareness
export function buildRegenerationPrompt(question: any, hasResourcePack: boolean, resourcePackContext?: string): string {
  const aoGuidance = `
ASSESSMENT OBJECTIVE PRESERVATION:
- This question is worth ${question.marks} marks
- Command verb level: ${question.marks <= 4 ? 'LOW (retrieval/identification)' : question.marks <= 12 ? 'MID (explanation/analysis)' : 'HIGH (evaluation/synthesis)'}
- Preserve the cognitive demand level exactly
`;

  if (hasResourcePack) {
    return `${aoGuidance}

RESOURCE-BASED REGENERATION:
Original question: "${question.question_text}"
Topic: ${question.topic_tag}
Marks: ${question.marks}

Generate a NEW question that:
1. References the SAME sources but focuses on DIFFERENT aspects/lines
2. Uses the SAME command verb cognitive level
3. Maintains identical source-referencing style
4. For cross-reference questions: use different source combinations if multiple exist
5. NEVER invent content not in the sources

${resourcePackContext || ''}

Return ONLY the new question text with proper source references.`;
  }
  
  return `${aoGuidance}

Original question: "${question.question_text}"
Topic: ${question.topic_tag}
Type: ${question.question_type}
Marks: ${question.marks}
Difficulty: ${question.difficulty_level}

Generate a COMPLETELY NEW question that:
1. Tests the SAME concept/Assessment Objective
2. Uses the SAME cognitive level command verb
3. Provides DIFFERENT scenarios, contexts, or examples
4. Uses NEW synthetic values for numerical data
5. For MCQs: Create NEW options with similar distractor quality
6. Maintains same difficulty and marks
7. Would be considered "on-spec" for this exam board

Use LaTeX for math: "$\\frac{1}{2}$", "$x^2$". NEVER use HTML tags.

Return ONLY the new question text.`;
}
