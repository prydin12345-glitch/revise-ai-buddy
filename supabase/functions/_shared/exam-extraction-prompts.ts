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

// Get subject-specific generation instructions
export function getSubjectSpecificInstructions(subject: string, examBoard: string, level: string): string {
  const subjectLower = (subject || '').toLowerCase();
  
  if (subjectLower.includes('biology')) {
    return `For ${examBoard.toUpperCase()} ${level} Biology: Write CONCISE questions. For MCQs keep options SHORT. Include structured questions and extended response. Topics: Cell biology, Genetics, Ecology, Physiology, Evolution. Marks: 1-2 (recall), 3-4 (application), 6+ (extended). Command words: State, Describe, Explain, Compare, Evaluate, Calculate.`;
  }
  
  if (subjectLower.includes('chemistry')) {
    return `For ${examBoard.toUpperCase()} ${level} Chemistry: Include calculations with moles, concentrations. Topics: Atomic structure, Bonding, Organic chemistry, Reactions, Equilibria. Use correct chemical notation. Include enthalpy calculations, rate equations.`;
  }
  
  if (subjectLower.includes('physics')) {
    return `For ${examBoard.toUpperCase()} ${level} Physics: Heavy use of calculations. Topics: Mechanics, Waves, Electricity, Fields, Particles. Use SI units. Multi-step "show that" questions. Include experimental scenarios.`;
  }
  
  if (subjectLower.includes('math')) {
    return `For ${examBoard.toUpperCase()} ${level} Mathematics: NO MCQs. Main questions with sub-parts (a), (b), (c). Topics: Calculus, Algebra, Trigonometry. Marks 2-14 per question. Heavy LaTeX notation. Include "show that" and "hence" questions.`;
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

// Build the extraction prompt (simplified version)
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
  
  const specSection = specTopics.length > 0 
    ? `\nSPECIFICATION TOPICS:\n${specTopics.map((s: any) => `- ${s.topic_name}`).join('\n')}\n`
    : '';

  const truncatedPdf = pdfText.substring(0, 50000);

  return `Extract exam questions from this ${examBoard.toUpperCase()} ${qualificationLevel} ${subjectId} paper.
${resourcePackContext}
${specSection}
${subjectInstructions}

${useOriginalStructure ? 'PRESERVE original question structure.' : 'Generate NEW questions inspired by this content.'}

SCIENTIFIC NOTATION: Use LaTeX: "$2.15 \\times 10^{-12}$", "$H_2O$", "$v^2$". NEVER use HTML tags.

PDF CONTENT:
---
${truncatedPdf}
---

Return JSON: { "detected_subject": "string", "subject_confidence": number, "subject_reasoning": "string", "questions": [...], "topics": [...] }

Question format: { "question_number", "question_type", "question_text", "question_latex", "has_math", "parent_question_number", "root_question_number", "marks", "options" (MCQ only), "correct_answer", "topic_tag", "difficulty_level", "has_figures", "has_tables", "extraction_confidence" }`;
}

// Regeneration prompt for individual questions
export function buildRegenerationPrompt(question: any, hasResourcePack: boolean): string {
  if (hasResourcePack) {
    // Skip regeneration for resource-based exams to preserve source adherence
    return '';
  }
  
  return `Original question: "${question.question_text}"
Topic: ${question.topic_tag}
Type: ${question.question_type}
Marks: ${question.marks}
Difficulty: ${question.difficulty_level}

Generate a COMPLETELY NEW question that:
1. Tests the SAME concept
2. Uses DIFFERENT wording
3. Provides DIFFERENT examples
4. Uses NEW synthetic values for numerical data
5. For MCQs: Create NEW options
6. Maintains same difficulty and marks

Use LaTeX for math: "$\\frac{1}{2}$", "$x^2$". NEVER use HTML tags.

Return ONLY the new question text.`;
}
