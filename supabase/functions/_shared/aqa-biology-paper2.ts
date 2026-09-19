import { canonicalCourseId } from './assessment-tier.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';

// AQA 8461, checked 19 September 2026. Section references below identify
// outcomes, not copied questions. Layout/mark allocations are Examly choices.
export const AQA_BIOLOGY_P2 = {
  courseId: 'aqa_gcse_biology_8461', paperId: 'paper_2', contractVersion: 1,
  displayName: 'AQA GCSE Biology (8461) Paper 2', fullMockMarks: 100, fullMockMinutes: 105,
  topics: ['Homeostasis and response', 'Inheritance, variation and evolution', 'Ecology'],
} as const;

export const aqaPaper2Component = (tier: PaperPlan['tier']): string | null =>
  tier === 'foundation' ? '8461/2F' : tier === 'higher' ? '8461/2H' : null;









// Suffixes distinguish tier-specific outcomes within the same specification
// section. Basic insulin, individual reproductive hormones, eye accommodation,
// biomass efficiency and the three-base code are NOT Higher-only in AQA.
export const AQA_P2_OUTCOMES: Record<string, string> = {
  '4.5.1': 'Homeostasis: receptors, coordination centres, effectors and stable internal conditions.',
  '4.5.2.1': 'Reflex arcs and reaction time; required practical 7, repeat readings and fair comparison.',
  '4.5.2.2': 'Functions of the main brain regions; no research or treatment mechanisms at Foundation.',
  '4.5.2.3': 'Eye structures, accommodation and correcting short/long sight.',
  '4.5.2.4': 'Temperature regulation: identify sweating, shivering and vessel changes.',
  '4.5.3.2': 'Blood glucose, insulin, glycogen, and differences between types 1 and 2 diabetes.',
  '4.5.3.2-HT': 'Insulin/glucagon negative feedback controlling blood glucose (Higher only).',
  '4.5.3.3': 'Water balance, kidney filtration/reabsorption, urine, dialysis and transplants; no nephron anatomy.',
  '4.5.3.3-HT': 'ADH, water reabsorption and feedback; amino acid deamination and urea (Higher only).',
  '4.5.3.4': 'Individual roles of FSH, LH, oestrogen and progesterone; no interaction graphs at Foundation.',
  '4.5.3.4-HT': 'Interactions between menstrual hormones and their graphs (Higher only).',
  '4.5.3.5': 'Compare hormonal and non-hormonal contraception using supplied evidence.',
  '4.5.3.6-HT': 'Fertility hormones and IVF, benefits and limitations (Higher only).',
  '4.5.3.7-HT': 'Adrenaline and thyroxine; thyroxine negative feedback (Higher only).',
  '4.5.4.1': 'Auxin and growth responses to light/gravity; required practical 8 with seedling lengths.',
  '4.5.4.2-HT': 'Agricultural uses of auxin, ethene and gibberellins (Higher only).',
  '4.6.1.1': 'Sexual/asexual reproduction, gametes and fertilisation.',
  '4.6.1.2': 'Meiosis halves chromosome number; fertilisation restores it. No named meiotic stages.',
  '4.6.1.3': 'Compare benefits and drawbacks of sexual/asexual reproduction in a given situation.',
  '4.6.1.4': 'DNA, genes, chromosomes, genome and uses of genome research.',
  '4.6.1.5': 'Nucleotides and three bases coding for an amino acid; no protein-synthesis mechanism at Foundation.',
  '4.6.1.5-HT': 'Complementary bases, simple protein synthesis and coding/noncoding variants (Higher only); no detailed mRNA/tRNA account.',
  '4.6.1.6': 'Alleles, genotype, phenotype and inheritance; Foundation interprets a PROVIDED cross and completes supplied Punnett grids.',
  '4.6.1.6-HT': 'Construct a single-gene cross and predict offspring probabilities (Higher only).',
  '4.6.1.7': 'Dominant/recessive inherited disorders using a supplied family context.',
  '4.6.1.8': 'XX/XY sex determination and a genetic cross (both tiers).',
  '4.6.2.1': 'Genetic/environmental variation and mutations; interpret supplied population data.',
  '4.6.2.2': 'Natural selection of inherited variants over generations; species and fertile offspring.',
  '4.6.2.3': 'Selective breeding, desired characteristics and inbreeding risks.',
  '4.6.2.4': 'What genetic engineering achieves, benefits/risks; Foundation does not recall vector/enzyme steps.',
  '4.6.2.4-HT': 'Enzymes and plasmid/virus vectors in genetic engineering (Higher only).',
  '4.6.2.5': 'Plant tissue culture/cuttings, embryo splitting and adult-cell cloning.',
  '4.6.3': 'Darwin/Wallace, speciation, Mendel, fossils, extinction and antibiotic resistance as evolution.',
  '4.6.4': 'Classification, binomial names, three domains and interpretation of supplied evolutionary relationships.',
  '4.7.1': 'Interdependence, competition, adaptations and biotic/abiotic factors.',
  '4.7.2.1': 'Required practical 9: quadrats/transects, representative samples, means and population estimates.',
  '4.7.2.2': 'Carbon/water cycles and decomposers; nitrogen cycle is not required.',
  '4.7.2.3': 'Decay factors and required practical 10: temperature and milk decay measured by pH; rates and controls.',
  '4.7.2.4-HT': 'Evaluate environmental change and species distribution (Higher only).',
  '4.7.3': 'Human impacts on biodiversity, waste, land use, deforestation, warming and conservation.',
  '4.7.4': 'Trophic levels, biomass pyramids, losses and percentage transfer efficiency (both tiers).',
  '4.7.5': 'Food security, farming, sustainable fisheries and biotechnology including mycoprotein.',
};

