/**
 * Topic-based diagram suppression for circuit diagrams.
 * Edge-function-compatible copy of src/utils/diagramSuppression.ts
 */

const SUPPRESS_DIAGRAM_TOPICS = [
  'thevenin', 'norton', 'superposition', 'blondel',
  'reciprocity', 'maximum power transfer', 'millman',
  'tellegen', 'compensation',
  'three-phase', 'three phase', 'star-delta', 'star to star',
  'unbalanced load', 'unconnected neutral', 'neutral point',
  'sequence component', 'positive sequence', 'negative sequence',
  'zero sequence',
  'phasor analysis', 'phasor theory', 'argand', 'polar form',
  'rectangular form', 'complex notation', 'j notation',
  'sinusoidal', 'phase angle', 'power factor angle',
  'power factor', 'reactive power', 'apparent power',
  'real power', 'active power', 'power triangle',
  'power measurement', 'power calculation', 'var ',
  'kvar', 'kva ', 'power correction', 'pfc capacitor',
  'blondel theorem',
  'transformer', 'nameplate', 'turns ratio', 'voltage ratio',
  'tap changer', 'tap-changer', 'cooling method', 'impedance voltage',
  'transformer impedance', 'group 4', 'dy11', 'yn',
  'mesh analysis', 'nodal analysis', 'mesh current',
  'node voltage', 'determinant', 'matrix method',
  'cramer', 'gaussian', 'simultaneous equation',
  'impedance triangle', 'admittance',
  'susceptance', 'conductance', 'complex impedance',
  'r + jx', 'z = ', 'rlc theory',
  'angular frequency', 'resonant frequency',
  'bandwidth', 'quality factor', 'q factor',
  'frequency response', 'bode',
  'resistivity',
  'cross-sectional area',
  'drift velocity',
  'charge carriers per',
  'mean free path',
  'current-voltage characteristic',
  'i-v characteristic',
  'iv characteristic',
  'does not obey ohm',
  'non-ohmic',
  'filament lamp characteristic',
  'describe the resistance',
  'explain the resistance of',
];

const ALWAYS_DIAGRAM_TOPICS = [
  'series circuit', 'parallel circuit', 'potential divider',
  'voltage divider', 'wheatstone bridge',
  'current divider', 'rc circuit', 'rl circuit', 'lc circuit',
  'rlc circuit', 'ac circuit',
  'capacitor circuit', 'inductor circuit',
  'series-parallel', 'ladder network', 'bridge circuit',
  'phasor diagram', 'phasor_diagram',
  'delta vs wye', 'wye vs delta', 'delta/wye comparison',
  'delta_wye_comparison',
];

