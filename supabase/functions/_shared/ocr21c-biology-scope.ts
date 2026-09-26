import { OCR_21C_BIOLOGY_ID } from './assessment-tier.ts';

export type Ocr21cPaper = 'breadth' | 'depth';
export type Ocr21cChapter = 1 | 2 | 3 | 4 | 5 | 6;
export const OCR21C_TOPICS = {
  1: 'B1 You and your genes', 2: 'B2 Keeping healthy',
  3: 'B3 Living together - food and ecosystems', 4: 'B4 Using food and controlling growth',
  5: 'B5 The human body - staying alive', 6: 'B6 Life on Earth - past, present and future',
} as const;

// Original summaries of selected assessable outcomes, checked against OCR J257
// specification v4.0, August 2026. Bold type in that PDF means Higher-only.
// This is a reviewed generation vocabulary, not a verbatim copy or an exhaustive
// specification. B7 (Ideas about Science) and B8 (practicals) are embedded in it.
export const OCR21C_OUTCOMES: Record<string, {chapter: Ocr21cChapter; text: string; higher?: true}> = {
  'B1.1.1': {chapter:1,text:'Locate genetic material in plant, animal and bacterial cells; use a light microscope to observe cells (PAG1).'},
  'B1.1.2': {chapter:1,text:'A genome comprises all the genetic material of an organism.'},
  'B1.1.3': {chapter:1,text:'DNA is a nucleotide polymer arranged as two strands in a double helix.'},
  'B1.1.5': {chapter:1,text:'Distinguish chromosomes, genes, alleles, genetic variants, genotype and phenotype.'},
  'B1.1.6': {chapter:1,text:'Genes provide instructions for assembling proteins from amino acids; do not demand the triplet code at Foundation.'},
  'B1.1.8': {chapter:1,higher:true,text:'Relate the DNA base sequence to amino-acid order using a three-base code at GCSE level.'},
  'B1.1.9': {chapter:1,higher:true,text:'A gene is copied into mRNA, which carries instructions to a ribosome for joining amino acids. Detailed transcription and translation mechanisms are excluded.'},
  'B1.2.1': {chapter:1,text:'Use gamete, dominant, recessive, homozygous and heterozygous correctly.'},
  'B1.2.3': {chapter:1,text:'Predict single-gene inheritance outcomes from stated parental genotypes. If completing a cross is assessed, give a blank scaffold, not completed offspring.'},
  'B1.2.4': {chapter:1,text:'Use ratios and proportions in a single-gene cross, with consistent genotype and phenotype data.'},
  'B1.3.2': {chapter:1,text:'Genetic engineering changes an organism genome to introduce desired characteristics; Foundation need not recall the procedural steps.'},
  'B1.3.3': {chapter:1,higher:true,text:'Outline gene isolation and copying, transfer using a vector, insertion into cells and selection of modified cells.'},
  'B2.1.1': {chapter:2,text:'Relate health and disease, distinguishing infectious causes from non-communicable disease.'},
  'B2.2.1': {chapter:2,text:'Describe physical, chemical and microbial barriers that prevent pathogens entering the body.'},
  'B2.2.4': {chapter:2,text:'Explain protection by the immune system, including pathogen destruction and antibody responses.'},
  'B2.4.2': {chapter:2,text:'Explain aseptic culture methods and contamination controls (PAG7); use safe school-laboratory conditions.'},
  'B2.4.3': {chapter:2,text:'Calculate bacterial growth or inhibition-zone areas using pi times radius squared; distinguish diameter and radius and supply measurements.'},
  'B2.4.5': {chapter:2,higher:true,text:'Explain diagnostic uses of monoclonal antibodies and their specificity.'},
  'B2.6.1': {chapter:2,text:'Explain how medicines, including antibiotics, treat disease; antibiotics do not kill viruses.'},
  'B2.6.4': {chapter:2,text:'Explain preclinical and clinical testing of new medicines, controls and evidence quality (B7 Ideas about Science).'},
  'B3.1.1': {chapter:3,text:'Describe the simple two-stage model: light and chlorophyll enable splitting of water, releasing oxygen; hydrogen then combines with carbon dioxide to form glucose. Photosynthesis is endothermic. Both tiers may assess this model and investigations of requirements/products (PAG5).'},
  'B3.1.2': {chapter:3,text:'Relate chloroplasts and chlorophyll to photosynthesis.'},
  'B3.1.3': {chapter:3,text:'Explain enzymes through active sites and specificity; investigate temperature, pH or substrate concentration (PAG4).'},
  'B3.1.4': {chapter:3,text:'Investigate effects of temperature, light or carbon dioxide on photosynthesis (PAG5); Foundation uses one changing factor at a time.'},
  'B3.1.5': {chapter:3,higher:true,text:'Use the inverse-square relationship between distance from a point light source and light intensity.'},
  'B3.1.6': {chapter:3,higher:true,text:'Explain interacting limiting factors in photosynthesis using supplied graph data.'},
  'B3.3.5': {chapter:3,text:'Explain interdependence and competition using a consistently named community or food web.'},
  'B3.3.8': {chapter:3,text:'Calculate biomass-transfer efficiency from actual visible quantities at successive trophic levels; explain losses. Both tiers may assess this.'},
  'B3.4.2': {chapter:3,text:'Design field sampling using quadrats or transects and estimate abundance from the sampled area (PAG3).'},
  'B3.4.3': {chapter:3,text:'Calculate means or percentages and interpret population measurements and graphs.'},
  'B4.1.1': {chapter:4,text:'Compare aerobic and anaerobic respiration, their inputs, products and relative ATP yields. ATP as an energy-transfer molecule is GCSE J257 content; no biochemical pathways or exact ATP yields.'},
  'B4.1.3': {chapter:4,text:'Relate mitochondria to aerobic respiration.'},
  'B4.1.5': {chapter:4,text:'Investigate the effects of different substrates on yeast respiration and calculate rates from measurements (PAG5).'},
  'B4.2.1': {chapter:4,text:'Explain how electron microscopy improved observation of cell structures (B7 evidence and scientific explanations).'},
  'B4.2.2ab': {chapter:4,text:'Compare cell sizes and convert units; use estimates appropriately. Foundation uses ordinary decimal numbers, not calculations in standard form.'},
  'B4.2.2c': {chapter:4,higher:true,text:'Use standard-form calculations in cell-size and microscopy contexts.'},
  'B4.3.1': {chapter:4,text:'Describe growth through the cell cycle, interphase and mitosis. Intermediate named phases need not be recalled; microscopy may supply observations (PAG1).'},
  'B4.3.3': {chapter:4,text:'Explain chromosome-number reduction in meiosis through interphase and two divisions, without requiring intermediate named phases.'},
  'B5.1.2': {chapter:5,text:'Explain diffusion, osmosis and active transport across cell membranes.'},
  'B5.1.4': {chapter:5,text:'Relate cardiac muscle, chambers and valves to heart function.'},
  'B5.1.8': {chapter:5,text:'Calculate surface-area-to-volume ratios and relate these to exchange.'},
  'B5.2.3': {chapter:5,text:'Explain a reflex arc including sensory, relay and motor neurones; investigate reflex responses (PAG6). A generic neurone picture is not a reflex-arc resource.'},
  'B5.4.1': {chapter:5,text:'Explain why cells require a controlled internal environment.'},
  'B5.4.2': {chapter:5,text:'Describe sweating, hair position and skin blood-flow changes in temperature control and investigations (PAG6). Foundation does not require the receptor-processing-feedback pathway.'},
  'B5.4.3': {chapter:5,higher:true,text:'Explain thermoregulation including receptors, hypothalamic processing, effectors and negative feedback.'},
  'B5.4.6': {chapter:5,higher:true,text:'Explain ADH effects on kidney-tubule permeability in water balance.'},
  'B5.6.1': {chapter:5,text:'Explain how insulin controls blood glucose; Foundation does not require glucagon.'},
  'B5.6.2': {chapter:5,higher:true,text:'Explain the complementary effects of insulin and glucagon in blood-glucose control.'},
  'B6.1.1': {chapter:6,text:'Recognise genetic variation within a population.'},
  'B6.1.3': {chapter:6,text:'Explain natural selection through variation, differential survival and reproduction, and inherited advantages over generations.'},
  'B6.1.6': {chapter:6,text:'Explain selective breeding and its effects on crop plants and domesticated animals.'},
  'B6.2.1': {chapter:6,text:'Compare advantages and disadvantages of sexual and asexual reproduction in stated conditions.'},
  'B6.3.1': {chapter:6,text:'Use biological evidence, including DNA similarities, to explain changes to classification.'},
  'B6.4.1': {chapter:6,text:'Explain effects of human activities on biodiversity and evaluate conservation choices.'},
  'B6.4.2': {chapter:6,higher:true,text:'Evaluate environmental-change evidence about organism distribution, including water and atmospheric gases.'},
};

