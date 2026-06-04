/**
 * Topic-based diagram suppression for circuit diagrams.
 * Prevents the renderer from attempting to draw diagrams for
 * theoretical, mathematical, or explanatory topics that don't
 * need visual circuit representations.
 */

// Topics that never need a circuit diagram
const SUPPRESS_DIAGRAM_TOPICS = [
  // Theorems and laws — explained in text/equations not diagrams
  'thevenin', 'norton', 'superposition', 'blondel',
  'reciprocity', 'maximum power transfer', 'millman',
  'tellegen', 'compensation',

  // Three-phase theory — too complex for current renderer
  'three-phase', 'three phase', 'star-delta', 'star to star',
  'unbalanced load', 'unconnected neutral', 'neutral point',
  'sequence component', 'positive sequence', 'negative sequence',
  'zero sequence',

  // Phasor analysis — purely mathematical (but NOT 'phasor diagram' which is now renderable)
  'phasor analysis', 'phasor theory', 'argand', 'polar form',
  'rectangular form', 'complex notation', 'j notation',
  'sinusoidal', 'phase angle', 'power factor angle',

  // Power calculations — purely mathematical
  'power factor', 'reactive power', 'apparent power',
  'real power', 'active power', 'power triangle',
  'power measurement', 'power calculation', 'var ',
  'kvar', 'kva ', 'power correction', 'pfc capacitor',
  'blondel theorem',

  // Transformer theory
  'transformer', 'nameplate', 'turns ratio', 'voltage ratio',
  'tap changer', 'tap-changer', 'cooling method', 'impedance voltage',
  'transformer impedance', 'group 4', 'dy11', 'yn',

  // Advanced analysis methods — algebraic not visual
  'mesh analysis', 'nodal analysis', 'mesh current',
  'node voltage', 'determinant', 'matrix method',
  'cramer', 'gaussian', 'simultaneous equation',

  // Impedance/reactance theory — only suppress pure theory, not circuit problems
  'impedance triangle', 'admittance',
  'susceptance', 'conductance', 'complex impedance',
  'r + jx', 'z = ', 'rlc theory',

  // Frequency domain — pure theory
  'angular frequency', 'resonant frequency',
  'bandwidth', 'quality factor', 'q factor',
  'frequency response', 'bode',

  // Material property calculations — formula questions, not circuit diagrams
  'resistivity',
  'cross-sectional area',
  'drift velocity',
  'charge carriers per',
  'mean free path',

  // Concept/characteristic questions — no specific circuit topology needed
  'current-voltage characteristic',
  'i-v characteristic',
  'iv characteristic',
  'does not obey ohm',
  'non-ohmic',
  'filament lamp characteristic',
  'describe the resistance',
  'explain the resistance of',
];

// Topics that always benefit from a circuit diagram
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
  // NOTE: 'kirchhoff' removed — Kirchhoff questions only need a circuit
  // when actual component values are provided, handled by detector logic
];

// ── Concept-only question detection ──

