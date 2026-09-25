// Pearson 1BI0, specification Issue 4 (March 2024), reviewed 2026-09-24.
// These are original outcome summaries, not copied questions. B means separate
// Biology content; only the specification's BOLD text is Higher-only.
import { EDEXCEL_BIOLOGY_ID, canonicalCourseId } from './assessment-tier.ts';

export type EdexcelBiologyPaper = 'paper_1' | 'paper_2';
export const EDEXCEL_BIOLOGY_TOPICS = {
  1: 'Key concepts in biology',
  2: 'Cells and control',
  3: 'Genetics',
  4: 'Natural selection and genetic modification',
  5: 'Health, disease and the development of medicines',
  6: 'Plant structures and their functions',
  7: 'Animal coordination, control and homeostasis',
  8: 'Exchange and transport in animals',
  9: 'Ecosystems and material cycles',
} as const;
export type EdexcelTopic = keyof typeof EDEXCEL_BIOLOGY_TOPICS;
export const edexcelTopicNumbers = (paper: EdexcelBiologyPaper): readonly EdexcelTopic[] =>
  paper === 'paper_1' ? [1, 2, 3, 4, 5] : [1, 6, 7, 8, 9];

// Sub-reference suffixes identify the bold subpoints of otherwise common rows.
export const EDEXCEL_BIOLOGY_OUTCOMES: Record<string, string> = {
  '1.1': 'Relate animal, plant and bacterial cell structures to their functions.',
  '1.2': 'Explain adaptations of sperm, egg and ciliated cells.',
  '1.3': 'Compare microscope detail and how imaging improves understanding.',
  '1.5': 'Convert cell measurements between metric units; use ordinary decimal numbers at Foundation.',
  '1.5e': 'Calculate with standard form (Higher only).',
  '1.6': 'Core practical: microscopy, magnification and observational drawings. Supply measurable image dimensions or a numerical table.',
  '1.7': 'Enzyme specificity and the active site.',
  '1.8': 'Denaturation changes an enzyme active site.',
  '1.9': 'Effects of pH, substrate concentration and temperature on enzyme activity.',
  '1.10': 'Core practical: investigate pH and enzyme activity with controls, repeats and measured results.',
  '1.11': 'Calculate enzyme reaction rates from given quantities and times.',
  '1.12': 'Enzymes build and break down carbohydrates, proteins and lipids.',
  '1.13B': 'Core practical: food tests using reagents for starch, reducing sugars, protein and fat.',
  '1.14B': 'Measure food energy by calorimetry; provide the required numerical data and equation.',
  '1.15': 'Compare diffusion, osmosis and active transport across cell membranes.',
  '1.16': 'Core practical: potato osmosis using initial/final masses and controlled conditions.',
  '1.17': 'Calculate mass percentage change in osmosis, including the sign and units.',
  '2.1': 'Mitosis and the cell cycle, including the named mitotic stages and cytokinesis. These names are permitted at BOTH tiers.',
  '2.2': 'Mitosis in growth, repair and asexual reproduction.',
  '2.3': 'Mitosis produces two genetically identical diploid cells.',
  '2.4': 'Cancer involves uncontrolled cell division.',
  '2.5': 'Animal/plant growth, cell division, elongation and differentiation.',
  '2.7': 'Interpret growth percentile charts; percentile is not percentage growth.',
  '2.8': 'Embryonic/adult stem cells and plant meristems.',
  '2.9': 'Weigh benefits and risks of stem-cell treatments using evidence.',
  '2.10B': 'Functions of cerebral hemispheres, cerebellum and medulla.',
  '2.11B': 'CT/PET imaging to investigate the brain (Higher only).',
  '2.12B': 'Limitations of treating nervous-system injury and disease (Higher only).',
  '2.13': 'Receptors, sensory/relay/motor neurones, synapses and neurotransmitters.',
  '2.14': 'Explain the pathway of a reflex arc; do not substitute a generic neurone picture for an arc.',
  '2.15B': 'Eye structures and their roles in vision.',
  '2.16B': 'Cataracts, short/long sight and colour blindness.',
  '2.17B': 'Correction of cataracts and short/long sight.',
  '3.1B': 'Advantages and disadvantages of asexual reproduction.',
  '3.2B': 'Advantages and disadvantages of sexual reproduction.',
  '3.3': 'Meiosis makes four genetically different haploid gametes. Named meiotic stages are not required.',
  '3.4': 'DNA double helix, nucleotides and complementary bases.',
  '3.5': 'Gene and genome; a gene codes for a protein.',
  '3.6': 'Explain a method of extracting DNA from fruit.',
  '3.7B': 'Base sequence, amino-acid order and protein folding (Higher only).',
  '3.8B': 'Protein synthesis: RNA polymerase, transcription, mRNA, ribosomes, codons, tRNA and polypeptide assembly (Higher only; permitted GCSE depth).',
  '3.9B': 'Non-coding variation affects RNA-polymerase binding and protein quantity (Higher only).',
  '3.10B': 'Coding variation changes amino-acid order and protein activity (Higher only).',
  '3.11B': 'Mendel and historical difficulties explaining inheritance.',
  '3.13': 'Alleles, genotype, phenotype, homozygous/heterozygous and dominant/recessive.',
  '3.14': 'Monohybrid crosses, Punnett grids and pedigrees; BOTH tiers may use genetic diagrams.',
  '3.15': 'Chromosomal sex determination at fertilisation.',
  '3.16': 'Compute monohybrid offspring probabilities, ratios or percentages from stated parents.',
  '3.17B': 'ABO inheritance with multiple alleles and codominance; BOTH tiers, despite the B suffix.',
  '3.18B': 'Sex-linked inheritance (Higher only).',
  '3.19': 'Many features involve several genes.',
  '3.20': 'Separate inherited and environmental causes of variation.',
  '3.21': 'Potential medical uses of Human Genome Project findings.',
  '3.22': 'Mutations create genetic variation in populations.',
  '3.23': 'Mutation effects range from none to major changes in phenotype.',
  '4.1B': 'Darwin and Wallace and the development of evolutionary explanations.',
  '4.2': 'Natural selection of inherited variation across generations.',
  '4.3': 'Antibiotic resistance as evidence of natural selection.',
  '4.4': 'Human evolution: interpret fossil evidence and a supplied timeline.',
  '4.5': 'Stone-tool evidence and dating from its surroundings.',
  '4.6B': 'Pentadactyl limbs as evidence for relatedness.',
  '4.7': 'Genetic evidence for three-domain classification.',
  '4.8': 'Selective breeding in crops and domestic animals.',
  '4.9B': 'Tissue culture and its uses in breeding and medicine.',
  '4.10': 'Genetic engineering changes a genome to introduce a trait.',
  '4.11': 'Restriction enzymes, ligase, sticky ends and vectors in engineering (Higher only).',
  '4.12B': 'Benefits and drawbacks of GM crops, including insect resistance.',
  '4.13B': 'Agricultural benefits and drawbacks of fertilisers and biological control.',
  '4.14': 'Evaluate selective breeding and genetic engineering with evidence and ethical considerations.',
  '5.2': 'Distinguish communicable from non-communicable disease.',
  '5.4': 'Identify bacterial, viral, fungal and protist pathogens.',
  '5.5': 'Infections: cholera, tuberculosis, ash dieback, malaria, HIV, Helicobacter and Ebola.',
  '5.6': 'Transmission routes and ways to reduce spread.',
  '5.7B': 'Lytic and lysogenic viral life cycles; BOTH tiers.',
  '5.8': 'Chlamydia and HIV transmission and prevention.',
  '5.9B': 'Physical plant barriers against pests and pathogens.',
  '5.10B': 'Chemical plant defences and medicinal uses.',
  '5.11B': 'Plant disease diagnosis and distribution analysis (Higher only).',
  '5.12': 'Human physical/chemical barriers to infection.',
  '5.13': 'Antigens, antibodies, memory lymphocytes and secondary responses.',
  '5.14': 'Explain immunity following vaccination.',
  '5.15B': 'Benefits and limitations of immunisation and herd immunity.',
  '5.16': 'Why antibiotics treat bacterial infections rather than viral infections.',
  '5.17B': 'Aseptic techniques in microbial culture.',
  '5.18B': 'Core practical: compare antimicrobial effects using microbial cultures and controlled conditions.',
  '5.19B': 'Calculate an inhibition-zone area from its radius; supply dimensions, units and the circle-area formula when appropriate.',
  '5.20': 'Medicine development, preclinical tests and clinical trials.',
  '5.21B': 'Lymphocytes, hybridomas and monoclonal antibody production (Higher only).',
  '5.22B': 'Monoclonal antibody diagnostic/therapeutic uses (Higher only).',
  '5.23': 'Interacting risk factors in non-communicable disease.',
  '5.24': 'Lifestyle risks; BMI and waist-to-hip calculations from supplied data.',
  '5.25': 'Evaluate cardiovascular treatments using supplied evidence.',
  '6.1': 'Photosynthetic producers make food and biomass.',
  '6.2': 'Photosynthesis is an endothermic reaction using light, carbon dioxide and water.',
  '6.3': 'Individual limiting factors for photosynthesis.',
  '6.4': 'Interactions among limiting factors (Higher only).',
  '6.5': 'Core practical: measure photosynthesis at different light intensities.',
  '6.6': 'Light intensity and the inverse-square relationship with lamp distance (Higher only).',
  '6.7': 'Root-hair adaptations for absorbing water and mineral ions.',
  '6.8': 'Relate xylem/phloem structures to their transport functions.',
  '6.9': 'Water/mineral transport, transpiration and stomata.',
  '6.10': 'Sucrose translocation in plants.',
  '6.11B': 'Leaf adaptations for photosynthesis and gas exchange.',
  '6.12': 'Light, temperature and air movement affect water uptake.',
  '6.13': 'Calculate transpiration rates from measured water uptake and time.',
  '6.14B': 'Plant adaptations to extreme environments.',
  '6.15B': 'Auxin in phototropism and gravitropism.',
  '6.16B': 'Commercial uses of auxin, gibberellins and ethene (Higher only).',
  '7.1': 'Endocrine glands, hormones and transport to target organs.',
  '7.2': 'Adrenaline fight-or-flight effects (Higher only).',
  '7.3': 'Thyroxine feedback via hypothalamus TRH and pituitary TSH (Higher only; permitted GCSE detail).',
  '7.4': 'Menstrual-cycle stages and individual roles of oestrogen/progesterone.',
  '7.5': 'Interactions of oestrogen, progesterone, FSH and LH (Higher only).',
  '7.6': 'Hormonal contraception and prevention of pregnancy.',
  '7.7': 'Compare hormonal and barrier contraception.',
  '7.8': 'IVF and clomifene in assisted reproduction (Higher only).',
  '7.9': 'Maintaining a stable internal environment.',
  '7.10B': 'Importance of temperature and water balance.',
  '7.11B': 'Skin and hypothalamus in thermoregulation.',
  '7.12Ba': 'Shivering in temperature regulation (both tiers).',
  '7.12Bbc': 'Vasoconstriction and vasodilation in temperature control (Higher only).',
  '7.13': 'Insulin regulation of blood glucose.',
  '7.14': 'Glucagon regulation of blood glucose (Higher only).',
  '7.15': 'Type 1 diabetes: cause and control.',
  '7.16': 'Type 2 diabetes: cause and control.',
  '7.17': 'Interpret diabetes risk evidence and calculate BMI/waist-to-hip ratio.',
  '7.18B': 'Urinary-system structures.',
  '7.19B': 'Nephron filtration in glomerulus/Bowman capsule and reabsorption of glucose/water (both tiers). No countercurrent mechanism.',
  '7.20B': 'ADH changes collecting-duct permeability (Higher only).',
  '7.21B': 'Dialysis and transplantation for kidney failure.',
  '7.22B': 'The liver makes urea when excess amino acids are broken down.',
  '8.1': 'Substances that organisms need to exchange.',
  '8.2': 'Exchange/transport requirements and surface-area-to-volume calculations.',
  '8.3': 'Alveolar adaptations for diffusion.',
  '8.4B': 'Effects of area, concentration gradient and diffusion distance.',
  '8.5B': 'Fick-law proportional calculations with a supplied expression and consistent units (both tiers).',
  '8.6': 'Blood components and their functions.',
  '8.7': 'Blood vessel adaptations.',
  '8.8': 'Heart chambers, valves, major vessels and circulation.',
  '8.9': 'Respiration releases energy in an exothermic process.',
  '8.10': 'Compare aerobic and anaerobic respiration.',
  '8.11': 'Core practical: measure respiration rates in living organisms.',
  '8.12': 'Calculate cardiac output, stroke volume or heart rate with correct units.',
  '9.1': 'Organisms, populations, communities and ecosystems.',
  '9.2': 'Effects of abiotic and biotic conditions on a community.',
  '9.3': 'Interdependence of organisms.',
  '9.4': 'Parasitism and mutualism.',
  '9.5': 'Core practical: quadrats and belt transects in field sampling.',
  '9.6': 'Estimate populations from sampled area and count data.',
  '9.7B': 'Trophic energy losses, food-chain length and biomass pyramids.',
  '9.8B': 'Calculate energy-transfer efficiency or biomass-transfer percentages from actual measured data.',
  '9.9': 'Effects of fish farming, introduced species and eutrophication.',
  '9.10': 'Conservation, biodiversity and reforestation.',
  '9.11B': 'Biological factors in food security.',
  '9.12': 'Materials cycle between living and non-living components.',
  '9.13': 'Carbon cycling and decomposers.',
  '9.14': 'Water cycling, potable water and desalination.',
  '9.15': 'Nitrogen cycling, bacteria, fertilisers and crop rotation (both tiers).',
  '9.16B': 'Evaluate pollution using indicator species (Higher only).',
  '9.17B': 'Effects of temperature, water and oxygen on decomposition and food preservation.',
};