export const isOcr21cBiology = (scope: {courseId?: string | null}) => scope.courseId === OCR_21C_BIOLOGY_ID;
export const ocr21cOutcomeAllowed = (ref: string, tier?: string | null): boolean =>
  !!OCR21C_OUTCOMES[ref] && (tier === 'higher' || (tier === 'foundation' && !OCR21C_OUTCOMES[ref].higher));

export function ocr21cBiologyRules(paper: Ocr21cPaper): string {
  if (paper !== 'breadth' && paper !== 'depth') throw new Error('Choose Breadth or Depth for OCR Biology B.');
  return `OCR TWENTY FIRST CENTURY GCSE BIOLOGY B, J257, ${paper === 'breadth' ? 'BREADTH' : 'DEPTH'}.
Both papers sample B1-B6, with B7 Ideas about Science and B8 practical skills embedded throughout. Never divide this course into Gateway B1-B3 versus B4-B6, or AQA/Edexcel Paper 1/2 topic lists. The saved component and tier are authoritative, not a subject display name.
${paper === 'breadth' ? 'BREADTH: short structured, objective, calculation and practical tasks, no level-of-response essays. No part above four marks. Interleave a small number of MCQs; there is no separate MCQ section.' : 'DEPTH: connected contexts and application, data analysis, practical evaluation and sustained biological reasoning. A full paper needs at least two six-mark responses with private three-level schemes. Other items remain accessible short tasks. No Gateway-style Section A.'}
Follow the exact Examly part plan; counts and chosen topics are template choices, not OCR fixed question counts. Every part must state a complete assessed instruction. Keep context within a parent group consistent and use visible, matching measurements. Do not make a later batch depend on unstated earlier data.
Use original GCSE scenarios to assess evidence, variables, controls, uncertainty, conclusions, models, risks and decisions (B7), and practical methods/data (B8), alongside knowledge. An AO1 task can assess understanding in context, not just isolated definitions.
J257 permits the simple two-stage photosynthesis model at BOTH tiers and relative ATP yields in respiration. Do not import an AQA ban on these. No Calvin cycle, thylakoid/stroma detail, NADPH, electron transport chains, chemiosmosis, Krebs cycle, membrane-potential mechanisms or statistical hypothesis tests.
Foundation: accessible wording and scaffolded arithmetic; no mRNA/triplet-code detail, monoclonal antibodies, inverse-square law, interacting limiting-factor analysis, standard-form calculations, ADH, glucagon, hormonal negative-feedback pathways, gibberellin/ethene applications or gene-transfer procedures. Higher: only the reviewed GCSE Higher outcomes; increased difficulty never permits A-level content.
For MCQs supply four distinct string options and a private answer matching one. For calculations supply every measurement and unit, work the answer from the same values, and keep it private. Use line graphs for measured continuous trends and bar charts for categories. Required tables must be visible, not replaced by a decorative diagram. Any supplied genetic cross must match the stated parents and keep assessed offspring/probabilities blank.`;
}

/** Narrow deterministic checks supplement the reviewed outcome prompts; they
 * are not a complete semantic classifier or an external quality rating. */
export function ocr21cBiologyContentIssue(text: string, tier?: string | null): string | null {
  const advanced = text.match(/\bCalvin cycle\b|\bthylakoids?\b|\bstroma\b|\bNADPH\b|\bchemiosmosis\b|\belectron transport chain\b|\bKrebs cycle\b|\bHardy[- ]Weinberg\b|\bchi[- ]squared?\b/i);
  if (advanced) return `OCR Biology B contains beyond-GCSE content (${advanced[0]}). Regenerate the complete task and key within J257.`;
  if (tier === 'foundation') {
    const higher = text.match(/\bmRNA\b|\btriplet code\b|\bmonoclonal\b|\bhybridomas?\b|\binverse[- ]square\b|\bADH\b|\bantidiuretic\b|\bglucagon\b|\bthyroxine\b|\bgibberellins?\b|\bethene\b|\bstandard form\b/i);
    if (higher) return `OCR Biology B Foundation contains Higher-only content (${higher[0]}). Regenerate using common-tier outcomes.`;
  }
  return null;
}
