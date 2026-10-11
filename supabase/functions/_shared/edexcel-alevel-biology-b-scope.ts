import { EDEXCEL_ALEVEL_BIOLOGY_B_ID } from './assessment-tier.ts';
import type { BiologyScope } from './gcse-biology-scope.ts';

export const EDEXCEL_B_SPECIFICATION = 'issue_4_november_2018';
export const EDEXCEL_B_SPEC_URL = 'https://qualifications.pearson.com/content/dam/pdf/A%20Level/biology-b/2015/specification-and-sample-assessment-materials/9781446930892-gce2015-a-biob-spec.pdf';
export const EDEXCEL_B_SAM_URL = 'https://qualifications.pearson.com/content/dam/pdf/A%20Level/biology-b/2015/specification-and-sample-assessment-materials/Biology%20B%20A%20SAM%20Collation%20Web%209781446914540.pdf';
export const EDEXCEL_B_P1_TOPICS = [
  'Biological Molecules', 'Cells, Viruses and Reproduction of Living Things',
  'Classification and Biodiversity', 'Exchange and Transport',
  'Energy for Biological Processes', 'Microbiology and Pathogens', 'Modern Genetics',
] as const;
/** Original planning summaries of Issue 4 outcomes, not copied assessment material. */
export const EDEXCEL_B_P1_OUTCOMES: Record<string, { topic: number; text: string }> = {
  '1.1': {topic: 0, text: 'Carbohydrate structures, condensation, hydrolysis and structure/function relationships.'},
  '1.2': {topic: 0, text: 'Triglycerides, ester bonds, saturation and phospholipid properties.'},
  '1.3': {topic: 0, text: 'Protein organisation and bonding; collagen and haemoglobin structure and function.'},
  '1.4': {topic: 0, text: 'DNA structure and replication; transcription, translation and the genetic code.'},
  '1.5': {topic: 0, text: 'Enzyme specificity, mechanisms, inhibition, rates and controlled investigations (core practical 1).'},
  '1.6': {topic: 0, text: 'Roles of inorganic ions in biological processes.'},
  '1.7': {topic: 0, text: 'Water properties and their biological significance.'},
  '2.1': {topic: 1, text: 'Prokaryotic/eukaryotic ultrastructure, microscopy, calibration and magnification (core practical 2).'},
  '2.2': {topic: 1, text: 'Virus structures, nucleic-acid types, lytic replication, latency and prevention of transmission.'},
  '2.3': {topic: 1, text: 'Cell cycle, mitosis, meiosis, crossing over, assortment and chromosome abnormalities; root-tip preparation (core practical 3).'},
  '2.4': {topic: 1, text: 'Mammalian gametogenesis, fertilisation and early embryo development.'},
  '2.5': {topic: 1, text: 'Plant gamete formation, pollen tubes and double fertilisation (core practical 4).'},
  '3.1': {topic: 2, text: 'Classification hierarchy, species limitations, molecular evidence, domains and validation of evolutionary evidence.'},
  '3.2': {topic: 2, text: 'Natural selection, adaptations, niches and reproductive isolation/speciation.'},
  '3.3': {topic: 2, text: 'Species/genetic biodiversity and conservation; supplied diversity index D = N(N−1)/Σn(n−1).'},
  '4.1': {topic: 3, text: 'Surface-area/volume relationships and exchange/transport requirements.'},
  '4.2': {topic: 3, text: 'Membrane transport, ATP and water potential ψ=P+π; membrane permeability and tissue water potential (core practicals 5/6).'},
  '4.3': {topic: 3, text: 'Gas-exchange adaptations in insects, fish, mammals and plants; safe ethical dissection (core practical 7).'},
  '4.4': {topic: 3, text: 'Heart/vessel structure, cardiac cycle, intrinsic conduction (SAN/AVN/bundle of His), ECG, blood, clotting and atherosclerosis.'},
  '4.5': {topic: 3, text: 'Haemoglobin/myoglobin, oxygen dissociation, Bohr effect and fetal oxygen affinity.'},
  '4.6': {topic: 3, text: 'Tissue fluid, hydrostatic/oncotic pressures and lymph.'},
  '4.7': {topic: 3, text: 'Xylem/phloem, water pathways, cohesion tension, transpiration and mass flow; potometer methods (core practical 8).'},
  '5.1': {topic: 4, text: 'Respiration as a source of ATP and heat; locations of its stages.'},
  '5.2': {topic: 4, text: 'Glycolysis, phosphorylation, pyruvate, reduced NAD and ATP; do not demand unspecified intermediates.'},
  '5.3': {topic: 4, text: 'Link reaction/Krebs cycle, carbon dioxide, reduced coenzymes and ATP, without unspecified intermediate detail.'},
  '5.4': {topic: 4, text: 'Mitochondrial electron transport, oxygen and chemiosmotic ATP synthesis.'},
  '5.5': {topic: 4, text: 'Anaerobic respiration, lactate/ethanol and relative ATP yield; respirometry (core practical 9).'},
  '5.6': {topic: 4, text: 'Action/absorption spectra and pigment chromatography (core practicals 10/11).'},
  '5.7': {topic: 4, text: 'Chloroplasts, photophosphorylation, Calvin cycle (GALP), limiting factors and photosynthesis investigations.'},
  '6.1': {topic: 5, text: 'Aseptic culture, media, growth measurement, growth phases, logarithms and exponential growth-rate constants (core practicals 12/13).'},
  '6.2': {topic: 5, text: 'Bacterial invasion and toxins with specified pathogen examples.'},
  '6.3': {topic: 5, text: 'Bactericidal/bacteriostatic effects of penicillin and tetracycline.'},
  '6.4': {topic: 5, text: 'Development/spread of antibiotic resistance and control difficulties.'},
  '6.5': {topic: 5, text: 'Transmission/pathogenic effects of stem rust, influenza and malaria; detailed life cycles not required.'},
  '6.6': {topic: 5, text: 'Evidence, ethics, economic and social implications of endemic malaria control.'},
  '6.7': {topic: 5, text: 'Innate and adaptive immune cells, humoral/cell-mediated immunity, memory, vaccination and herd immunity.'},
  '7.1': {topic: 6, text: 'Genomes, PCR, sequencing, DNA profiling and applications to inherited conditions and paternity.'},
  '7.2': {topic: 6, text: 'Transcription factors, RNA splicing, epigenetic modification and differentiation.'},
  '7.3': {topic: 6, text: 'Stem-cell potency, induced pluripotency, differentiation, medical applications and ethics.'},
  '7.4': {topic: 6, text: 'Recombinant DNA, vectors, marker genes/replica plating, knockout models and crop modification/evaluation.'},
};
export const isEdexcelAlevelBiologyB = (scope: Pick<BiologyScope, 'courseId'>) => scope.courseId === EDEXCEL_ALEVEL_BIOLOGY_B_ID;
export const EDEXCEL_B_P1_RULES = `PEARSON EDEXCEL A LEVEL BIOLOGY B, 9BI0/01 Advanced Biochemistry, Microbiology and Genetics, untiered.
Assessed content is Topics 1–7 only, Issue 4 November 2018. Biology A/Salters-Nuffield (9BN0) is a separate unavailable course. Do not infer either qualification from generic Edexcel Biology.
Use A-level terminology and the permitted outcomes. Meiosis/assortment/crossing over (2.3), natural selection/speciation (3.2), diversity/conservation (3.3), intrinsic cardiac conduction (4.4), microbial resistance (6.4) and stem-cell/genetic technology (7) are valid.
Do not assess Topic 8 inheritance crosses/pedigrees, linkage, Hardy–Weinberg, chi-squared inheritance, drift/founder/bottleneck mechanisms; Topic 9 endocrine/neural/homeostatic control; or Topic 10 ecosystem energetics, succession, nutrient cycling and ecological distribution sampling. These cannot be disguised as synoptic Paper 1 tasks. Core practicals 1–13 are relevant; 14–16 belong outside this paper.
No fifteen-MCQ opening or OCR Section A/B split. Embed single-select choices among structured questions. Every scored part must have separate context and task with an assessed Pearson command, matching marks, complete visible givens and a private scheme.
Use Pearson commands (Calculate, Describe, Explain, Assess, Evaluate, Compare and contrast, Deduce, Determine, Predict, Suggest, State, Give, Identify, Complete, Draw, Plot, Sketch, Add/Label, Write) according to their specification definitions. Never give an explanation key for a mere description task.
Ordinary schemes need acceptable points, terminology, alternatives/rejections, caps, and calculation method/final-answer/unit/precision credit. Six-mark extended tasks need task-specific Pearson best-fit Level 1 (1–2), Level 2 (3–4), Level 3 (5–6), zero, and indicative content with contextual application and reasoning. No AQA essay rubric or automatic six-fact score.
At least 10% Level 2 maths is a QUALIFICATION requirement across the three papers, not an exact Paper 1 quota. Embed authentic numerical and core-practical application, controls, risks, errors, uncertainty, validity and evidence-based conclusions. Preserve working and method marks.
Only saved reviewed assets or validated deterministic diagrams; never runtime scientific raster imagery or past-paper assets. All resources must be complete and answer-safe. No arbitrary image URLs. Custom preserves manual choices within Topics 1–7.`;