// Questions about general component behaviour that don't need
// a circuit diagram — the behaviour is the same regardless of topology
const CONCEPT_ONLY_PATTERNS = [
  // Characteristic curve questions
  /describe the (current[- ]voltage|i[- ]v|voltage[- ]current) characteristic/i,
  /sketch (a |the )?(current[- ]voltage|i[- ]v) (graph|characteristic|curve)/i,
  /explain (the shape of |why )?the (i[- ]v|current[- ]voltage) (graph|curve|characteristic)/i,

  // Ohm's law conceptual questions
  /explain why .{0,60} (does not|doesn'?t) obey ohm'?s law/i,
  /explain why .{0,60} is (not |non-?)ohmic/i,
  /state ohm'?s law/i,
  /define (resistance|resistivity|conductance|conductivity)\b/i,

  // Pure definition or description questions with no circuit context
  /^(state|define|what is meant by|explain what is meant by) (resistance|resistivity|conductance|current|voltage|potential difference|electromotive force|emf|internal resistance)\b/i,

  // Explanation of why resistance changes — no specific circuit needed
  /explain why (the |a )?(resistance|resistivity) (of |changes|increases|decreases)/i,
  /explain (how|why) (temperature|light|resistance) affects/i,

  // Filament lamp explain questions
  /explain why (a |the )?(filament lamp|light bulb|lamp) (does not|doesn'?t)/i,
  /describe (how |why )?(the )?(resistance of (a |the )?filament)/i,

  // Heater/power questions that are pure calculation
  /^an? (electrical |)heater (is rated|rated at|operating)/i,
  /calculate the (current drawn|power|resistance) (of|by|when) (the |an? )?(heater|element|lamp|bulb)/i,

  // Terminal PD explanation — conceptual, no circuit needed
  /explain why (the )?terminal (potential difference|p\.?d\.?|voltage) (of |from )?(a |the )?(battery|cell|source)? ?(decreases|increases|drops|falls)/i,

  // AC conceptual explanations
  /explain why current (leads|lags) (the )?voltage/i,
  /explain why (the )?voltage (leads|lags) (the )?current/i,
  /state (the )?conditions? for resonance/i,
  /explain (what (is meant by|happens at) )?resonance (in|of) (a |an )?series/i,

  // Kirchhoff's law statements — stating the law is conceptual
  /^state (kirchhoff'?s? ?(current|voltage|first|second) law)/i,
  /^state (both |the two )?kirchhoff'?s? laws/i,

  // Power factor and impedance definitions
  /define (the term )?(power factor|impedance|admittance|reactance)/i,
  /what is meant by (power factor|impedance|admittance)/i,

  // General law/definition questions
  /^(state|define|give|write down|what is) (the )?(law of|equation for|formula for)/i,

  // Box plot / statistics concept-only questions
  /^(explain|state|define|describe) (what (is meant by|a)|the (purpose|advantage|disadvantage) of) (a |the )?box.?plot/i,
  /^(state one (advantage|disadvantage)|compare).{0,30}(box.?plot|histogram)/i,
  /^explain (what|why) the (median|iqr|interquartile range|quartile) (represents|shows|tells)/i,
];

// Phrases that confirm a specific circuit arrangement is described —
// if present, the question is NOT concept-only even if it matches a pattern above
const CIRCUIT_CONTEXT_PHRASES = [
  'circuit contains',
  'circuit consists',
  'connected in series',
  'connected in parallel',
  'the circuit shown',
  'the circuit below',
  'potential divider',
  'voltage divider',
  'connected to a',
  'in the circuit',
  'the following circuit',
  'figure shows',
  'as shown',
  'connected between',
  'across the',
  // Explicit requests to draw or sketch a circuit override suppression
  'sketch the circuit',
  'draw the circuit',
  'draw a circuit',
  'sketch a circuit',
  'circuit diagram for',
  'circuit you would use',
  'set up a circuit',
  'design a circuit',
];

/**
 * Detects whether a question is purely conceptual and does not need
 * a circuit diagram, even if it mentions electrical components.
 */
export const isConceptOnlyQuestion = (questionText: string): boolean => {
  const text = questionText.trim();
  const lower = text.toLowerCase();

  // If the question explicitly asks to sketch or draw a circuit — never suppress
  if (/\b(sketch|draw|construct|set up|design)\b.{0,40}\bcircuit\b/i.test(text)) {
    return false;
  }

  // If the question describes a specific circuit arrangement — never suppress
  const hasCircuitContext = CIRCUIT_CONTEXT_PHRASES.some(phrase =>
    lower.includes(phrase.toLowerCase())
  );
  if (hasCircuitContext) return false;

  // Check if it matches a concept-only pattern
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
  if (isBiology && (diagramType === 'circuit' || diagramType === 'circuit_diagram')) {
    return true;
  }

  const combined = `${topicName} ${questionText} ${subjectName}`.toLowerCase();

  // If it matches an always-diagram topic, never suppress
  const alwaysDiagram = ALWAYS_DIAGRAM_TOPICS.some(t =>
    combined.includes(t.toLowerCase())
  );
  if (alwaysDiagram) return false;

  // If it matches a suppress topic, suppress the diagram
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