const CONCEPT_ONLY_PATTERNS = [
  /describe the (current[- ]voltage|i[- ]v|voltage[- ]current) characteristic/i,
  /sketch (a |the )?(current[- ]voltage|i[- ]v) (graph|characteristic|curve)/i,
  /explain (the shape of |why )?the (i[- ]v|current[- ]voltage) (graph|curve|characteristic)/i,
  /explain why .{0,60} (does not|doesn'?t) obey ohm'?s law/i,
  /explain why .{0,60} is (not |non-?)ohmic/i,
  /state ohm'?s law/i,
  /define (resistance|resistivity|conductance|conductivity)\b/i,
  /^(state|define|what is meant by|explain what is meant by) (resistance|resistivity|conductance|current|voltage|potential difference|electromotive force|emf|internal resistance)\b/i,
  /explain why (the |a )?(resistance|resistivity) (of |changes|increases|decreases)/i,
  /explain (how|why) (temperature|light|resistance) affects/i,
  /explain why (a |the )?(filament lamp|light bulb|lamp) (does not|doesn'?t)/i,
  /describe (how |why )?(the )?(resistance of (a |the )?filament)/i,
  /^an? (electrical |)heater (is rated|rated at|operating)/i,
  /calculate the (current drawn|power|resistance) (of|by|when) (the |an? )?(heater|element|lamp|bulb)/i,
  /explain why (the )?terminal (potential difference|p\.?d\.?|voltage) (of |from )?(a |the )?(battery|cell|source)? ?(decreases|increases|drops|falls)/i,
  /explain why current (leads|lags) (the )?voltage/i,
  /explain why (the )?voltage (leads|lags) (the )?current/i,
  /state (the )?conditions? for resonance/i,
  /explain (what (is meant by|happens at) )?resonance (in|of) (a |an )?series/i,
  /^state (kirchhoff'?s? ?(current|voltage|first|second) law)/i,
  /^state (both |the two )?kirchhoff'?s? laws/i,
  /define (the term )?(power factor|impedance|admittance|reactance)/i,
  /what is meant by (power factor|impedance|admittance)/i,
  /^(state|define|give|write down|what is) (the )?(law of|equation for|formula for)/i,

  // Box plot / statistics concept-only questions
  /^(explain|state|define|describe) (what (is meant by|a)|the (purpose|advantage|disadvantage) of) (a |the )?box.?plot/i,
  /^(state one (advantage|disadvantage)|compare).{0,30}(box.?plot|histogram)/i,
  /^explain (what|why) the (median|iqr|interquartile range|quartile) (represents|shows|tells)/i,
];

const CIRCUIT_CONTEXT_PHRASES = [
  'circuit contains', 'circuit consists', 'connected in series',
  'connected in parallel', 'the circuit shown', 'the circuit below',
  'potential divider', 'voltage divider', 'connected to a',
  'in the circuit', 'the following circuit', 'figure shows',
  'as shown', 'connected between', 'across the',
  'sketch the circuit', 'draw the circuit', 'draw a circuit',
  'sketch a circuit', 'circuit diagram for', 'circuit you would use',
  'set up a circuit', 'design a circuit',
];

export const isConceptOnlyQuestion = (questionText: string): boolean => {
  const text = questionText.trim();
  const lower = text.toLowerCase();
  if (/\b(sketch|draw|construct|set up|design)\b.{0,40}\bcircuit\b/i.test(text)) {
    return false;
  }
  const hasCircuitContext = CIRCUIT_CONTEXT_PHRASES.some(phrase =>
    lower.includes(phrase.toLowerCase())
  );
  if (hasCircuitContext) return false;
  return CONCEPT_ONLY_PATTERNS.some(pattern => pattern.test(text));
};

export const shouldSuppressDiagram = (
  topicName: string,
  questionText: string,
  subjectName: string,
  diagramType?: string,
): boolean => {
  const lowerSubject = (subjectName || '').toLowerCase();

  // Biology subjects must never show circuit diagrams
  const isBiology =
    /biology|life.?science|human.?biology|biolog|anatomy|physiology|biomedical|health.?science|environmental.?science|marine.?biology|ecology|genetics|microbiology/i.test(
      lowerSubject,
    );
  if (isBiology && (!diagramType || diagramType === 'circuit' || diagramType === 'circuit_diagram')) {
    return true;
  }

  const combined = `${topicName} ${questionText} ${subjectName}`.toLowerCase();

  const alwaysDiagram = ALWAYS_DIAGRAM_TOPICS.some(t =>
    combined.includes(t.toLowerCase())
  );
  if (alwaysDiagram) return false;

  return SUPPRESS_DIAGRAM_TOPICS.some(t =>
    combined.includes(t.toLowerCase())
  );
};

export const getDiagramSuppressionReason = (
  topicName: string,
  questionText: string,
): string | null => {
  const combined = `${topicName} ${questionText}`.toLowerCase();
  const matched = SUPPRESS_DIAGRAM_TOPICS.find(t =>
    combined.includes(t.toLowerCase())
  );
  return matched ? `Topic contains "${matched}" — diagram suppressed` : null;
};
