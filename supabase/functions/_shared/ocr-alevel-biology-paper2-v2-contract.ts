import { OCR_ALEVEL_P2, buildOcrAlevelPaper2Plan, assertOcrAlevelPaper2Plan, ocrAlevelPaper2PartInstruction } from './ocr-alevel-biology-paper2-contract.ts';
import { OCR_ALEVEL_P2_OUTCOMES, OCR_ALEVEL_P2_TOPICS, OCR_ALEVEL_P2_RULES } from './ocr-alevel-biology-paper2-scope.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';

export const OCR_ALEVEL_P2_V2 = { ...OCR_ALEVEL_P2, contractVersion: 2 } as const;
export const OCR_ALEVEL_P2_V2_RULES = `${OCR_ALEVEL_P2_RULES}
BIOLOGICAL DIVERSITY BALANCE: This version is an Examly design choice, not an official module weighting. Prioritise Modules 4/6 ecology, biodiversity, classification, evolution, disease, inheritance and biotechnology. Module 2 is valid Paper 2 content: integrate foundations with these applications rather than repeating standalone DNA replication, generic enzyme kinetics or membrane transport groups. Plant transport is Module 3 and must not replace Paper 2 recall. Follow each narrower planned focus; do not repeatedly select the same subtopic from a broad outcome pool.
STATEMENT-COMBINATION MCQs: Put all three complete, distinct numbered propositions (1, 2, 3) in student-visible context BEFORE the task. Combination choices alone are insufficient. Privately evaluate every proposition and every choice; exactly one choice must be true. Never print truth flags, worked solutions or the key. Ordinary MCQs may use Which/Select; use authentic OCR command words, including Describe, Explain, Suggest and Calculate, for new written tasks. Resources must give the evidence actually required by the selected task.`;

const fullRefs: Record<string, string[]> = {
  '2':['4.1.1'], '3':['6.1.2'], '4':['6.2.1'], '5':['4.1.1'],
  '16':['4.2.1'], '17':['4.1.1'], '18':['2.1.2'],
};
const fullFocus: Record<string, string> = {
  '1':'Microscopy calibration and units: retain a concise quantitative foundation item.',
  '2':'Plant disease or plant defences: physical barriers or induced chemical responses, not biochemical-test recall.',
  '3':'Variation, selection, speciation or population genetics, not DNA replication mechanisms.',
  '4':'Industrial biotechnology: interpret fermentation yield or productivity data; not generic enzyme temperature kinetics.',
  '5':'Three numbered propositions about plant disease, transmission or defences. Do not assess plant transport mechanisms.',
  '6':'Meiosis and genetic variation in reproduction; not a standalone mitotic phase identification.',
  '7':'Specific immune responses, vaccination or disease prevention with unambiguous mechanisms.',
  '8':'Interpret ecological sampling, species diversity or conservation evidence.',
  '9':'Classification, phylogeny or evidence for evolution; practical evaluation of valid comparative evidence where appropriate.',
  '10':'Gene regulation or gene expression in a defined genetic context.',
  '11':'Inheritance or Hardy-Weinberg population genetics with all necessary numerical evidence.',
  '12':'Gene technology or DNA profiling in a biological application.',
  '13':'Three numbered propositions about batch versus continuous fermentation, with feed/removal and contamination control clearly specified.',
  '14':'Nitrogen cycling, carbon cycling or ecosystem energy transfer, within the reviewed outcomes.',
  '15':'Population estimation or population dynamics with sufficient quantitative givens.',
  '16':'Representative ecological sampling and species richness/evenness, including Simpson\'s Index of Diversity or meaningful sampling calculations and practical evaluation. Provide formula/data if needed.',
  '17':'Disease and immunity, including plant pathogen defences or immune-response evidence; keep one coherent investigation across siblings.',
  '18':'Module 2 biological molecules applied to disease/immunity: protein structure, antibody/antigen specificity and relevant molecular evidence. Avoid a generic enzyme kinetics, DNA replication or membrane-transport group. Quantitative evidence must support the task.',
  '19':'Industrial biotechnology, microbial culture, batch/continuous fermentation, micropropagation or immobilised enzymes. Enzymes in biotechnology are legitimate Module 6 content; keep a coherent application.',
  '20':'Gene regulation, mutation, inheritance or genetic technology, with genetic evidence and precise causal explanations.',
  '21':'Conservation, biodiversity and evolutionary/classification evidence. Ex situ must involve conservation outside natural habitats (for example a seed bank or botanical garden); woodland-to-woodland translocation is not automatically ex situ.',
  '22':'Ecosystems, nutrient cycles, succession, population dynamics or sustainability, with ecological data and justified practical evaluation.',
};
const shortFocus: Record<string,string> = {
  '1':fullFocus['1'], '2':fullFocus['4'], '3':fullFocus['8'], '4':fullFocus['13'], '5':fullFocus['14'],
  '6':fullFocus['16'], '7':'Succession, competition or nutrient cycling with meaningful ecological data and a six-mark explanation.',
};