export const AQA_P2_RULES = `AQA 8461 PAPER 2 ONLY: Homeostasis and response; Inheritance, variation and evolution; Ecology (sections 4.5–4.7).
Write original GCSE questions, not copied exam questions. Do not generate standalone Paper 1 microscopy, digestion, infection/immunity or photosynthesis questions. Shared cell/transport/respiration knowledge may support a genuine Paper 2 task; antibiotic resistance as evolution and carbon cycling are allowed.
No A-level pathways, Hardy-Weinberg, chi-squared, detailed nephron anatomy, nitrogen cycle or detailed meiotic stages. Every scored row has separate context and task fields with an explicit assessed instruction and a matching private correct_answer.
Every planned table/graph must contain real, consistent values, labels and units. Keep one canonical chart_data payload; never add a second markdown table or invent replacement values. Use numeric x values and a line for sampled continuous measurements. Categorical comparisons may use bars. No bracketed figure placeholders.
Foundation: accessible wording and explicit calculation steps. Do not require glucagon/ADH feedback, deamination, menstrual-hormone interactions/graphs, fertility-hormone/IVF treatment, thyroxine/adrenaline feedback, gibberellins/ethene or commercial hormone uses, protein-synthesis mechanisms, coding/noncoding mutation mechanisms, constructing an unprovided monohybrid cross, genetic-engineering vector/enzyme steps, brain investigation/treatment mechanisms or HT environmental-change/distribution analysis. Completing a supplied Punnett grid, XX/XY crosses, individual FSH/LH roles, auxin tropisms, eye accommodation, cloning and biomass efficiency remain allowed.
Higher: assess permitted Higher outcomes in the selected slots, using GCSE depth. Difficulty cannot change the saved tier. Do not put prohibited concepts into the private key as optional credit or exclusion notes. Required practicals for Paper 2 are reaction time (7), seedlings (8), population sampling (9) and decay (10).`;

function part(group: number, letter: string, topic: number, marks: number, demand: PlannedPart['demand'], refs: string[],
  resource: PlannedPart['resource'] = 'none', mathsMarks = 0, practicalMarks = 0): PlannedPart {
  return { partId: `aqa2_${group}${letter}`, parentId: `q${group}`, questionNumber: `${group}(${letter})`,
    topic: AQA_BIOLOGY_P2.topics[topic], marks, demand, specRefs: refs,
    responseType: marks === 1 ? 'mcq_single' : marks === 6 ? 'long_form' : 'short_answer', resource,
    ...(resource === 'none' ? {} : {resourceId: `aqa2_r${group}${letter}`}), mathsMarks, practicalMarks };
}

