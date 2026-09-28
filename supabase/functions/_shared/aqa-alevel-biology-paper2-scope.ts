import { AQA_ALEVEL_BIOLOGY_SPECIFICATION } from './aqa-alevel-biology-scope.ts';

export const AQA_ALEVEL_P2_TOPICS = [
  'Energy transfers in and between organisms',
  'Organisms respond to changes in their internal and external environments',
  'Genetics, populations, evolution and ecosystems',
  'The control of gene expression',
] as const;

/** Reviewed, paraphrased outcome pool from 7402 sections 3.5–3.8 (v1.6).
 * These guide original questions; they are not copied assessment material. */
export const AQA_ALEVEL_P2_OUTCOMES: Record<string, {topic:number; text:string}> = {
  '3.5.1': {topic:0,text:'Photosynthesis: photolysis, electron transfer, chemiosmosis, ATP/reduced NADP; Calvin cycle with RuBP, GP, TP and rubisco; limiting factors; pigment chromatography and chloroplast dehydrogenase investigations (practicals 7/8).'},
  '3.5.2': {topic:0,text:'Glycolysis, fermentation, link reaction, Krebs cycle and oxidative phosphorylation; alternative respiratory substrates; respiration investigations using single-celled cultures (practical 9).'},
  '3.5.3': {topic:0,text:'Productivity and energy transfer: NPP=GPP−R and consumer N=I−(F+R), transfer efficiency, calorimetry and agricultural productivity.'},
  '3.5.4': {topic:0,text:'Nitrogen/phosphorus cycling, saprobionts, mycorrhizae, fertilisers and eutrophication.'},
  '3.6.1.1': {topic:1,text:'Plant IAA responses, taxis/kinesis and three-neurone reflexes; environmental-response investigations (practical 10).'},
  '3.6.1.2': {topic:1,text:'Pacinian generator potentials; rods/cones, visual sensitivity and acuity.'},
  '3.6.1.3': {topic:1,text:'Cardiac conduction, autonomic control, pressure/chemical receptors and cardiac output.'},
  '3.6.2.1': {topic:1,text:'Resting/action potentials, refractory period and saltatory conduction; effects of diameter and temperature.'},
  '3.6.2.2': {topic:1,text:'Cholinergic synapses, neuromuscular junctions, summation, inhibition and supplied drug evidence.'},
  '3.6.3': {topic:1,text:'Sliding filaments, calcium, tropomyosin, ATP/phosphocreatine and slow/fast fibres; troponin detail is not required.'},
  '3.6.4.1': {topic:1,text:'Homeostasis and positive/negative feedback.'},
  '3.6.4.2': {topic:1,text:'Glucose control, insulin/glucagon/adrenaline, cAMP and diabetes; dilution/colorimetry and calibration for unknown glucose concentrations (practical 11).'},
  '3.6.4.3': {topic:1,text:'Water-potential control, ADH, hypothalamus/posterior pituitary, nephrons and loop of Henle.'},
  '3.7.1': {topic:2,text:'Mono/dihybrid inheritance, codominance, sex/autosomal linkage, multiple alleles and epistasis; chi-squared testing of observed versus expected frequencies.'},
  '3.7.2': {topic:2,text:'Gene pools and Hardy–Weinberg assumptions; allele, genotype and phenotype frequencies.'},
  '3.7.3': {topic:2,text:'Directional, stabilising and disruptive selection, genetic drift, allopatric and sympatric speciation.'},
  '3.7.4': {topic:2,text:'Ecosystems, carrying capacity, competition, predation, quadrats/transects, mark-release-recapture, succession and conservation; environmental distribution investigations (practical 12).'},
  '3.8.1': {topic:3,text:'Mutations, base changes, frameshifts and consequences of code degeneracy.'},
  '3.8.2.1': {topic:3,text:'Cell potency, induced pluripotency and stem-cell treatment evidence.'},
  '3.8.2.2': {topic:3,text:'Transcription factors, oestrogen, DNA methylation, histone acetylation and RNA interference.'},
  '3.8.2.3': {topic:3,text:'Benign/malignant tumours, oncogenes, tumour-suppressor genes, epigenetics and cancer-risk evidence.'},
  '3.8.3': {topic:3,text:'Genomes, proteomes, sequencing applications and limitations.'},
  '3.8.4.1': {topic:3,text:'Recombinant DNA, reverse transcriptase, restriction enzymes/ligase, vectors, promoters/terminators, PCR, cloning, markers and ethical gene-therapy evidence.'},
  '3.8.4.2': {topic:3,text:'Probes, hybridisation, screening and genetic counselling.'},
  '3.8.4.3': {topic:3,text:'VNTRs, electrophoresis and genetic fingerprinting.'},
};

export const AQA_ALEVEL_P2_RULES = `AQA A-LEVEL BIOLOGY 7402/2, specification ${AQA_ALEVEL_BIOLOGY_SPECIFICATION}. Full A-level, untiered; not AS 7401 or GCSE.
Assess Topics 5–8 (3.5–3.8) and relevant practical skills. Earlier molecular/cellular knowledge may underpin application, but do not substitute a Paper 1-only task. Calvin/Krebs cycles, chemiosmosis, ADH, action potentials, Hardy–Weinberg and PCR ARE valid here. Do not import Paper 1 or GCSE exclusions.
Use the planned outcome pool to select coherent original tasks. Relevant practicals 7–12 cover pigments, chloroplast activity, respiration, responses, glucose calibration and ecological distribution. A written mock does not award the practical endorsement.
Full paper: 91 marks, 120 minutes, 35% of A-level. The first 76 marks mix short and long answers; the remaining 15 marks form ONE comprehension question based on an original reading passage. This is not Paper 1's extended-response allocation or Paper 3's 25-mark essay. Parent/part counts and AO/skill annotations are Examly design choices. Short practice is a reduced exercise.
Every scored part needs an explicit instruction, sufficient givens and a private point-based key with caps and alternatives. Calculate from exactly the displayed data and units. Use numeric axes for continuous graphs and canonical tables; never invent missing measurements. Interpret supplied standard deviations, not their calculation; give unfamiliar formulae.
Comprehension must assess application, explanation and evaluation of the passage, not just copy-out recall. Supply relevant evidence with enough biological detail to support all its tasks. Refer to numbered paragraphs, not unprinted line numbers. Use original prose, never claim it is an official AQA extract. All answer keys remain private; do not embed solved responses in the passage. No GCSE three-level or Paper 3 essay rubric.`;

/** Narrow flags, not a general scientific accuracy classifier. */
export function aqaAlevelPaper2ContentIssue(text:string):string|null {
  if (/\b(?:calculate|compute|work out)\b[^.?!\n]{0,70}\bstandard deviation\b/i.test(text)) return 'Paper 2 may interpret supplied standard deviations but must not require their calculation.';
  if (/\bMichaelis[-– ]Menten\b|\bLineweaver[-– ]Burk\b|\bNernst equation\b/i.test(text)) return 'This mechanism exceeds the reviewed AQA A-level Paper 2 outcomes; use the planned 3.5–3.8 task.';
  return null;
}