export function buildOcrAlevelPaper2V2Plan(mode: PaperMode, tier: PaperPlan['tier']): PaperPlan | null {
  const previous = buildOcrAlevelPaper2Plan(mode, tier);
  if (!previous) return null;
  const plan: PaperPlan = { ...previous, contractVersion: 2, parts: previous.parts.map(part => {
    const parent = part.questionNumber.match(/^\d+/)![0];
    const refs = mode === 'full_mock' ? fullRefs[parent] : ({'2':['6.2.1'],'6':['4.2.1']} as Record<string,string[]>)[parent];
    const prefix = mode === 'short_practice' ? '_p2_v2_short_' : '_p2_v2_';
    return { ...part, partId: part.partId.replace('_p2_', prefix),
      ...(part.resourceId ? {resourceId: part.resourceId.replace('_p2_', prefix)} : {}),
      ...(refs ? { specRefs: [...refs], topic: OCR_ALEVEL_P2_TOPICS[OCR_ALEVEL_P2_OUTCOMES[refs[0]].topic] } : {}) };
  }) };
  assertOcrAlevelPaper2V2Plan(plan);
  return plan;
}

export function assertOcrAlevelPaper2V2Plan(plan: PaperPlan): void {
  if (plan.contractVersion !== 2) throw new Error('Invalid OCR Paper 2 v2 identity.');
  // Reuse the unchanged totals, AO, skill, response and scope invariants. The
  // version is checked above; v1 plans themselves remain byte-for-byte stable.
  assertOcrAlevelPaper2Plan({ ...plan, contractVersion: 1 });
  const moduleMarks = [2,4,6].map(module => plan.parts.reduce((sum,p) => sum + (p.specRefs?.[0].startsWith(`${module}.`) ? p.marks : 0), 0));
  const expected = plan.mode === 'full_mock' ? '14/41/45' : '1/10/14';
  if (moduleMarks.join('/') !== expected) throw new Error('Invalid OCR Paper 2 v2 module balance.');
}

export function ocrAlevelPaper2V2PartInstruction(part: PlannedPart, includeOptions = true, mode: PaperMode = part.partId.includes('_v2_short_') ? 'short_practice' : 'full_mock'): string {
  const parent = part.questionNumber.match(/^\d+/)![0];
  const focus = (mode === 'short_practice' ? shortFocus : fullFocus)[parent];
  return `${ocrAlevelPaper2PartInstruction(part, includeOptions)} FOCUSED APPLICATION: ${focus}`;
}
export function ocrAlevelPaper2V2Instructions(plan: PaperPlan): string {
  return `${OCR_ALEVEL_P2_V2_RULES}\nSAVED H420/02 v2; ${plan.mode}; ${plan.totalMarks} marks, ${plan.durationMinutes} minutes. Return exactly the planned scored rows with separately stated context and task and private correct_answer.\n` + plan.parts.map(p => ocrAlevelPaper2V2PartInstruction(p,true,plan.mode)).join('\n');
}