export function buildAqaPaper2Plan(mode: PaperMode, tier: PaperPlan['tier']): PaperPlan | null {
  if (mode === 'custom') return null;
  if (mode !== 'full_mock' && mode !== 'short_practice') throw new Error('Unknown AQA Paper 2 mode.');
  if (tier !== 'foundation' && tier !== 'higher') throw new Error('Choose Foundation or Higher for AQA Biology Paper 2.');
  const higher = tier === 'higher';
  const inheritance = higher ? '4.6.1.6-HT' : '4.6.1.6';
  const parts = mode === 'short_practice' ? [
    part(1, 'a', 0, 1, 'AO1', ['4.5.2.1']),
    part(1, 'b', 0, 3, 'AO2', ['4.5.2.1'], 'data_table', 2, 2),
    part(2, 'a', 0, 1, 'AO1', ['4.5.3.2']),
    part(2, 'b', 0, 3, 'AO2', [higher ? '4.5.3.2-HT' : '4.5.4.1'], 'graph', 1, higher ? 0 : 2),
    part(3, 'a', 1, 2, 'AO2', [inheritance]),
    part(3, 'b', 1, 4, 'AO1', ['4.6.2.2']),
    part(4, 'a', 2, 2, 'AO2', ['4.7.2.1'], 'data_table', 2, 2),
    part(4, 'b', 2, 4, 'AO3', ['4.7.2.3']),
  ] : [
    part(1, 'a', 0, 1, 'AO1', ['4.5.2.1']),
    part(1, 'b', 0, 2, 'AO1', ['4.5.2.1']),
    part(1, 'c', 0, 3, 'AO2', ['4.5.2.1'], 'data_table', 3, 3),
    part(1, 'd', 0, 6, 'AO3', ['4.5.2.1'], 'none', 0, 6),
    part(2, 'a', 0, 1, 'AO1', ['4.5.1']),
    part(2, 'b', 0, 2, 'AO1', ['4.5.3.2']),
    part(2, 'c', 0, 4, 'AO2', ['4.5.3.2'], 'graph', 2),
    part(2, 'd', 0, 4, 'AO2', [higher ? '4.5.3.3-HT' : '4.5.3.3']),
    part(3, 'a', 0, 1, 'AO1', ['4.5.4.1']),
    part(3, 'b', 0, 2, 'AO1', [higher ? '4.5.4.2-HT' : '4.5.4.1']),
    part(3, 'c', 0, 3, 'AO3', ['4.5.4.1'], 'data_table', 0, 3),
    part(3, 'd', 0, 4, 'AO2', ['4.5.4.1'], 'none', 2, 2),
    part(4, 'a', 1, 1, 'AO1', ['4.6.1.4']),
    part(4, 'b', 1, 2, 'AO1', [higher ? '4.6.1.5-HT' : '4.6.1.5']),
    part(4, 'c', 1, 3, 'AO2', [inheritance], 'data_table', 1),
    part(4, 'd', 1, 6, 'AO1', ['4.6.1.1', '4.6.1.3']),
    part(5, 'a', 1, 1, 'AO1', ['4.6.2.1']),
    part(5, 'b', 1, 2, 'AO1', ['4.6.2.3']),
    part(5, 'c', 1, 4, 'AO1', ['4.6.2.2', '4.6.3']),
    part(5, 'd', 1, 4, 'AO3', [higher ? '4.6.2.4-HT' : '4.6.2.5']),
    part(6, 'a', 1, 1, 'AO1', ['4.6.4']),
    part(6, 'b', 1, 3, 'AO2', ['4.6.4']),
    part(6, 'c', 1, 2, 'AO2', ['4.6.2.1'], 'data_table', 2),
    part(6, 'd', 1, 4, 'AO2', ['4.6.2.1', '4.6.2.2']),
    part(7, 'a', 2, 1, 'AO1', ['4.7.1']),
    part(7, 'b', 2, 2, 'AO1', ['4.7.1']),
    part(7, 'c', 2, 3, 'AO2', ['4.7.2.1'], 'data_table', 3, 3),
    part(7, 'd', 2, 6, 'AO3', ['4.7.2.1'], 'none', 0, 6),
    part(8, 'a', 2, 1, 'AO1', ['4.7.2.2']),
    part(8, 'b', 2, 2, 'AO1', ['4.7.2.3']),
    part(8, 'c', 2, 3, 'AO2', ['4.7.2.3'], 'graph', 2, 2),
    part(8, 'd', 2, 6, 'AO1', ['4.7.2.2', '4.7.2.3']),
    part(9, 'a', 2, 1, 'AO3', ['4.7.3']),
    part(9, 'b', 2, 2, 'AO1', ['4.7.4']),
    part(9, 'c', 2, 3, 'AO2', ['4.7.4'], 'data_table', 3),
    part(9, 'd', 2, 4, 'AO2', [higher ? '4.7.2.4-HT' : '4.7.5', '4.7.3']),
  ];
  return {courseId: AQA_BIOLOGY_P2.courseId, paperId: AQA_BIOLOGY_P2.paperId, contractVersion: 1,
    tier, mode, componentCode: aqaPaper2Component(tier)!, parts, partCount: parts.length,
    parentCount: new Set(parts.map(p => p.parentId)).size, totalMarks: parts.reduce((n,p) => n + p.marks, 0),
    durationMinutes: mode === 'full_mock' ? 105 : 21,
    label: mode === 'full_mock' ? 'AQA GCSE Biology Paper 2 full mock' : 'AQA GCSE Biology Paper 2 short practice'};
}

