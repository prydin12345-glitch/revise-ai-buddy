/**
 * Combined region + educational level generation context for Edge Functions.
 * Mirrors src/lib/generation-context.ts for server-side use.
 */

export interface GenerationContext {
  region: string;
  level: string;
  examBoard?: string;
  questionStyle: string;
  markSchemeFormat: string;
  unitConventions: string;
  vocabularyLevel: string;
}

export function buildGenerationContext(
  curriculumRegion: string | null | undefined,
  educationalTier: string | null | undefined
): GenerationContext {
  const region = (curriculumRegion || "").toLowerCase();
  const level = (educationalTier || "").toLowerCase();

  // UK
  if (region === "gb" || region === "uk" || region.includes("united kingdom")) {
    if (level === "secondary_14_16" || level.includes("gcse") || level.includes("ks4"))
      return { region: "UK", level: "GCSE", examBoard: "AQA/Edexcel/OCR",
        questionStyle: 'Use command words: State, Describe, Explain, Calculate, Show that, Hence. Parts (a)(b)(c). Mark allocations.',
        markSchemeFormat: 'M1/A1/B1 marks. Total in brackets.', unitConventions: 'SI units. ms⁻¹. g = 9.8 ms⁻².',
        vocabularyLevel: 'Clear, accessible language.' };
    if (level === "college_16_18" || level.includes("a-level") || level.includes("a level"))
      return { region: "UK", level: "A-Level", examBoard: "AQA/Edexcel/OCR",
        questionStyle: 'State, Prove, Derive, Hence or otherwise, Show that, Deduce. Multi-part with scaffolding. Proof expected.',
        markSchemeFormat: 'M1/A1/B1. 3 sig figs default.', unitConventions: 'SI strictly. ms⁻¹, ms⁻², Nm⁻¹. Greek letters.',
        vocabularyLevel: 'Academic. Technical terms without definition.' };
    if (level === "university_18plus" || level.includes("university") || level.includes("degree"))
      return { region: "UK", level: "University", examBoard: "University internal",
        questionStyle: 'Proof-based. "Discuss", "Critically evaluate", "Derive from first principles".',
        markSchemeFormat: 'Criteria based. Partial credit for method.', unitConventions: 'SI. Dimensional analysis. Rigorous notation.',
        vocabularyLevel: 'High academic register. Technical vocabulary assumed.' };
  }

  // USA
  if (region === "us" || region.includes("usa") || region.includes("united states")) {
    if (level.includes("high school") || level === "secondary_14_16" || level.includes("standard"))
      return { region: "USA", level: "High School", examBoard: "State curriculum",
        questionStyle: 'Multiple choice + free response. Scaffolding. Real-world contexts.',
        markSchemeFormat: 'Points rubric. Partial credit.', unitConventions: 'Metric + imperial mix. Metric in science.',
        vocabularyLevel: 'Accessible. Real-world contexts.' };
    if (level.includes("ap") || level.includes("advanced placement") || level === "college_16_18")
      return { region: "USA", level: "AP", examBoard: "College Board",
        questionStyle: 'MC (stimulus-based) + FRQs. "Explain", "Justify", "Calculate". No "Show that" — use "Verify".',
        markSchemeFormat: 'AP rubric. 1-9 point scale. Partial credit.', unitConventions: 'Metric for science. m/s not ms⁻¹. Sig figs.',
        vocabularyLevel: 'College-level. Stimulus materials required.' };
    if (level.includes("college") || level === "university_18plus" || level.includes("university"))
      return { region: "USA", level: "College/University", examBoard: "Institution internal",
        questionStyle: 'Problem sets, proofs, analysis. Short + extended response.',
        markSchemeFormat: 'Rubric-based.', unitConventions: 'Metric in STEM. MLA/APA in humanities.',
        vocabularyLevel: 'High academic register.' };
  }

  // Germany
  if (region === "de" || region.includes("germany") || region.includes("deutschland")) {
    if (level.includes("abitur") || level.includes("gymnasium") || level === "college_16_18")
      return { region: "Germany", level: "Abitur", examBoard: "KMK / State Kultusministerium",
        questionStyle: 'Structured multi-part. Three requirement levels.',
        markSchemeFormat: 'Punkte/BE based. Pass ~50%.', unitConventions: 'SI. Comma decimal. m/s.',
        vocabularyLevel: 'Formal academic German register.' };
  }

  // International / IB
  if (region === "ib" || region.includes("international")) {
    if (level.includes("ib diploma") || level.includes("dp") || level === "college_16_18")
      return { region: "International", level: "IB Diploma", examBoard: "IBO",
        questionStyle: 'Data-based, structured, extended response. "To what extent", "Evaluate", "Analyse". ToK links.',
        markSchemeFormat: 'Mark bands. HL vs SL differentiation.', unitConventions: 'SI. International spellings. Sig figs strict.',
        vocabularyLevel: 'International academic English. Culturally neutral.' };
    if (level.includes("igcse") || level.includes("cambridge") || level === "secondary_14_16")
      return { region: "International", level: "Cambridge IGCSE", examBoard: "Cambridge Assessment",
        questionStyle: '"State", "Describe", "Explain", "Calculate". Core + Extended tiers.',
        markSchemeFormat: 'Mark scheme points. ecf rule.', unitConventions: 'SI. International standard.',
        vocabularyLevel: 'Clear international English.' };
  }

  // Vocational / Professional
  if (level.includes('hnc') || level.includes('hnd')) return {
    region: curriculumRegion || "UK", level: 'HNC/HND', examBoard: 'SQA / BTEC',
    questionStyle: 'Vocational and applied questions. Mix of theory and practical application. "Explain how...", "Describe the process of...", "Evaluate the use of...".',
    markSchemeFormat: 'Criteria-based pass/merit/distinction grading.', unitConventions: 'Industry-standard units.',
    vocabularyLevel: 'Professional and technical language.' };

  if (level.includes('nvq') || level.includes('btec')) return {
    region: curriculumRegion || "UK", level: 'NVQ/BTEC', examBoard: 'BTEC / City & Guilds',
    questionStyle: 'Competency and evidence-based questions. Practical scenarios.',
    markSchemeFormat: 'Pass/Merit/Distinction criteria.', unitConventions: 'Workplace terminology.',
    vocabularyLevel: 'Practical and applied language.' };

  if (level.includes('apprenticeship')) return {
    region: curriculumRegion || "UK", level: 'Apprenticeship', examBoard: 'End Point Assessment',
    questionStyle: 'Scenario-based questions with workplace contexts.',
    markSchemeFormat: 'Pass/Distinction criteria.', unitConventions: 'Industry-standard.',
    vocabularyLevel: 'Professional but accessible.' };

  if (level.includes('certification') || level.includes('aws') || level.includes('cisco') || level.includes('cpd')) return {
    region: curriculumRegion || "International", level: 'Professional Certification', examBoard: 'Vendor/Industry Body',
    questionStyle: 'Scenario-based MC. "Which best describes...", "In this scenario...".',
    markSchemeFormat: 'Single correct answer.', unitConventions: 'Industry-standard.',
    vocabularyLevel: 'Professional technical language.' };

  if (level.includes('ks3') || level.includes('key stage 3')) return {
    region: curriculumRegion || "UK", level: 'KS3', examBoard: 'National Curriculum',
    questionStyle: 'Simple command words: State, Describe, Explain. Short answers.',
    markSchemeFormat: 'Points-based. 1-3 marks.', unitConventions: 'SI units. Simple notation.',
    vocabularyLevel: 'Age-appropriate. Accessible language.' };

  // Fallback
  return {
    region: curriculumRegion || "International", level: educationalTier || "General",
    examBoard: "General",
    questionStyle: `Generate questions appropriate for ${educationalTier || 'general'} level study.`,
    markSchemeFormat: 'Points-based with partial credit.',
    unitConventions: 'SI units throughout.',
    vocabularyLevel: `Language appropriate for ${educationalTier || 'general'} level.`,
  };
}

export function formatGenerationContextPrompt(ctx: GenerationContext): string {
  return `
GENERATION CONTEXT — ${ctx.level} in ${ctx.region}
═══════════════════════════════════════════════════
QUESTION STYLE: ${ctx.questionStyle}
MARK SCHEME FORMAT: ${ctx.markSchemeFormat}
UNIT CONVENTIONS: ${ctx.unitConventions}
VOCABULARY LEVEL: ${ctx.vocabularyLevel}
${ctx.examBoard ? `EXAM BOARD STYLE: ${ctx.examBoard}` : ''}

Never mix conventions from different regions or levels.
Always match the exact style a student would see in their real ${ctx.level} examination.
`;
}