export const EDEXCEL_HIGHER_ONLY = new Set([
  '1.5e', '2.11B', '2.12B', '3.7B', '3.8B', '3.9B', '3.10B', '3.18B', '4.11',
  '5.11B', '5.21B', '5.22B', '6.4', '6.6', '6.16B', '7.2', '7.3', '7.5', '7.8', '7.12Bbc', '7.14', '7.20B', '9.16B',
]);

export function isEdexcelBiology(scope: {courseId?: string | null}): boolean {
  return canonicalCourseId(scope.courseId) === EDEXCEL_BIOLOGY_ID;
}

export function edexcelOutcomeAllowed(ref: string, paper: EdexcelBiologyPaper, tier: string | null): boolean {
  return Object.prototype.hasOwnProperty.call(EDEXCEL_BIOLOGY_OUTCOMES, ref) && edexcelTopicNumbers(paper).includes(Number(ref.split('.')[0]) as EdexcelTopic) &&
    (tier === 'higher' || !EDEXCEL_HIGHER_ONLY.has(ref));
}

export function edexcelBiologyRules(paper: EdexcelBiologyPaper): string {
  return `PEARSON EDEXCEL GCSE SEPARATE BIOLOGY 1BI0 ${paper === 'paper_1' ? 'PAPER 1' : 'PAPER 2'}, specification Issue 4.
Permitted topic tags: ${edexcelTopicNumbers(paper).map(n => EDEXCEL_BIOLOGY_TOPICS[n]).join('; ')}.
Topic 1 belongs to BOTH papers. ${paper === 'paper_1' ? 'Topics 2–5 belong here. No standalone Topic 6–9 assessment: plant transport, homeostatic endocrine/kidney mechanisms, animal circulation or ecosystems.' : 'Topics 6–9 belong here. No standalone Topic 2–5 assessment: mitosis, reflex arcs, inheritance/protein synthesis, evolution, pathogen/medicine development.'}
Use original contexts, complete command tasks and private matching keys. Draw content from the supplied outcome references at the saved tier. Do not copy the AQA or OCR topic split, practical numbering, tier exclusions or marking instructions.
B after a reference means separate Biology, NOT Higher. At Foundation, named mitotic stages, ABO codominance, monohybrid calculations, lytic/lysogenic cycles, nephron structure, Fick-law calculations and nitrogen cycling are permitted when in this paper. Higher additionally permits its listed outcomes, including protein synthesis and TRH/TSH feedback. No Calvin cycle, thylakoid/stroma biochemistry, Krebs cycle, oxidative phosphorylation, Hardy-Weinberg, chi-squared, countercurrent multiplier or detailed meiotic stages at either tier.
Foundation: explicit steps, accessible contexts and decimal quantities. Exclude assessed standard form, CT/PET brain investigation/treatment mechanisms, protein-synthesis/coding-variant mechanisms, sex-linked inheritance, gene-engineering enzyme/vector steps, plant-disease diagnostics, monoclonal antibodies, interacting photosynthesis limits/inverse-square calculations, commercial hormone uses, adrenaline/thyroxine mechanisms, menstrual-hormone interactions/ART, vasoconstriction/vasodilation, glucagon/ADH feedback and pollution indicator-species evaluation. Do not include excluded requirements in the key, even as optional credit.
Use MCQs within the structured questions, not OCR's 15-question Section A. Each MCQ needs four distinct choices and exactly one correct choice. Six-mark answers require a PRIVATE task-specific best-fit scheme: 0 for no relevant science; Level 1 (1–2), Level 2 (3–4), Level 3 (5–6), with indicative science, coherent reasoning and the planned AO. Credit equivalent valid wording; never use automatic one-mark-per-fact scoring for a level response.
Create one canonical chart_data resource where required. Tables need real values, headings and units. Numeric continuous measurements use line/scatter graphs as appropriate; categories may use bars. Match every datum to the task and private key; no invented substitute diagrams, completed answer scaffolds, duplicate markdown tables or bracketed image placeholders. Give all required data locally or explicitly identify an earlier sibling in the SAME parent group. No dependencies between separate parent questions.`;
}

