import type { BiologyDiagramConfig } from './types';

const has = (text: string, ...terms: string[]) =>
  terms.some(t => text.toLowerCase().includes(t.toLowerCase()));

const hasAll = (text: string, ...terms: string[]) =>
  terms.every(t => text.toLowerCase().includes(t.toLowerCase()));

const IMPLEMENTED_TYPES = new Set([
  'animal_cell','plant_cell','bacterial_cell','neuron','heart',
  'dna_helix','mitosis','punnett_square','food_web','food_chain',
  'ecological_pyramid','enzyme_substrate',
]);

const _detectBiologyDiagramInner = (
  questionText: string,
  subject?: string,
): BiologyDiagramConfig | null => null; // placeholder, overridden below

export const detectBiologyDiagram = (
  questionText: string,
  subject?: string,
): BiologyDiagramConfig | null => {
  const cfg = _detect(questionText, subject);
  if (cfg && !IMPLEMENTED_TYPES.has(cfg.type)) return null;
  return cfg;
};

const _detect = (
  questionText: string,
  subject?: string,
): BiologyDiagramConfig | null => {
  const text = questionText ?? '';
  const lower = text.toLowerCase().trim();
  const subj = (subject ?? '').toLowerCase();

  const isBiologySubject =
    /biology|life.?science|biolog|biol|human.?biology|marine.?biology|environmental.?science|biomedical|health.?science|anatomy|physiology/i.test(subj) ||
    subj === '';

  if (!isBiologySubject) return null;

  // ── SUPPRESSION: descriptive/analytical questions don't need diagrams ──
  const visualTriggerRe = /\b(draw|sketch|label|annotate|on the diagram|in the diagram|on the figure|in the figure|complete the diagram|add to the diagram|identify on|show on|indicate on|refer to the diagram|using the diagram|from the diagram|the diagram shows|the figure shows|shown in the (diagram|figure)|illustrated in|depicted in)\b/i;
  const hasVisualTrigger = visualTriggerRe.test(lower);

  // Always-visual topics — bypass suppression
  const isAlwaysVisual =
    /\b(punnett|monohybrid cross|dihybrid cross|genetic cross|food web|food chain|trophic|ecological pyramid|lock and key|lock-and-key|induced fit|enzyme.substrate complex)\b/i.test(lower);

  if (!isAlwaysVisual) {
    const startsDescriptive = /^(explain|describe|outline|discuss|evaluate|suggest|justify|compare|contrast|distinguish|differentiate|state|give|name|list|identify|what|why|how)\b/i.test(lower);
    if (startsDescriptive && !hasVisualTrigger) {
      return null;
    }

    // Cell/organelle mentions without explicit visual context — suppress
    const isCellMentionOnly =
      /\b(cell|organelle|nucleus|mitochondria|chloroplast|prokaryot|eukaryot)\b/i.test(lower) &&
      !hasVisualTrigger;
    if (isCellMentionOnly) {
      return null;
    }
  }

  // 1. Punnett square
  if (
    has(text, 'punnett', 'punnet') ||
    has(text, 'genetic cross', 'monohybrid cross', 'dihybrid cross',
        'single factor cross', 'two factor cross', 'test cross') ||
    (hasAll(text, 'cross', 'allele') &&
      has(text, 'offspring', 'phenotype', 'genotype', 'ratio', 'probability')) ||
    (has(text, 'dominant', 'recessive') &&
      has(text, 'cross', 'offspring', 'inherit')) ||
    has(text, 'x-linked', 'sex-linked', 'x linked') ||
    has(text, 'codominance', 'incomplete dominance', 'co-dominance') ||
    has(text, 'ABO blood group', 'blood group cross', 'blood type cross')
  ) {
    return buildPunnettConfig(text);
  }

  // 2. Food web / chain / pyramid
  if (
    has(text, 'food web', 'food chain', 'food network') ||
    has(text, 'trophic level', 'trophic') ||
    has(text, 'ecological pyramid', 'pyramid of numbers',
        'pyramid of biomass', 'pyramid of energy') ||
    (has(text, 'predator', 'prey') && has(text, 'energy flow', 'feeding')) ||
    (has(text, 'producer', 'consumer', 'decomposer') &&
      has(text, 'energy', 'biomass', 'feeding'))
  ) {
    return buildFoodWebConfig(text);
  }

  // 3. Enzyme
  if (
    has(text, 'lock and key', 'lock-and-key', 'induced fit') ||
    (has(text, 'enzyme') &&
      has(text, 'active site', 'substrate', 'enzyme-substrate complex',
          'product', 'specificity')) ||
    (has(text, 'enzyme') && has(text, 'inhibitor', 'competitive', 'non-competitive')) ||
    has(text, 'enzyme-substrate', 'enzyme substrate complex')
  ) {
    return buildEnzymeConfig(text);
  }

  // 4. Synapse / neuron
  if (
    has(text, 'synapse', 'synaptic', 'neurotransmitter',
        'vesicle', 'receptor', 'synaptic cleft') ||
    (has(text, 'nerve impulse') && has(text, 'junction', 'gap')) ||
    (has(text, 'acetylcholine', 'dopamine', 'serotonin') && has(text, 'receptor'))
  ) {
    return { type: 'synapse' };
  }

  if (
    has(text, 'neuron', 'nerve cell', 'motor neuron', 'sensory neuron',
        'relay neuron', 'interneuron', 'axon', 'dendrite', 'myelin',
        'nodes of ranvier', 'schwann cell', 'action potential',
        'nerve fibre', 'nerve fiber')
  ) {
    return { type: 'neuron' };
  }

  // 5. Cells
  if (
    has(text, 'bacterial cell', 'prokaryot', 'prokaryote') ||
    (has(text, 'bacteria') && has(text, 'cell', 'structure', 'diagram', 'label')) ||
    has(text, 'nucleoid', 'plasmid', 'pili', 'flagellum') ||
    has(text, '70s ribosome', '70S')
  ) {
    return { type: 'bacterial_cell' };
  }

  if (
    (has(text, 'plant cell') && has(text, 'label', 'diagram', 'structure', 'organelle')) ||
    (has(text, 'cell wall', 'chloroplast', 'vacuole') &&
      has(text, 'plant', 'label', 'diagram')) ||
    (has(text, 'cellulose cell wall', 'central vacuole') && has(text, 'plant'))
  ) {
    return { type: 'plant_cell' };
  }

  if (
    (has(text, 'animal cell') && has(text, 'label', 'diagram', 'structure', 'organelle')) ||
    (has(text, 'cell') && has(text, 'organelle', 'label', 'diagram') &&
      !has(text, 'plant', 'bacteria', 'prokaryote')) ||
    (has(text, 'mitochondria', 'nucleus', 'ribosome') &&
      has(text, 'label', 'diagram', 'identify')) ||
    (has(text, 'eukaryotic cell') && !has(text, 'plant'))
  ) {
    return { type: 'animal_cell' };
  }

  // 6. DNA / molecular
  if (
    (has(text, 'transcription', 'translation', 'mrna', 'codon', 'anticodon', 'ribosome') &&
      has(text, 'protein synthesis')) ||
    has(text, 'gene expression', 'protein synthesis process')
  ) {
    return { type: 'protein_synthesis' };
  }

  if (
    has(text, 'dna replication', 'semi-conservative', 'semiconservative',
        'helicase', 'dna polymerase', 'okazaki', 'lagging strand',
        'leading strand', 'replication fork')
  ) {
    return { type: 'dna_replication' };
  }

  if (
    has(text, 'dna double helix', 'double helix', 'base pair', 'base pairing',
        'adenine', 'thymine', 'guanine', 'cytosine', 'dna structure',
        'complementary base', 'watson', 'crick', 'deoxyribose', 'pentose sugar') &&
    has(text, 'diagram', 'label', 'draw', 'structure')
  ) {
    return { type: 'dna_helix' };
  }

  // 7. Cell division
  if (
    has(text, 'meiosis', 'meiotic', 'crossing over', 'chiasmata',
        'homologous chromosome', 'haploid', 'gamete formation',
        'reduction division')
  ) {
    return { type: 'meiosis' };
  }

  if (
    has(text, 'mitosis', 'prophase', 'metaphase', 'anaphase', 'telophase',
        'cell cycle', 'cytokinesis', 'spindle', 'chromatid') &&
    has(text, 'diagram', 'label', 'stage', 'draw', 'identify')
  ) {
    return { type: 'mitosis' };
  }

  // 8. Photosynthesis
  if (
    has(text, 'light-dependent reaction', 'light dependent reaction',
        'light-independent reaction', 'calvin cycle', 'photosystem',
        'grana', 'thylakoid', 'stroma', 'nadph', 'atp synthesis') ||
    (has(text, 'photosynthesis') &&
      has(text, 'diagram', 'label', 'stage', 'light', 'dark', 'process'))
  ) {
    return { type: 'photosynthesis' };
  }

  // 9. Respiration
  if (
    has(text, 'glycolysis', 'krebs cycle', 'citric acid cycle',
        'electron transport chain', 'oxidative phosphorylation',
        'pyruvate', 'acetyl coa', 'nadh', 'fadh2') ||
    (has(text, 'aerobic respiration') &&
      has(text, 'diagram', 'stage', 'process', 'summary'))
  ) {
    return { type: 'respiration' };
  }

  // 10. Heart
  if (
    has(text, 'heart chamber', 'atrium', 'ventricle', 'aorta',
        'pulmonary', 'valve', 'mitral', 'tricuspid', 'vena cava') &&
    has(text, 'diagram', 'label', 'draw', 'structure')
  ) {
    return { type: 'heart' };
  }

  // 11. Gas exchange
  if (
    has(text, 'alveolus', 'alveoli', 'gas exchange', 'oxygen diffusion',
        'lung', 'capillary', 'carbon dioxide', 'partial pressure') &&
    has(text, 'diagram', 'label', 'draw')
  ) {
    return { type: 'gas_exchange' };
  }

  // 12. Leaf / root
  if (
    has(text, 'leaf cross section', 'cross-section of a leaf',
        'palisade mesophyll', 'spongy mesophyll', 'stomata', 'guard cell',
        'epidermis', 'xylem', 'phloem') &&
    has(text, 'diagram', 'label', 'section')
  ) {
    return { type: 'leaf_section' };
  }

  if (
    has(text, 'root hair cell', 'root hair', 'root tip',
        'osmosis in root', 'water uptake') &&
    has(text, 'diagram', 'label', 'draw')
  ) {
    return { type: 'root_hair_cell' };
  }

  // 13. Population
  if (
    has(text, 'logistic growth', 's-shaped curve', 'sigmoid curve',
        'j-shaped curve', 'exponential growth', 'carrying capacity',
        'population growth') &&
    has(text, 'diagram', 'draw', 'sketch', 'graph', 'label')
  ) {
    return { type: 'population_growth' };
  }

  // 14. Cycles
  if (
    has(text, 'nitrogen cycle', 'nitrogen fixation', 'nitrification',
        'denitrification', 'ammonification')
  ) {
    return { type: 'nitrogen_cycle' };
  }

  if (
    has(text, 'carbon cycle', 'carbon dioxide', 'photosynthesis',
        'respiration', 'decomposition', 'combustion') &&
    has(text, 'cycle', 'diagram', 'label', 'process')
  ) {
    return { type: 'carbon_cycle' };
  }

  // 15. Immune response
  if (
    has(text, 'antibody', 'antigen', 'immune response', 'b cell', 'b-cell',
        't cell', 't-cell', 'lymphocyte', 'phagocytosis', 'opsonisation') &&
    has(text, 'diagram', 'label', 'draw', 'show')
  ) {
    return { type: 'immune_response' };
  }

  // 16. Homeostasis
  if (
    has(text, 'negative feedback', 'positive feedback', 'homeostasis',
        'thermoregulation', 'osmoregulation', 'blood glucose',
        'insulin', 'glucagon') &&
    has(text, 'diagram', 'feedback loop', 'mechanism', 'draw')
  ) {
    return { type: 'homeostasis' };
  }

  // 17. Phylogenetic tree
  if (
    has(text, 'phylogenetic tree', 'cladogram', 'evolutionary tree',
        'common ancestor', 'clade', 'phylogeny') &&
    has(text, 'diagram', 'draw', 'label', 'construct', 'show')
  ) {
    return { type: 'phylogenetic_tree' };
  }

  // 18. Gel / PCR
  if (has(text, 'gel electrophoresis', 'electrophoresis', 'DNA profiling', 'dna fingerprint')) {
    return { type: 'gel_electrophoresis' };
  }

  if (has(text, 'polymerase chain reaction', 'PCR', 'DNA amplification', 'thermocycler')) {
    return { type: 'pcr' };
  }

  return null;
};

