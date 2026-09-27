import { AQA_ALEVEL_BIOLOGY_ID } from './assessment-tier.ts';

export const AQA_ALEVEL_BIOLOGY_SPECIFICATION = 'aqa-7402-v1.6-2026-07';
export const AQA_ALEVEL_SPEC_URL = 'https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/specification/specification-at-a-glance';
export const AQA_ALEVEL_P1_TOPICS = [
  'Biological molecules', 'Cells', 'Organisms exchange substances with their environment',
  'Genetic information, variation and relationships between organisms',
] as const;

/** Reviewed summaries of 7402 sections 3.1–3.4, not copied exam questions.
 * The pool supplies variety within the paper; part refs constrain each task. */
export const AQA_ALEVEL_P1_OUTCOMES: Record<string, {topic: number; text: string}> = {
  '3.1.1': {topic:0,text:'Monomers, polymers, condensation and hydrolysis.'},
  '3.1.2': {topic:0,text:'Alpha/beta glucose, glycosidic bonds, starch, glycogen and cellulose structure/function; carbohydrate tests.'},
  '3.1.3': {topic:0,text:'Triglycerides, phospholipids, ester bonds, saturation and the emulsion test.'},
  '3.1.4.1': {topic:0,text:'Protein primary to quaternary structure, relevant bonds and the biuret test.'},
  '3.1.4.2': {topic:0,text:'Enzyme induced fit, activation energy, temperature/pH/concentration and competitive/non-competitive inhibition; required practical 1.'},
  '3.1.5.1': {topic:0,text:'DNA/RNA nucleotides, phosphodiester bonds, base pairing and molecular structure.'},
  '3.1.5.2': {topic:0,text:'Semi-conservative DNA replication and evidence; helicase and DNA polymerase.'},
  '3.1.6': {topic:0,text:'ATP structure, hydrolysis/resynthesis, ATP synthase and phosphorylation as energy transfer, without later-paper respiratory pathways.'},
  '3.1.7': {topic:0,text:'Water properties linked to biological functions.'},
  '3.1.8': {topic:0,text:'Roles of hydrogen, iron, sodium and phosphate ions.'},
  '3.2.1': {topic:1,text:'Eukaryotic organelles, prokaryotes and viruses; microscopy magnification/resolution, light/TEM/SEM, cell fractionation and ultracentrifugation. Organelle structure is allowed, not Topic 5 pathway recall.'},
  '3.2.2': {topic:1,text:'Cell cycle, named mitotic stages, binary fission and viral replication; stained root-tip squash and mitotic index (required practical 2).'},
  '3.2.3': {topic:1,text:'Fluid mosaic membrane, diffusion/facilitated diffusion, osmosis and water potential, active transport and co-transport; dilution/calibration to estimate water potential (practical 3), membrane permeability (practical 4).'},
  '3.2.4': {topic:1,text:'Antigens, phagocytosis, T/B cells, antibodies, vaccination, HIV, monoclonal antibodies and ELISA.'},
  '3.3.1': {topic:2,text:'Surface area to volume and requirements for specialised exchange surfaces.'},
  '3.3.2': {topic:2,text:'Gas exchange in insects, fish, leaves and mammals; countercurrent flow, ventilation, diffusion and lung-function evidence.'},
  '3.3.3': {topic:2,text:'Digestion and absorption of carbohydrates, lipids and proteins; ileum and sodium co-transport.'},
  '3.3.4.1': {topic:2,text:'Haemoglobin, oxygen dissociation and Bohr effect; heart cycle, vessels, tissue fluid and associated dissection skills (required practical 5).'},
  '3.3.4.2': {topic:2,text:'Xylem cohesion-tension, transpiration and phloem mass flow; quantitative transport investigations.'},
  '3.4.1': {topic:3,text:'Genes, chromosomes, histones, loci, triplet code and coding/non-coding DNA.'},
  '3.4.2': {topic:3,text:'Transcription and translation, mRNA/tRNA/ribosomes, pre-mRNA splicing and prokaryote/eukaryote differences.'},
  '3.4.3': {topic:3,text:'Mutation and genetic variation, meiosis, independent segregation, crossing over and random fertilisation; detailed meiotic phase names not required.'},
  '3.4.4': {topic:3,text:'Directional/stabilising natural selection, adaptation and resistance; aseptic investigation of antimicrobial effects (required practical 6).'},
  '3.4.5': {topic:3,text:'Species, taxonomic hierarchy, binomial naming and molecular phylogeny; no recall of named kingdom/domain systems required.'},
  '3.4.6': {topic:3,text:'Species richness, diversity index d=N(N−1)/sum(n(n−1)), agriculture and conservation evidence.'},
  '3.4.7': {topic:3,text:'Comparing DNA/mRNA/amino-acid sequences, representative sampling, means and interpretation of standard deviation. Do not require calculation of standard deviation or gene-technology mechanisms.'},
};

