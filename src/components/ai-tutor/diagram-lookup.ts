// Maps concept keywords the AI might signal to existing diagram type strings
// and which subject dispatcher to use.

export interface DiagramSignal {
  subject: 'biology' | 'physics' | 'chemistry' | 'economics' | 'maths';
  type: string;
  config?: Record<string, any>;
}

export const DIAGRAM_KEYWORD_MAP: Record<string, DiagramSignal> = {
  // ── Biology ────────────────────────────────────────────────
  animal_cell:          { subject: 'biology', type: 'animal_cell' },
  plant_cell:           { subject: 'biology', type: 'plant_cell' },
  bacterial_cell:       { subject: 'biology', type: 'bacterial_cell' },
  cell:                 { subject: 'biology', type: 'animal_cell' },
  neuron:               { subject: 'biology', type: 'neuron' },
  nerve_cell:           { subject: 'biology', type: 'neuron' },
  heart:                { subject: 'biology', type: 'heart' },
  dna:                  { subject: 'biology', type: 'dna_helix' },
  dna_helix:            { subject: 'biology', type: 'dna_helix' },
  double_helix:         { subject: 'biology', type: 'dna_helix' },
  mitosis:              { subject: 'biology', type: 'mitosis' },
  punnett_square:       { subject: 'biology', type: 'punnett_square',
                          config: { crossType: 'monohybrid', parent1: 'Aa', parent2: 'Aa',
                                    dominantTrait: 'A', recessiveTrait: 'a' } },
  punnett:              { subject: 'biology', type: 'punnett_square',
                          config: { crossType: 'monohybrid', parent1: 'Aa', parent2: 'Aa',
                                    dominantTrait: 'A', recessiveTrait: 'a' } },
  food_web:             { subject: 'biology', type: 'food_web' },
  food_chain:           { subject: 'biology', type: 'food_chain' },
  ecological_pyramid:   { subject: 'biology', type: 'ecological_pyramid' },
  enzyme:               { subject: 'biology', type: 'enzyme_substrate',
                          config: { model: 'lock_and_key' } },
  enzyme_substrate:     { subject: 'biology', type: 'enzyme_substrate',
                          config: { model: 'lock_and_key' } },
  lock_and_key:         { subject: 'biology', type: 'enzyme_substrate',
                          config: { model: 'lock_and_key' } },

  // ── Physics ────────────────────────────────────────────────
  ray_diagram:          { subject: 'physics', type: 'ray_diagram' },
  converging_lens:      { subject: 'physics', type: 'ray_diagram' },
  diverging_lens:       { subject: 'physics', type: 'ray_diagram' },
  wave:                 { subject: 'physics', type: 'wave_diagram' },
  wave_diagram:         { subject: 'physics', type: 'wave_diagram' },
  transverse_wave:      { subject: 'physics', type: 'wave_diagram' },
  longitudinal_wave:    { subject: 'physics', type: 'wave_diagram' },
  standing_wave:        { subject: 'physics', type: 'wave_diagram' },
  magnetic_field:       { subject: 'physics', type: 'magnetic_field' },
  bar_magnet:           { subject: 'physics', type: 'magnetic_field' },
  solenoid:             { subject: 'physics', type: 'magnetic_field' },
  nuclear_decay:        { subject: 'physics', type: 'nuclear_decay' },
  alpha_decay:          { subject: 'physics', type: 'nuclear_decay' },
  beta_decay:           { subject: 'physics', type: 'nuclear_decay' },
  em_spectrum:                  { subject: 'physics', type: 'electromagnetic_spectrum' },
  electromagnetic_spectrum:     { subject: 'physics', type: 'electromagnetic_spectrum' },

  // ── Chemistry ──────────────────────────────────────────────
  titration:            { subject: 'chemistry', type: 'titration' },
  reflux:               { subject: 'chemistry', type: 'reflux' },
  electrolysis:         { subject: 'chemistry', type: 'electrolysis' },
  dot_cross:            { subject: 'chemistry', type: 'dot_cross' },
  chromatography:       { subject: 'chemistry', type: 'chromatography' },

  // ── Economics ──────────────────────────────────────────────
  supply_demand:        { subject: 'economics', type: 'supply_demand' },
  supply_and_demand:    { subject: 'economics', type: 'supply_demand' },
  ppf:                  { subject: 'economics', type: 'ppf' },
  production_possibility: { subject: 'economics', type: 'ppf' },
  lorenz_curve:         { subject: 'economics', type: 'lorenz_curve' },
  gini:                 { subject: 'economics', type: 'lorenz_curve' },
  break_even:           { subject: 'economics', type: 'break_even' },

  // ── Maths ──────────────────────────────────────────────────
  probability_tree:     { subject: 'maths', type: 'probability_tree' },
  tree_diagram:         { subject: 'maths', type: 'probability_tree' },
  venn_diagram:         { subject: 'maths', type: 'venn_two' },
  venn:                 { subject: 'maths', type: 'venn_two' },
  venn_two:             { subject: 'maths', type: 'venn_two' },
  venn_three:           { subject: 'maths', type: 'venn_three' },
  two_way_table:        { subject: 'maths', type: 'two_way_table' },
  sample_space:         { subject: 'maths', type: 'sample_space' },
};

export const resolveDiagramSignal = (typeKey: string): DiagramSignal | null => {
  if (!typeKey) return null;
  const lower = typeKey.toLowerCase().replace(/[-\s]+/g, '_');
  return DIAGRAM_KEYWORD_MAP[lower] ?? null;
};

/**
 * Parse a raw fenced diagram payload (the body of a ```diagram block).
 * Accepts either a JSON object {"type":"plant_cell", ...overrides} or just a
 * bare type name on one line.
 */
export const parseDiagramPayload = (raw: string): DiagramSignal | null => {
  const text = raw.trim();
  if (!text) return null;
  try {
    if (text.startsWith('{')) {
      const obj = JSON.parse(text);
      if (typeof obj?.type === 'string') {
        const base = resolveDiagramSignal(obj.type);
        if (!base) return null;
        const { type: _t, ...overrides } = obj;
        return {
          ...base,
          config: { ...(base.config ?? {}), ...overrides },
        };
      }
      return null;
    }
    // Bare token
    return resolveDiagramSignal(text);
  } catch {
    return null;
  }
};
