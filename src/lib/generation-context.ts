/**
 * Combined region + educational level generation context.
 * Injected into every AI prompt so questions match the exact exam style
 * for a student's country AND academic level.
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

export const buildGenerationContext = (
  curriculumRegion: string | null | undefined,
  educationalTier: string | null | undefined
): GenerationContext => {
  const region = (curriculumRegion || "").toLowerCase();
  const level = (educationalTier || "").toLowerCase();

  // ── UK ──
  if (region === "gb" || region === "uk" || region.includes("united kingdom")) {
    if (level === "secondary_14_16" || level.includes("gcse") || level.includes("ks4"))
      return {
        region: "UK", level: "GCSE",
        examBoard: "AQA/Edexcel/OCR",
        questionStyle: 'Use command words: State, Describe, Explain, Calculate, Show that, Hence. Questions should be broken into parts (a)(b)(c). Include mark allocations.',
        markSchemeFormat: 'Use M1 (method marks), A1 (accuracy marks), B1 (independent marks). Total marks shown in brackets.',
        unitConventions: 'SI units. ms⁻¹ not m/s. Degrees symbol °. Use g = 9.8 or 9.81 ms⁻² unless stated.',
        vocabularyLevel: 'Clear, accessible language. Avoid overly technical phrasing. Define specialist terms where needed.',
      };

    if (level === "college_16_18" || level.includes("a-level") || level.includes("a level"))
      return {
        region: "UK", level: "A-Level",
        examBoard: "AQA/Edexcel/OCR",
        questionStyle: 'Use command words: State, Prove, Derive, Hence or otherwise, Show that, Deduce, Comment on. Multi-part questions with scaffolding. Proof and derivation questions expected.',
        markSchemeFormat: 'M1/A1/B1 marking. Method marks awarded for correct approach even with arithmetic errors. Final answers to 3 significant figures unless stated.',
        unitConventions: 'SI units strictly. ms⁻¹, ms⁻², Nm⁻¹. Greek letters for angles (θ, α, ω). Vectors in bold or underlined.',
        vocabularyLevel: 'Academic language expected. Technical terms used without definition. Students expected to know subject-specific vocabulary.',
      };

    if (level === "university_18plus" || level.includes("university") || level.includes("degree"))
      return {
        region: "UK", level: "University",
        examBoard: "University internal",
        questionStyle: 'Proof-based questions. Open-ended analysis. "Discuss", "Critically evaluate", "Derive from first principles". Essay components where appropriate.',
        markSchemeFormat: 'Marking criteria based. Partial credit for method. Clear logical structure rewarded.',
        unitConventions: 'SI units. Dimensional analysis expected. Rigorous notation.',
        vocabularyLevel: 'High academic register. Technical vocabulary assumed. Precise mathematical language.',
      };
  }

  // ── USA ──
  if (region === "us" || region.includes("usa") || region.includes("united states")) {
    if (level.includes("high school") || level === "secondary_14_16" || level.includes("standard"))
      return {
        region: "USA", level: "High School",
        examBoard: "State curriculum",
        questionStyle: 'Mix of multiple choice and free response. Clear scaffolding. Real-world application contexts.',
        markSchemeFormat: 'Points-based rubric. Partial credit on free response. Multiple choice worth 1 point each.',
        unitConventions: 'Mix of metric and imperial. miles, pounds, Fahrenheit common in everyday contexts. Metric in science.',
        vocabularyLevel: 'Accessible. Real-world contexts. Avoid overly abstract phrasing.',
      };

    if (level.includes("ap") || level.includes("advanced placement") || level === "college_16_18")
      return {
        region: "USA", level: "AP",
        examBoard: "College Board",
        questionStyle: 'Multiple choice (stimulus-based) + Free Response Questions (FRQs). "Explain", "Justify", "Calculate", "Describe a pattern". No "Show that" — use "Verify".',
        markSchemeFormat: 'AP rubric scoring. FRQs marked by criteria. 1-9 point scale on some sections. Partial credit awarded.',
        unitConventions: 'Metric for sciences. Standard notation. Significant figures. No ms⁻¹ — use m/s.',
        vocabularyLevel: 'College-level vocabulary. Stimulus materials (graphs, data, passages) required for many questions.',
      };

    if (level.includes("college") || level === "university_18plus" || level.includes("university"))
      return {
        region: "USA", level: "College/University",
        examBoard: "Institution internal",
        questionStyle: 'Problem sets, proofs, analysis. Mix of short answer and extended response. Real-world modelling.',
        markSchemeFormat: 'Rubric-based. Full, partial, or no credit.',
        unitConventions: 'Metric strictly in STEM. MLA/APA citation style for humanities.',
        vocabularyLevel: 'High academic register. Technical precision expected.',
      };
  }

  // ── Germany ──
  if (region === "de" || region.includes("germany") || region.includes("deutschland")) {
    if (level.includes("abitur") || level.includes("gymnasium") || level === "college_16_18")
      return {
        region: "Germany", level: "Abitur",
        examBoard: "KMK / State Kultusministerium",
        questionStyle: 'Structured multi-part questions. "Berechnen Sie", "Erläutern Sie", "Beweisen Sie". Three requirement levels: Grundanforderungen, erhöhte Anforderungen, Spitzenanforderungen.',
        markSchemeFormat: 'Points (Punkte) based. BE (Bewertungseinheiten). Pass mark typically 50%.',
        unitConventions: 'SI units. Comma as decimal separator in German. m/s standard (not ms⁻¹).',
        vocabularyLevel: 'Formal academic German register. Technical Fachsprache expected.',
      };
  }

  // ── International / IB ──
  if (region === "ib" || region.includes("international")) {
    if (level.includes("ib diploma") || level.includes("dp") || level === "college_16_18")
      return {
        region: "International", level: "IB Diploma",
        examBoard: "IBO",
        questionStyle: 'Data-based questions, structured questions, extended response. "To what extent", "Evaluate", "Analyse". Internal Assessment component. Theory of Knowledge links.',
        markSchemeFormat: 'Mark bands for extended response. Specific marking points for structured questions. HL vs SL differentiation.',
        unitConventions: 'SI units. International spellings. Significant figures strictly enforced.',
        vocabularyLevel: 'International academic English. Culturally neutral examples. No UK/US-specific references.',
      };

    if (level.includes("igcse") || level.includes("cambridge") || level === "secondary_14_16")
      return {
        region: "International", level: "Cambridge IGCSE",
        examBoard: "Cambridge Assessment",
        questionStyle: 'Structured questions. "State", "Describe", "Explain", "Calculate". Core and Extended tiers. Data response questions.',
        markSchemeFormat: 'Mark scheme points. Accept alternative correct answers. Own figure rule (ecf).',
        unitConventions: 'SI units. International standard.',
        vocabularyLevel: 'Clear international English. Accessible to non-native speakers.',
      };
  }

  // ── Vocational / Professional ──
  if (level.includes('hnc') || level.includes('hnd')) return {
    region: curriculumRegion || "UK", level: 'HNC/HND',
    examBoard: 'SQA / BTEC',
    questionStyle: 'Vocational and applied questions. Mix of theory and practical application. "Explain how...", "Describe the process of...", "Evaluate the use of...". Unit-based assessment style.',
    markSchemeFormat: 'Criteria-based pass/merit/distinction grading. Evidence of understanding required.',
    unitConventions: 'Industry-standard units and terminology for the subject area.',
    vocabularyLevel: 'Professional and technical language appropriate to the vocational area.',
  };

  if (level.includes('nvq') || level.includes('btec')) return {
    region: curriculumRegion || "UK", level: 'NVQ/BTEC',
    examBoard: 'BTEC / City & Guilds',
    questionStyle: 'Competency and evidence-based questions. Practical scenarios. Portfolio-style evidence prompts.',
    markSchemeFormat: 'Pass/Merit/Distinction criteria. Competency demonstration required.',
    unitConventions: 'Workplace and industry-standard terminology.',
    vocabularyLevel: 'Practical and applied language. Real workplace scenarios.',
  };

  if (level.includes('apprenticeship')) return {
    region: curriculumRegion || "UK", level: 'Apprenticeship',
    examBoard: 'End Point Assessment Organisation',
    questionStyle: 'Scenario-based questions with workplace contexts. "In this situation...", "How would you...". Mix of knowledge and practical application.',
    markSchemeFormat: 'Pass/Distinction criteria. Portfolio evidence approach.',
    unitConventions: 'Industry-standard terminology. Workplace metrics.',
    vocabularyLevel: 'Professional but accessible. Real-world scenarios.',
  };

  if (level.includes('certification') || level.includes('aws') || level.includes('cisco') || level.includes('comptia') || level.includes('cpd')) return {
    region: curriculumRegion || "International", level: 'Professional Certification',
    examBoard: 'Vendor/Industry Body',
    questionStyle: 'Scenario-based multiple choice. "Which of the following best describes...", "In this scenario, what would you do...". High proportion of application questions.',
    markSchemeFormat: 'Single correct answer. No partial credit.',
    unitConventions: 'Industry-standard terminology. Vendor-specific terminology where applicable.',
    vocabularyLevel: 'Professional technical language. Domain-specific jargon expected.',
  };

  if (level.includes('ks3') || level.includes('key stage 3')) return {
    region: curriculumRegion || "UK", level: 'KS3',
    examBoard: 'National Curriculum',
    questionStyle: 'Clear structured questions. Simple command words: State, Describe, Explain. Short answers. Guided scaffolding.',
    markSchemeFormat: 'Points-based. 1-3 marks per question typical.',
    unitConventions: 'SI units. Simple notation.',
    vocabularyLevel: 'Age-appropriate. Key terms defined. Accessible language.',
  };

  // ── Fallback ──
  return {
    region: curriculumRegion || "International",
    level: educationalTier || "General",
    examBoard: "General",
    questionStyle: `Generate questions appropriate for a student studying at ${educationalTier || 'general'} level. Use academic language and question styles typical for this qualification.`,
    markSchemeFormat: 'Points-based marking appropriate to the level.',
    unitConventions: 'Standard units appropriate to the subject.',
    vocabularyLevel: `Language and complexity appropriate for ${educationalTier || 'general'} level study.`,
  };
};

/** Format context for injection into AI system prompts */
export const formatGenerationContextPrompt = (ctx: GenerationContext): string => {
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
};