export const isAqaAlevelBiology = (scope: {courseId?: string|null}): boolean => scope.courseId === AQA_ALEVEL_BIOLOGY_ID;
export const AQA_ALEVEL_P1_RULES = `AQA A-LEVEL BIOLOGY 7402/1, specification ${AQA_ALEVEL_BIOLOGY_SPECIFICATION}. This is the untiered full A-level, not AS 7401 or GCSE 8461.
Assess Topics 1–4 (3.1–3.4) and their relevant practical skills only. Cell/organelle structure, ATP, enzymes, water potential, transcription/translation and natural selection ARE permitted; GCSE word bans do not apply.
Do not assess Topic 5 photosynthesis/respiration pathways, Topic 6 homeostasis/neural mechanisms, Topic 7 inheritance/populations, or Topic 8 gene technologies. Sequence comparison is allowed without testing gene-technology methods.
Required practical skills include enzymes, mitosis, water potential, membrane permeability, dissection and antimicrobial aseptic work (1–6). A written mock does not award the separate practical endorsement.
Give self-contained assessed instructions, original contexts and sufficient numerical inputs/units. Interpret supplied standard deviations; never require their calculation. Use appropriate significant figures and units, and supply any unfamiliar formula. Graphs of continuous variables use numeric axes and lines; no fabricated diagrams or missing table data.
Paper 1 marking is task-specific and point-based, including this template's five-mark extended responses. Write a private key with independently creditable points, explicit caps, valid alternatives and calculation working consistent with the exact visible data. Do not import a GCSE six-mark three-level rubric or the Paper 3 essay rubric. Keep all marking content and worked results private.
The full paper has 91 marks in 120 minutes: 76 short/long-answer marks and 15 extended-response marks. Group counts, part counts, chosen topics per group and AO/skill annotations are Examly design choices, not an official fixed blueprint. Short practice is a reduced exercise.`;

/** Narrow flags supplement the reviewed outcome plan; they are not a full
 * scientific classifier. Structural chloroplast/mitochondrial terms remain legal. */
export function aqaAlevelPaper1ContentIssue(text: string): string|null {
  const later = text.match(/\bCalvin cycle\b|\bKrebs cycle\b|\bchemiosmosis\b|\boxidative phosphorylation\b|\bphotophosphorylation\b|\bphotolysis\b|\baction potentials?\b|\bsaltatory conduction\b|\bnephrons?\b|\bADH\b|\bHardy[-– ]Weinberg\b|\bpolymerase chain reaction\b|\bPCR\b|\boperons?\b|\bDNA methylation\b|\bhistone acetylation\b/i);
  if(later)return `AQA A-level Biology Paper 1 includes later-paper content (${later[0]}). Regenerate the entire task and private key using its planned 3.1–3.4 outcomes.`;
  if(/\b(?:calculate|compute|work out)\b[^.?!\n]{0,70}\bstandard deviation\b/i.test(text))return 'Paper 1 may interpret supplied standard deviations but must not require students to calculate them.';
  if(/\bMichaelis[-– ]Menten\b|\bLineweaver[-– ]Burk\b/i.test(text))return 'This enzyme-kinetics requirement exceeds the reviewed AQA A-level Paper 1 outcomes.';
  return null;
}
