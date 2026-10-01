import { OCR_ALEVEL_BIOLOGY_ID } from './assessment-tier.ts';

export const OCR_ALEVEL_BIOLOGY_SPECIFICATION = 'ocr-h420-v4.1-2026-04';
export const OCR_ALEVEL_SPEC_URL = 'https://www.ocr.org.uk/Images/687834-download-a-level-specification.pdf';
export const OCR_ALEVEL_SAM_URL = 'https://www.ocr.org.uk/Images/171737-unit-h420-01-biological-processes-sample-assessment-materials.pdf';
export const OCR_ALEVEL_P1_TOPICS = [
  'Foundations in biology', 'Exchange and transport', 'Communication, homeostasis and energy',
] as const;

/** Authored summaries of the reviewed H420/01 outcomes; Module 1 skills are
 * embedded throughout. These are an outcome pool, not fixed exam questions. */
export const OCR_ALEVEL_P1_OUTCOMES: Record<string, {topic: number; text: string}> = {
  '2.1.1': {topic:0, text:'Cell ultrastructure, prokaryotes/eukaryotes, light/TEM/SEM microscopy, staining, graticule calibration, magnification and resolution.'},
  '2.1.2': {topic:0, text:'Water and ions; carbohydrate, lipid and protein structures, bonds and functions; biochemical tests and chromatography.'},
  '2.1.3': {topic:0, text:'Nucleotides, DNA/RNA, ATP, semi-conservative replication, the genetic code, transcription and translation.'},
  '2.1.4': {topic:0, text:'Enzyme action, activation energy, induced fit, cofactors/coenzymes, inhibition and investigation of factors affecting rates.'},
  '2.1.5': {topic:0, text:'Fluid mosaic membranes, permeability, diffusion, facilitated diffusion, active transport, osmosis and water potential; quantitative investigations.'},
  '2.1.6': {topic:0, text:'Cell cycle, mitosis and meiosis, differentiation, stem cells and cellular organisation into tissues, organs and systems.'},
  '3.1.1': {topic:1, text:'Exchange surfaces, surface-area-to-volume ratio, mammalian ventilation and gas exchange in fish, insects and plants.'},
  '3.1.2': {topic:1, text:'Heart and cardiac cycle/control, ECG evidence, vessels, haemoglobin, oxygen dissociation/Bohr effect, tissue fluid and lymph.'},
  '3.1.3': {topic:1, text:'Xylem/phloem structure and transport; transpiration, cohesion-tension, translocation and water-uptake investigations.'},
  '5.1.1': {topic:2, text:'Cell communication, homeostasis, feedback, ectotherm/endotherm temperature regulation.'},
  '5.1.2': {topic:2, text:'Excretion; liver, urea formation (not detailed ornithine-cycle steps), kidney/nephron, ultrafiltration, reabsorption, ADH and osmoregulation; kidney treatments and diagnostic urine tests.'},
  '5.1.3': {topic:2, text:'Receptors, sensory/relay/motor neurones, resting/action potentials, myelination, cholinergic synapses and summation.'},
  '5.1.4': {topic:2, text:'Endocrine communication, adrenal glands, pancreas, insulin/glucagon, glucose homeostasis and diabetes.'},
  '5.1.5': {topic:2, text:'Plant hormones and tropisms; nervous-system organisation, brain, reflexes, coordinated responses and skeletal muscle contraction; relevant practical and statistical evidence.'},
  '5.2.1': {topic:2, text:'Chloroplasts and pigments; light-dependent reactions, photophosphorylation, chemiosmosis and carbon fixation in the Calvin cycle; limiting factors and photosynthesis investigations.'},
  '5.2.2': {topic:2, text:'ATP supply, glycolysis, link reaction, Krebs cycle, coenzymes, oxidative phosphorylation, chemiosmosis, anaerobic pathways, respiratory quotient and respirometry.'},
};

