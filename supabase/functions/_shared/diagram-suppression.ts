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
];

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
