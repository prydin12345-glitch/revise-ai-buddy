import {OCR_ALEVEL_BIOLOGY_SPECIFICATION, OCR_ALEVEL_P1_OUTCOMES} from './ocr-alevel-biology-scope.ts';
import {OCR_ALEVEL_P2_OUTCOMES} from './ocr-alevel-biology-paper2-scope.ts';

export const OCR_ALEVEL_P3_SAM_URL = 'https://www.ocr.org.uk/Images/171739-unit-h420-03-unified-biology-sample-assessment-materials.pdf';
export const OCR_ALEVEL_P3_TOPICS = ['Practical skills in biology', 'Foundations in biology', 'Exchange and transport',
  'Biodiversity, evolution and disease', 'Communication, homeostasis and energy', 'Genetics, evolution and ecosystems'] as const;
// Reuse the reviewed scientific summaries, translating only the new paper's
// topic indices. Neither existing outcome pool nor its prompts are mutated.
export const OCR_ALEVEL_P3_OUTCOMES: Record<string, {topic:number; text:string}> = {
  ...Object.fromEntries(Object.entries({...OCR_ALEVEL_P1_OUTCOMES, ...OCR_ALEVEL_P2_OUTCOMES}).map(([ref,o]) =>
    [ref,{topic:Number(ref[0])-1,text:o.text}])),
  '1.1.1':{topic:0,text:'Plan valid investigations; hypotheses, variables, controls, sampling, apparatus and appropriate safety considerations.'},
  '1.1.2':{topic:0,text:'Implement practical procedures and record sufficient measurements with appropriate precision and units.'},
  '1.1.3':{topic:0,text:'Process and interpret data; choose and plot graphs, gradients, calculations and appropriate statistical tests.'},
  '1.1.4':{topic:0,text:'Evaluate reliability, validity, uncertainty, limitations and conclusions; justify improvements to investigations.'},
};
export const OCR_ALEVEL_P3_RULES = `OCR A-LEVEL BIOLOGY A H420/03 Unified biology, specification ${OCR_ALEVEL_BIOLOGY_SPECIFICATION}. Untiered full A-level, Modules 1–6, 70 marks, 90 minutes, all questions compulsory. Not AS H020, Biology B H422 or the separate practical endorsement.
Use structured, problem-solving, calculation, practical and extended responses. There is no Section A/B split or fifteen-MCQ section. The saved parent/part distribution, AO targets and resource/skill allocations are Examly template decisions, not official fixed historical counts. Short practice is an Examly development template. Custom retains the user's manual topics, counts, format and time.
UNIFIED SYNOPTIC DEMAND: each parent is ONE coherent investigation or biological problem linking its specified modules. At least one application/evaluation response in each parent must require a causal link between two content modules, with matching private marking credit. Small subparts need not each span modules. Never generate six isolated module-recall sections or separate Paper 1/Paper 2 blocks. Use unfamiliar but sufficiently explained contexts, conclusions supported by supplied evidence, controls, sampling, uncertainty, validity, reliability and justified improvements.
Every scored part has separate context and a non-empty task containing an assessed instruction. Use precise OCR command words: describe, explain, suggest, calculate, compare, evaluate, justify, plot and determine as appropriate. Each part must be answerable from its OWN visible data; do not rely on another part's hidden tab. If observations are shared, preserve identical values/units across siblings and provide one canonical resource on each part that needs it, not duplicate copies within a part.
Use suitable tables with matching headers/rows/units, continuous numerical-axis graphs where appropriate and only genuinely necessary diagrams. Plotting tasks supply unsolved data tables, never the completed assessed curve. No completed genetic crosses, labels, calculated results, private fields or generic decorative figures in public resources. Keep assessment and review data separate.
Use Level 2-or-higher mathematics in biological contexts: rates/gradients, percentages, magnification, energy/biomass, inheritance and appropriate statistics. The qualification-wide mathematical minimum is not an official Paper 3 per-paper allocation. Provide formulae, sample sizes, raw or summary inputs, critical values, degrees of freedom and significance thresholds whenever needed. State the null hypothesis and decision information for statistical calculation/interpretation tasks; do not reveal the calculated statistic or conclusion. Test selection tasks must not print the selected test as an answer in their givens.
Private keys require capped marking points, method marks, working, units, precision, valid alternatives and stated error-carried-forward. Planned six-mark responses require task-specific Level 1 (1–2), Level 2 (3–4), Level 3 (5–6) science descriptors, indicative content and zero for no relevant response: science selects the level, coherent communication selects the mark within it. No AQA essay choice or 25-mark rubric. Never expose private marking material.
Use existing interactive formats only for suitable short tasks. Extended prose, graph drawing and multi-step calculations with working remain written/drawing responses; never replace reasoning or method credit with recognition-only inputs.`;

/** Conservative direct recall guard; whole-course H420 does not impose the
 * Paper 1/2 exclusions. Scientific correctness still needs external review. */
export function ocrAlevelPaper3ContentIssue(text:string):string|null {
  return /\b(?:describe|explain|outline)\b[^.?!\n]{0,80}\b(?:detailed ornithine cycle|each step of the ornithine cycle)\b/i.test(text)
    ? 'Detailed ornithine-cycle steps are not required by H420. Use the saved A-level outcomes.' : null;
}