export const isOcrAlevelBiology = (scope:{courseId?:string|null}):boolean => scope.courseId === OCR_ALEVEL_BIOLOGY_ID;
export const OCR_ALEVEL_MCQ_RULES = `SINGLE-SELECT MCQ CONTRACT: exactly four distinct, plausible options in one options array, displayed in that fixed order as A, B, C, D. Use descriptive option text, never bare A-D letters (write nucleotide names in full). Do not repeat choices in the stem or a second options table. Exactly ONE choice must be scientifically correct for the stated conditions. Make distractors mutually exclusive and diagnose realistic misconceptions; avoid overlapping numerical ranges, synonymous choices, "all/none of the above", giveaway length and ambiguous wording. Recompute calculations and check every distractor before returning. Vary the correct position naturally; never shuffle options without updating the key. Private correct_answer must exactly equal the correct option text. Keep any working/explanation private and out of the options/resource. Negative tasks must make NOT/INCORRECT conspicuous. For numbered-statement questions provide all three statements in the context and four distinct combinations in options; the task still asks for ONE choice.`;

export const OCR_ALEVEL_P1_RULES = `OCR A-LEVEL BIOLOGY A H420/01 Biological processes, specification ${OCR_ALEVEL_BIOLOGY_SPECIFICATION}. Untiered full A-level; not AS H020, GCSE Gateway J247, Biology B H422 or AQA 7402.
Assess Modules 2, 3 and 5 with Module 1 practical skills. Module 2 includes nucleic acids, protein synthesis, meiosis and stem cells. Module 5 includes neural/endocrine mechanisms, nephron/ADH, plant and animal responses, Calvin/Krebs cycles and chemiosmosis. These are legitimate Paper 1 content: do not import AQA Paper 1 or GCSE exclusions.
Do not require recall of Module 4 disease/immunity, biodiversity/classification/evolution or Module 6 inheritance crosses, gene regulation/technology, cloning/biotechnology, ecosystems/populations. An unfamiliar organism or fully explained application can supply context for an in-scope task; it must not require those excluded mechanisms from memory. Urine pregnancy tests using monoclonal antibodies are allowed under 5.1.2, not general immune-response recall.
Full mock: 100 marks, 135 minutes, all questions compulsory. Section A is Q1–15, fifteen one-mark single-select MCQs assessing AO1/AO2. Section B begins at Q16, totals 85 marks, and combines structured, numerical, practical and extended tasks. Parent/part counts, distribution of MCQ styles and topic weighting below are Examly choices, not official fixed counts. Short practice is a labelled reduced exercise, not the complete official paper.
${OCR_ALEVEL_MCQ_RULES}
Written tasks need separate explicit instructions and sufficient givens/units. Use canonical tables or numerical-axis graphs when planned; never placeholders or decorative/unrelated images. Values, task and private working must agree. Continuous measurements use a line/scatter representation, not categorical bars. Keep offspring, fitted results and other assessed answers out of resources.
Use Level 2-or-above maths in biological contexts, including magnification, rates, percentages, RQ, Q10, graph gradients and appropriate statistics. OCR permits standard-deviation calculation: provide the required formula/inputs, sample size and precision. Supply unfamiliar formulae, statistical tables and enough information to use them. Module 1 investigations assess design, controls, repeats, uncertainty and evaluation. This mock cannot award the separate practical endorsement.
For planned six-mark extended responses provide private task-specific Level 1 (1–2), Level 2 (3–4), Level 3 (5–6) science descriptors, indicative content and zero for no relevant response. Determine the level by scientific content/best fit, then the mark within it by communication and a coherent line of reasoning. Other written parts use capped points and acceptable alternatives. Do not import AQA's point-only extended-response rule or its 25-mark essay. Never expose keys, levels or worked answers in student-facing text.`;

/** Conservative direct-task flags, not a claim of complete syllabus checking.
 * Do not reject legitimate distractors, unfamiliar givens or Module 2 meiosis. */
export function ocrAlevelPaper1ContentIssue(text:string):string|null {
  const task = text.match(/\b(?:explain|describe|outline|calculate|state|compare|evaluate)\b[^.?!\n]{0,100}\b(?:Hardy[-– ]Weinberg|genetic drift|allopatric speciation|lac operon|polymerase chain reaction|PCR amplification|primary immune response|secondary immune response|antibody production by B[ -]?(?:cells|lymphocytes)|nitrogen cycle|succession of (?:a|an) ecosystem)\b/i);
  return task ? 'OCR H420/01 task requires Module 4/6 recall outside Modules 1, 2, 3 and 5. Rewrite the complete task and key using its planned outcomes.' : null;
}
