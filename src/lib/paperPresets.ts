/**
 * Paper blueprint presets — real board paper architectures, one tap to load.
 *
 * Accuracy policy: presets named after an exact paper (e.g. "AQA English
 * Language Paper 1") encode the official structure. Presets suffixed
 * "-style" are representative ramps for papers whose tariffs vary between
 * series — right shape and totals, not a claim of exact question-by-question
 * fidelity. Wrong-but-confident is worse than approximate-and-honest.
 */

export interface PresetSection {
  title: string;
  questions: Array<{ marks: number; style: string }>;
  answerCount?: number;
}
export interface PaperPreset {
  id: string;
  label: string;
  subjects: RegExp;
  levels: RegExp;
  boards: RegExp;
  sections: PresetSection[];
}

const GCSE = /gcse|igcse|level[\s_]*2|foundation|higher|ks[\s_]?4|myp|year[\s_]*1[01]/i;
const ALEVEL = /a[-\s_]?level|level[\s_]*3|\bas\b|\ba2\b|\bib\b|year[\s_]*1[23]|sixth/i;
const ANY = /./;

const essay = "Extended judgement essay";
const explain = "Explain / describe";
const dataq = "Analyse data / calculation";

export const BLUEPRINT_PRESETS: PaperPreset[] = [
  // ═══ ENGLISH LANGUAGE ═══
  { id: "aqa_lang_p1", label: "AQA English Language Paper 1", subjects: /english|language/i, levels: GCSE, boards: /aqa/i,
    sections: [
      { title: "Section A: Reading", questions: [
        { marks: 4, style: "List / identify from the text" },
        { marks: 8, style: "Language analysis" },
        { marks: 8, style: "Structure analysis" },
        { marks: 20, style: "Evaluate a statement" } ] },
      { title: "Section B: Writing", answerCount: 1, questions: [
        { marks: 40, style: "Descriptive writing task" },
        { marks: 40, style: "Narrative writing task" } ] } ] },
  { id: "aqa_lang_p2", label: "AQA English Language Paper 2", subjects: /english|language/i, levels: GCSE, boards: /aqa/i,
    sections: [
      { title: "Section A: Reading", questions: [
        { marks: 4, style: "Identify true statements" },
        { marks: 8, style: "Summarise differences between two texts" },
        { marks: 12, style: "Language analysis" },
        { marks: 16, style: "Compare writers' viewpoints and methods" } ] },
      { title: "Section B: Writing", questions: [
        { marks: 40, style: "Viewpoint writing task" } ] } ] },
  { id: "edexcel_lang_p1", label: "Edexcel English Language Paper 1", subjects: /english|language/i, levels: GCSE, boards: /edexcel|pearson/i,
    sections: [
      { title: "Section A: Reading", questions: [
        { marks: 1, style: "List / identify from the text" },
        { marks: 2, style: "List / identify from the text" },
        { marks: 6, style: "Language analysis" },
        { marks: 15, style: "Evaluate a statement" } ] },
      { title: "Section B: Writing", answerCount: 1, questions: [
        { marks: 40, style: "Imaginative writing task" },
        { marks: 40, style: "Imaginative writing task" } ] } ] },
  { id: "eduqas_lang_c1", label: "Eduqas English Language Component 1", subjects: /english|language/i, levels: GCSE, boards: /eduqas|wjec/i,
    sections: [
      { title: "Section A: Reading", questions: [
        { marks: 5, style: "List / identify from the text" },
        { marks: 5, style: explain },
        { marks: 10, style: "Language analysis" },
        { marks: 10, style: "Evaluate a statement" } ] },
      { title: "Section B: Writing", answerCount: 1, questions: [
        { marks: 40, style: "Narrative writing task" },
        { marks: 40, style: "Narrative writing task" } ] } ] },
  { id: "ocr_lang_gcse", label: "OCR English Language-style paper (GCSE)", subjects: /english|language/i, levels: GCSE, boards: /ocr/i,
    sections: [
      { title: "Section A: Reading", questions: [
        { marks: 4, style: "List / identify from the text" },
        { marks: 6, style: "Language analysis" },
        { marks: 6, style: "Compare" },
        { marks: 12, style: "Evaluate a statement" } ] },
      { title: "Section B: Writing", answerCount: 1, questions: [
        { marks: 40, style: "Extended writing task" },
        { marks: 40, style: "Extended writing task" } ] } ] },

  // ═══ ENGLISH LITERATURE ═══
  { id: "aqa_lit_gcse_p1", label: "AQA English Literature Paper 1 (GCSE)", subjects: /english|literature/i, levels: GCSE, boards: /aqa/i,
    sections: [
      { title: "Section A: Shakespeare", questions: [
        { marks: 34, style: "Passage-based essay on the studied Shakespeare play (30 + 4 SPaG)" } ] },
      { title: "Section B: The 19th-century novel", questions: [
        { marks: 30, style: "Passage-based essay on the studied 19th-century novel" } ] } ] },
  { id: "aqa_lit_gcse_p2", label: "AQA English Literature Paper 2 (GCSE)", subjects: /english|literature/i, levels: GCSE, boards: /aqa/i,
    sections: [
      { title: "Section A: Modern texts", questions: [
        { marks: 34, style: "Essay on the studied modern text (30 + 4 SPaG)" } ] },
      { title: "Section B: Poetry anthology", questions: [
        { marks: 30, style: "Compare a named anthology poem with one other" } ] },
      { title: "Section C: Unseen poetry", questions: [
        { marks: 24, style: "Essay on an unseen poem" },
        { marks: 8, style: "Compare the unseen poem with a second unseen poem" } ] } ] },
  { id: "edexcel_lit_gcse_p1", label: "Edexcel English Literature-style Paper 1 (GCSE)", subjects: /english|literature/i, levels: GCSE, boards: /edexcel|pearson/i,
    sections: [
      { title: "Section A: Shakespeare", questions: [
        { marks: 20, style: "Passage-based question on the studied Shakespeare play" },
        { marks: 20, style: "Essay on the play as a whole" } ] },
      { title: "Section B: Post-1914 literature", questions: [
        { marks: 40, style: "Essay on the studied post-1914 text" } ] } ] },
  { id: "aqa_lit_p1", label: "AQA English Literature A-level Paper 1", subjects: /english|literature/i, levels: ALEVEL, boards: /aqa/i,
    sections: [
      { title: "Section A: Shakespeare", questions: [ { marks: 25, style: "Passage-based question with linked essay" } ] },
      { title: "Section B: Unseen poetry", questions: [ { marks: 25, style: "Essay on two unseen poems" } ] },
      { title: "Section C: Comparing texts", questions: [ { marks: 25, style: "Essay comparing two studied texts" } ] } ] },

  // ═══ MATHS ═══
  { id: "gcse_maths_style", label: "GCSE Maths-style paper (all boards)", subjects: /math/i, levels: GCSE, boards: ANY,
    sections: [
      { title: "Answer all questions", questions: [
        1,1,2,2,2,3,3,3,3,3,4,4,4,4,4,5,5,5,5,6,6,6,
      ].map((m, i) => ({ marks: m, style: m <= 2 ? "Short calculation" : m <= 4 ? "Multi-step calculation" : "Problem solving / reasoning" })) } ] },
  { id: "alevel_maths_style", label: "A-level Maths-style paper (all boards)", subjects: /math/i, levels: ALEVEL, boards: ANY,
    sections: [
      { title: "Answer all questions", questions: [
        4,4,5,6,7,8,9,10,11,12,12,12,
      ].map((m) => ({ marks: m, style: m <= 6 ? "Multi-step calculation" : "Extended problem solving with proof or modelling" })) } ] },

  // ═══ SCIENCES ═══
  { id: "gcse_science_style", label: "GCSE Science-style paper (all boards)", subjects: /biolog|chemist|physic|science/i, levels: GCSE, boards: ANY,
    sections: [
      { title: "Answer all questions", questions: [
        { marks: 4, style: explain }, { marks: 5, style: dataq }, { marks: 4, style: explain },
        { marks: 6, style: "Required practical: method and analysis" }, { marks: 5, style: dataq },
        { marks: 6, style: explain }, { marks: 4, style: dataq }, { marks: 6, style: "Extended response (levels-marked)" },
        { marks: 5, style: explain }, { marks: 6, style: dataq }, { marks: 4, style: explain },
        { marks: 6, style: "Extended response (levels-marked)" }, { marks: 5, style: dataq }, { marks: 4, style: explain } ] } ] },
  { id: "aqa_alevel_physics_p1", label: "AQA A-level Physics Paper 1", subjects: /physic/i, levels: ALEVEL, boards: /aqa/i,
    sections: [
      { title: "Section A: Structured questions", questions: [
        { marks: 10, style: "Multi-part structured question with calculation" },
        { marks: 11, style: "Multi-part structured question with practical analysis" },
        { marks: 12, style: "Multi-part structured question with calculation" },
        { marks: 13, style: "Multi-part structured question incl. 6-mark extended response" },
        { marks: 14, style: "Multi-part structured question with data analysis" } ] },
      { title: "Section B: Multiple choice", questions: Array.from({ length: 25 }, () => ({ marks: 1, style: "Multiple choice" })) } ] },

  // ═══ GEOGRAPHY ═══
  { id: "aqa_geog_p1", label: "AQA A-level Geography Paper 1 (Physical)", subjects: /geograph/i, levels: ALEVEL, boards: /aqa/i,
    sections: [
      { title: "Section A: Water and carbon cycles", questions: [
        { marks: 4, style: explain }, { marks: 6, style: dataq }, { marks: 6, style: "Evaluate a statement" }, { marks: 20, style: essay } ] },
      { title: "Section B: Landscape systems", questions: [
        { marks: 4, style: explain }, { marks: 6, style: dataq }, { marks: 6, style: "Evaluate a statement" }, { marks: 20, style: essay } ] },
      { title: "Section C: Hazards or ecosystems", questions: [
        { marks: 4, style: explain }, { marks: 6, style: dataq }, { marks: 9, style: "Evaluate a statement" }, { marks: 9, style: "Evaluate a statement" }, { marks: 20, style: essay } ] } ] },
  { id: "aqa_geog_p2", label: "AQA A-level Geography Paper 2 (Human)", subjects: /geograph/i, levels: ALEVEL, boards: /aqa/i,
    sections: [
      { title: "Section A: Global systems and governance", questions: [
        { marks: 4, style: explain }, { marks: 6, style: dataq }, { marks: 6, style: "Evaluate a statement" }, { marks: 20, style: essay } ] },
      { title: "Section B: Changing places", questions: [
        { marks: 4, style: explain }, { marks: 6, style: dataq }, { marks: 6, style: "Evaluate a statement" }, { marks: 20, style: essay } ] },
      { title: "Section C: Optional unit", questions: [
        { marks: 4, style: explain }, { marks: 6, style: dataq }, { marks: 9, style: "Evaluate a statement" }, { marks: 9, style: "Evaluate a statement" }, { marks: 20, style: essay } ] } ] },
  { id: "aqa_geog_gcse_style", label: "AQA GCSE Geography-style paper", subjects: /geograph/i, levels: GCSE, boards: /aqa/i,
    sections: [
      { title: "Section A", questions: [
        { marks: 1, style: "Identify from a figure" }, { marks: 2, style: dataq }, { marks: 2, style: explain },
        { marks: 4, style: explain }, { marks: 6, style: "Evaluate using a figure and own knowledge" }, { marks: 9, style: "Extended response with case study" } ] },
      { title: "Section B", questions: [
        { marks: 1, style: "Identify from a figure" }, { marks: 2, style: dataq }, { marks: 2, style: explain },
        { marks: 4, style: explain }, { marks: 6, style: "Evaluate using a figure and own knowledge" }, { marks: 9, style: "Extended response with case study" } ] },
      { title: "Section C", questions: [
        { marks: 1, style: "Identify from a figure" }, { marks: 2, style: dataq }, { marks: 4, style: explain },
        { marks: 6, style: "Evaluate using a figure and own knowledge" }, { marks: 9, style: "Extended response with case study (+3 SPaG)" } ] } ] },

  // ═══ HISTORY ═══
  { id: "gcse_hist_interp", label: "GCSE History — interpretations paper (AQA-style)", subjects: /history/i, levels: GCSE, boards: /aqa/i,
    sections: [
      { title: "Section A: Interpretations", questions: [
        { marks: 4, style: "How do the interpretations differ" },
        { marks: 4, style: "Why might the interpretations differ" },
        { marks: 8, style: "How far do you agree with an interpretation" } ] },
      { title: "Section B: Period study", questions: [
        { marks: 4, style: "Describe / outline" },
        { marks: 8, style: explain },
        { marks: 12, style: essay } ] } ] },
  { id: "gcse_hist_sources", label: "GCSE History — source skills paper (Edexcel-style)", subjects: /history/i, levels: GCSE, boards: /edexcel|pearson/i,
    sections: [
      { title: "Section A: Source skills", questions: [
        { marks: 4, style: "Inference from a source" },
        { marks: 8, style: "How useful is the source" },
        { marks: 12, style: "Explain why (causation)" } ] },
      { title: "Section B: Depth study", questions: [
        { marks: 4, style: "Describe / outline" },
        { marks: 16, style: essay } ] } ] },
  { id: "alevel_hist_essay", label: "A-level History — interpretations & essays (AQA-style)", subjects: /history/i, levels: ALEVEL, boards: /aqa/i,
    sections: [
      { title: "Section A: Interpretations", questions: [
        { marks: 30, style: "Evaluate the three interpretations" } ] },
      { title: "Section B: Essays", answerCount: 2, questions: [
        { marks: 25, style: essay }, { marks: 25, style: essay }, { marks: 25, style: essay } ] } ] },
  { id: "edexcel_alevel_hist_p1", label: "Edexcel A-level History Paper 1", subjects: /history/i, levels: ALEVEL, boards: /edexcel|pearson/i,
    sections: [
      { title: "Section A", answerCount: 1, questions: [
        { marks: 20, style: essay }, { marks: 20, style: essay } ] },
      { title: "Section B", answerCount: 1, questions: [
        { marks: 20, style: essay }, { marks: 20, style: essay } ] },
      { title: "Section C: Interpretations", questions: [
        { marks: 20, style: "How far do you agree with an interpretation" } ] } ] },

  // ═══ PSYCHOLOGY ═══
  { id: "aqa_psych_p1_style", label: "AQA A-level Psychology-style Paper 1", subjects: /psycholog/i, levels: ALEVEL, boards: /aqa/i,
    sections: [
      { title: "Section A: Social influence", questions: [
        { marks: 2, style: explain }, { marks: 2, style: "Apply knowledge to a scenario" }, { marks: 4, style: "Apply knowledge to a scenario" }, { marks: 16, style: "Discuss (essay with AO3 evaluation)" } ] },
      { title: "Section B: Memory", questions: [
        { marks: 2, style: explain }, { marks: 2, style: "Apply knowledge to a scenario" }, { marks: 4, style: dataq }, { marks: 16, style: "Discuss (essay with AO3 evaluation)" } ] },
      { title: "Section C: Attachment", questions: [
        { marks: 2, style: explain }, { marks: 2, style: "Apply knowledge to a scenario" }, { marks: 4, style: "Apply knowledge to a scenario" }, { marks: 16, style: "Discuss (essay with AO3 evaluation)" } ] },
      { title: "Section D: Psychopathology", questions: [
        { marks: 2, style: explain }, { marks: 2, style: "Apply knowledge to a scenario" }, { marks: 4, style: "Apply knowledge to a scenario" }, { marks: 16, style: "Discuss (essay with AO3 evaluation)" } ] } ] },

  // ═══ SOCIOLOGY ═══
  { id: "aqa_soc_p1_style", label: "AQA A-level Sociology-style Paper 1", subjects: /sociolog/i, levels: ALEVEL, boards: /aqa/i,
    sections: [
      { title: "Education", questions: [
        { marks: 4, style: "Outline two ways/reasons" },
        { marks: 6, style: "Outline three ways/reasons" },
        { marks: 10, style: "Applying an item, analyse two ways" },
        { marks: 30, style: "Applying an item, evaluate (essay)" } ] },
      { title: "Methods in context & theory", questions: [
        { marks: 20, style: "Evaluate a research method for studying an education issue" },
        { marks: 10, style: "Outline and explain two theoretical points" } ] } ] },

  // ═══ RELIGIOUS STUDIES ═══
  { id: "aqa_rs_gcse", label: "AQA GCSE Religious Studies paper (themes ladder)", subjects: /religio/i, levels: GCSE, boards: /aqa/i,
    sections: ["Theme 1", "Theme 2", "Theme 3", "Theme 4"].map((t) => ({
      title: t,
      questions: [
        { marks: 1, style: "Multiple choice / one-word definition" },
        { marks: 2, style: "Give two examples/beliefs" },
        { marks: 4, style: "Explain two contrasting beliefs" },
        { marks: 5, style: "Explain two beliefs with reference to scripture" },
        { marks: 12, style: "Evaluate a statement with religious arguments both ways" } ] })) },

  // ═══ ECONOMICS & BUSINESS ═══
  { id: "alevel_econ_style", label: "A-level Economics-style paper (data response + essays)", subjects: /econom/i, levels: ALEVEL, boards: ANY,
    sections: [
      { title: "Section A: Data response", questions: [
        { marks: 2, style: dataq }, { marks: 4, style: dataq }, { marks: 6, style: "Explain with a diagram" },
        { marks: 8, style: "Analyse using the data" }, { marks: 15, style: "Evaluate using the data and own knowledge" } ] },
      { title: "Section B: Essays", answerCount: 1, questions: [
        { marks: 25, style: essay }, { marks: 25, style: essay } ] } ] },
  { id: "alevel_business_style", label: "A-level Business-style paper (data response + essays)", subjects: /business/i, levels: ALEVEL, boards: ANY,
    sections: [
      { title: "Section A: Data response", questions: [
        { marks: 4, style: dataq }, { marks: 6, style: explain },
        { marks: 10, style: "Analyse using the case material" }, { marks: 15, style: "Evaluate using the case material" } ] },
      { title: "Section B: Essays", answerCount: 1, questions: [
        { marks: 25, style: essay }, { marks: 25, style: essay } ] } ] },

  { id: "alevel_lit_style", label: "A-level English Literature-style paper (all boards)", subjects: /english|literature/i, levels: ALEVEL, boards: ANY,
    sections: [
      { title: "Section A: Studied text", questions: [
        { marks: 25, style: "Passage-based question with linked essay" } ] },
      { title: "Section B: Second studied text", questions: [
        { marks: 25, style: "Essay on a studied text" } ] },
      { title: "Section C: Comparison or unseen", questions: [
        { marks: 25, style: "Essay comparing two studied texts" } ] } ] },
  { id: "alevel_lang_style", label: "A-level English Language-style paper (all boards)", subjects: /english|language/i, levels: ALEVEL, boards: ANY,
    sections: [
      { title: "Section A: Textual analysis", questions: [
        { marks: 25, style: "Analyse how language is used in the provided data texts" } ] },
      { title: "Section B: Language discussion", questions: [
        { marks: 25, style: "Discursive essay evaluating a view about language" } ] } ] },

  // ═══ UNIVERSAL FLOOR ═══
  { id: "universal_mixed", label: "Standard mixed paper (short answers building to extended)", subjects: ANY, levels: ANY, boards: ANY,
    sections: [
      { title: "Section A", questions: [
        { marks: 2, style: "List / identify from the text" },
        { marks: 3, style: explain },
        { marks: 4, style: explain },
        { marks: 6, style: "Compare" } ] },
      { title: "Section B", questions: [
        { marks: 9, style: essay } ] } ] },
];