/** Deliberately narrow deterministic flags. Prompt outcome maps and human
 * review are still necessary; keyword matching does not certify a syllabus. */
export function edexcelBiologyContentIssue(text: string, paper: EdexcelBiologyPaper, tier?: string | null): string | null {
  const advanced = text.match(/\bHardy[ -]Weinberg\b|\bchi[- ]squared?\b|\bKrebs cycle\b|\boxidative phosphorylation\b|\bcounter[- ]current multiplier\b|\b(?:prophase|metaphase|anaphase|telophase)\s+(?:I{1,2}|[12])\b/i);
  if (advanced) return `Edexcel 1BI0 includes out-of-specification detail (${advanced[0]}). Rewrite the complete task and key at GCSE depth.`;
  if (tier === 'foundation') {
    const higher = text.match(/\b(?:transcription|translation|mRNA|tRNA|codons?|anticodons?|RNA polymerase|monoclonal|hybridomas?|glucagon|ADH|antidiuretic|anti-diuretic|thyroxine|TRH|TSH|IVF|clomifene|vasoconstriction|vasodilation|gibberellins?|ethene|ligase)\b|\bsex[- ]linked\b|\binverse[- ]square\b|\brestriction enzymes?\b|\bsticky ends\b|\bstandard form\b|\b(?:CT|PET) scan(?:ning|s)?\b/i);
    if (higher) return `Edexcel 1BI0 Foundation contains Higher-only assessed detail (${higher[0]}). Regenerate using the permitted Foundation outcome.`;
  }
  const wrongPaper = text.match(paper === 'paper_1'
    ? /\b(?:nephrons?|glomerulus|glomeruli|Bowman['’]?s? capsule|collecting duct|glucagon|ADH|thyroxine|cardiac output|transpiration|translocation|eutrophication|nitrogen cycle|trophic levels?)\b/i
    : /\b(?:monohybrid|Punnett|codominance|sex[- ]linked|transcription|mRNA|tRNA|RNA polymerase|monoclonal|hybridomas?|mitosis|prophase|metaphase|anaphase|telophase|reflex arc|natural selection|lysogenic|lytic cycle)\b/i);
  return wrongPaper ? `Edexcel ${paper === 'paper_1' ? 'Paper 1' : 'Paper 2'} contains assessed content from the other paper (${wrongPaper[0]}). Keep the task and key within its listed outcomes.` : null;
}
