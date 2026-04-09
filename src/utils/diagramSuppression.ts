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
];

// Topics that always benefit from a circuit diagram
const ALWAYS_DIAGRAM_TOPICS = [
  'series circuit', 'parallel circuit', 'potential divider',
  'voltage divider', 'wheatstone bridge', 'kirchhoff',
  'current divider', 'rc circuit', 'rl circuit', 'lc circuit',
  'rlc circuit', 'ac circuit',
  'capacitor circuit', 'inductor circuit',
  'series-parallel', 'ladder network', 'bridge circuit',
  'phasor diagram', 'phasor_diagram',
  'delta vs wye', 'wye vs delta', 'delta/wye comparison',
  'delta_wye_comparison',
];

export const shouldSuppressDiagram = (
  topicName: string,
  questionText: string,
  subjectName: string,
): boolean => {
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