const buildPunnettConfig = (text: string): BiologyDiagramConfig => {
  const isDihybrid =
    has(text, 'dihybrid', 'two factor', 'two gene', 'two trait', 'aabb', 'AaBb');
  const isXLinked =
    has(text, 'x-linked', 'sex-linked', 'x linked', 'haemophilia',
        'colour blind', 'color blind', 'duchenne');
  const isCodominant =
    has(text, 'codominance', 'co-dominance', 'incomplete dominance',
        'abo blood', 'blood group', 'ia ib', 'roan');

  const alleleMatches = [...text.matchAll(/\b([A-Z][a-z]?)\b/g)]
    .map(m => m[1])
    .filter(a => a.length <= 2);

  const dominantAllele = alleleMatches.find(a => a === a.toUpperCase()) ?? 'A';
  const recessiveAllele = dominantAllele.toLowerCase();

  return {
    type: 'punnett_square',
    crossType: isDihybrid ? 'dihybrid'
      : isXLinked ? 'x_linked'
      : isCodominant ? 'codominance'
      : 'monohybrid',
    parent1: isDihybrid
      ? `${dominantAllele}a${dominantAllele}a`.slice(0, 4)
      : `${dominantAllele}${recessiveAllele}`,
    parent2: isDihybrid
      ? `${dominantAllele}a${dominantAllele}a`.slice(0, 4)
      : `${dominantAllele}${recessiveAllele}`,
    dominantTrait: has(text, 'tall', 'round', 'smooth', 'black', 'brown')
      ? text.match(/\b(tall|round|smooth|black|brown|curly|long)\b/i)?.[1] ?? 'dominant'
      : 'dominant',
    recessiveTrait: has(text, 'short', 'wrinkled', 'white', 'blonde')
      ? text.match(/\b(short|wrinkled|white|blonde|straight|albino)\b/i)?.[1] ?? 'recessive'
      : 'recessive',
  };
};