/** Deterministic known-boundary gate; not an exhaustive scientific classifier.
 * Scan private material and raw resources too so an allowed topic tag cannot hide
 * later-topic requirements. Topic 2/3/4 overlap is deliberately NOT blacklisted. */
export function edexcelBiologyBContentIssue(value: unknown): string | null {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const later = text.match(/\b(?:topic\s*(?:8|9|10)\b|origins of genetic variation|control systems|hardy[\s–—-]*weinberg|χ²|chi[\s-]*(?:squared|square)|dihybrid|monohybrid|punnett|pedigree|autosomal linkage|sex[\s-]*link(?:ed|age)|codominan\w*|genetic drift|founder effect|population bottleneck|stabili[sz]ing selection|disruptive selection|allele frequenc(?:y|ies)|action potentials?|saltatory|synap(?:se|tic)|neurotransmitters?|reflex arc|osmoregulation|thermoregulation|nephrons?|loop of henle|insulin|glucagon|antidiuretic|ADH|negative feedback|positive feedback|endocrine|gibberellin|auxin|phototropism|pupillary reflex|baroreceptors?|chemoreceptors?|food (?:web|chain)s?|trophic|succession|nitrogen cycle|carbon cycle|nitrification|denitrification|mark[\s-]*(?:release[\s-]*)?recapture|transects?|quadrats?)\b/i);
  if (later) return `9BI0/01 excludes Topics 8–10 assessed content (${later[0]}). Regenerate within Topics 1–7; do not remove legitimate meiosis, selection, conservation or intrinsic cardiac conduction.`;
  if (/\b(?:9BN0|Salters[\s-]*Nuffield)\b/i.test(text)) return 'Biology A (9BN0) is not the saved Biology B qualification.';
  return null;
}

/** Pearson Appendix 7 imperatives absent from the legacy shared verb list.
 * Scope this addition to Biology B; reported uses such as "researchers assess"
 * still contain no student task. */
export function pearsonAdditionalAssessedTask(text:string):boolean {
  return text.split(/(?<=[.?!])\s+|[\r\n]+|;\s+/).some(clause=>
    /^(?:\s|["'(\[|*\-–—])*(?:(?:briefly|carefully|clearly|fully)\s+)*(?:assess|devise|criticise)\s+\S/i.test(clause));
}