export function aqaPaper2PartInstruction(p: PlannedPart, includeOptions = true): string {
  return `Q${p.questionNumber} | ${p.marks} marks | ${p.responseType} | ${p.demand} | topic_tag="${p.topic}" | ` +
    (p.specRefs ?? []).map(ref => `${ref}: ${AQA_P2_OUTCOMES[ref]}`).join('; ') +
    (p.responseType === 'mcq_single' ? (includeOptions ? ' | question_type="mcq"; options: exactly four distinct plain strings; correct_answer equals one option.' : ' | Retain question_type="mcq" and the existing options/key.') : ' | question_type="written".') +
    (p.resource === 'none' ? ' | Self-contained text; any sibling data must be explicitly identified.' : ` | REQUIRED ${p.resource} in chart_data, with meaningful values used by the task.`) +
    (p.mathsMarks ? ` | ${p.mathsMarks} marks for mathematical work; give workings/units in the key. Foundation: supply the method/formula where needed.` : '') +
    (p.practicalMarks ? ` | ${p.practicalMarks} marks assess practical methods, evidence or evaluation, not only factual recall.` : '') +
    (p.marks === 6 ? ' | Private key MUST include Level 1 (1–2), Level 2 (3–4), Level 3 (5–6), each with specific science descriptors and indicative content; zero for no relevant science. Descriptors must assess THIS task at the saved tier.' : '');
}

export function aqaPaper2Instructions(plan: PaperPlan): string {
  return `${AQA_P2_RULES}\nSAVED TIER: ${plan.tier}; component ${plan.componentCode}; ${plan.totalMarks} marks; ${plan.durationMinutes} minutes.
${plan.mode === 'full_mock' ? 'Examly template: nine groups, 36 scored parts. These counts and topic allocations are not an official fixed AQA blueprint.' : 'Short practice: eight scored parts, 20 marks. This is not a full exam.'}
Return exactly these scored rows, in order. Never create unscored parent rows or relabel/omit a part. For each row supply question_number, root_question_number (leading integer as a string), parent_question_number (same leading integer), context, task, question_text (context joined to task), question_type, marks, topic_tag and correct_answer. All parts require an explicit task, including those with tables.
Resources are question-local. Captions must identify the question and describe the data neutrally. For siblings sharing results, explicitly name the earlier part; retain its values. Keep answer keys/level descriptors private, outside the stem and resource.
${plan.parts.map(p => aqaPaper2PartInstruction(p)).join('\n')}`;
}

export function isAqaPaper2(scope: {courseId?: string | null; paperId?: string | null}): boolean {
  return canonicalCourseId(scope.courseId) === 'aqa_gcse_biology' && scope.paperId === 'paper_2';
}

/** Narrow flags, not a complete classifier. Do not ban legitimate shared
 * concepts such as antibiotics in natural selection or respiration in ecology. */
export function aqaPaper2ContentIssue(text: string, tier?: string | null): string | null {
  const advanced = text.match(/\bHardy[ -]Weinberg\b|\bchi[- ]squared?\b|\bloop of Henle\b|\bcounter[- ]current multiplier\b|\bnitrogen cycle\b|\bprophase\b|\bmetaphase\b|\banaphase\b|\btelophase\b|\b(?:mRNA|tRNA)\b/i);
  if (advanced) return `AQA Paper 2 contains knowledge beyond the required GCSE depth (${advanced[0]}). Regenerate the task and private key.`;
  if (tier === 'foundation') {
    const higher = text.match(/\bglucagon\b|\bADH\b|\banti[- ]?diuretic\b|\bdeamination\b|\bthyroxine\b|\bIVF\b|\bin vitro fertilisation\b|\bgibberellins?\b|\bethene\b|\btranscription\b|\btranslation\b|\b(?:plasmid|viral) vectors?\b/i);
    if (higher) return `AQA Paper 2 Foundation contains Higher-only assessed content (${higher[0]}). Rewrite within the listed Foundation outcome.`;
  }
  return null;
}