const buildFoodWebConfig = (text: string): BiologyDiagramConfig => {
  const isChain = has(text, 'food chain') && !has(text, 'food web');
  const isPyramid =
    has(text, 'pyramid of numbers', 'pyramid of biomass', 'pyramid of energy', 'ecological pyramid');

  return {
    type: isPyramid ? 'ecological_pyramid'
      : isChain ? 'food_chain'
      : 'food_web',
    organisms: extractOrganisms(text),
    pyramidType: isPyramid
      ? has(text, 'biomass') ? 'biomass'
        : has(text, 'energy') ? 'energy'
        : 'numbers'
      : undefined,
  };
};

const buildEnzymeConfig = (text: string): BiologyDiagramConfig => {
  const isInducedFit =
    has(text, 'induced fit', 'induced-fit') ||
    (has(text, 'enzyme') && !has(text, 'lock and key'));

  return {
    type: 'enzyme_substrate',
    model: isInducedFit ? 'induced_fit' : 'lock_and_key',
    hasInhibitor: has(text, 'inhibitor', 'competitive', 'non-competitive', 'allosteric'),
    inhibitorType: has(text, 'competitive') ? 'competitive'
      : has(text, 'non-competitive', 'allosteric') ? 'non_competitive'
      : undefined,
  };
};

const extractOrganisms = (text: string): string[] => {
  const commonOrganisms = [
    'grass', 'plant', 'algae', 'phytoplankton', 'wheat', 'corn', 'leaves',
    'rabbit', 'mouse', 'rat', 'insect', 'caterpillar', 'grasshopper', 'aphid',
    'deer', 'sheep', 'cow', 'zebra', 'gazelle',
    'fox', 'wolf', 'lion', 'eagle', 'hawk', 'owl', 'snake', 'frog',
    'shark', 'tuna', 'cod', 'herring', 'krill', 'zooplankton',
    'bacteria', 'fungi', 'decomposer',
  ];
  const found = commonOrganisms.filter(org => text.toLowerCase().includes(org));
  return found.length >= 2 ? found : ['grass', 'rabbit', 'fox'];
};
