// FILE: supabase/functions/_shared/electrical-instructions.ts
// Electrical/physics prompt instructions and diagram-topic detection,
// extracted verbatim from generate-practice-questions (Phase 2 refactor).

// ── DIAGRAM SUPPRESSION — prevent timeouts on theoretical topics ──
export const SUPPRESS_DIAGRAM_TOPICS = [
      'thevenin', 'norton', 'superposition', 'blondel', 'reciprocity', 'maximum power transfer', 'millman', 'tellegen', 'compensation',
      'three-phase', 'three phase', 'star-delta', 'star to star',
      'unbalanced load', 'unconnected neutral', 'neutral point', 'sequence component', 'positive sequence', 'negative sequence', 'zero sequence',
      'phasor analysis', 'phasor theory', 'argand', 'polar form', 'rectangular form', 'complex notation', 'j notation', 'sinusoidal', 'phase angle', 'power factor angle',
      'power factor', 'reactive power', 'apparent power', 'real power', 'active power', 'power triangle', 'power measurement', 'power calculation',
      'kvar', 'kva ', 'power correction', 'pfc capacitor', 'blondel theorem',
      'transformer', 'nameplate', 'turns ratio', 'voltage ratio', 'tap changer', 'tap-changer', 'cooling method', 'impedance voltage', 'transformer impedance',
      'mesh analysis', 'nodal analysis', 'mesh current', 'node voltage', 'determinant', 'matrix method', 'cramer', 'gaussian', 'simultaneous equation',
      'impedance triangle', 'admittance', 'susceptance', 'conductance', 'complex impedance', 'r + jx', 'z = ', 'rlc theory',
      'angular frequency', 'resonant frequency',
      'bandwidth', 'quality factor', 'q factor', 'frequency response', 'bode',
    ];
export const ALWAYS_DIAGRAM_TOPICS = [
      'series circuit', 'parallel circuit', 'potential divider', 'voltage divider', 'wheatstone bridge', 'kirchhoff',
      'current divider', 'rc circuit', 'rl circuit', 'lc circuit', 'rlc circuit', 'ac circuit',
      'capacitor circuit', 'inductor circuit',
      'series-parallel', 'ladder network', 'bridge circuit',
      'phasor diagram', 'phasor_diagram',
      'delta vs wye', 'wye vs delta', 'delta/wye comparison', 'delta_wye_comparison',
    ];

export interface DiagramTopicFlags {
  hasDiagramTopic: boolean;
  hasSuppressedTopic: boolean;
  hasPhasorTopic: boolean;
  hasDeltaWyeTopic: boolean;
}

export function detectDiagramTopics(subtopics: string[], notes: string): DiagramTopicFlags {
  const topicsCombined = (subtopics.join(' ') + ' ' + (notes || '')).toLowerCase();
  const hasDiagramTopic = ALWAYS_DIAGRAM_TOPICS.some(t => topicsCombined.includes(t));
  const hasSuppressedTopic = !hasDiagramTopic && SUPPRESS_DIAGRAM_TOPICS.some(t => topicsCombined.includes(t));
  const hasPhasorTopic = topicsCombined.includes('phasor diagram') || topicsCombined.includes('phasor_diagram');
  const hasDeltaWyeTopic = /delta.*wye|wye.*delta|delta\/wye|delta_wye|delta-star|star-delta/i.test(topicsCombined);
  return { hasDiagramTopic, hasSuppressedTopic, hasPhasorTopic, hasDeltaWyeTopic };
}

export function buildDiagramSuppressionNotice(hasSuppressedTopic: boolean): string {
  return hasSuppressedTopic ? `
## ABSOLUTE RULE — NO DIAGRAM REFERENCES
No circuit diagram will be shown. You MUST NOT write:
- "in the circuit shown below"
- "consider the circuit below"
- "refer to the circuit"
- "as shown in the figure"
- "from the network below"
- ANY phrase suggesting a diagram will be visible

THIS IS NON-NEGOTIABLE. Questions saying "circuit below" with no circuit will be automatically deleted from the exam.

FOR SUPERPOSITION / THEVENIN / NORTON / NODAL / MESH QUESTIONS:
You MUST describe the complete circuit topology in the question text.
Include: component values, connection topology, source types and values.

CORRECT example for superposition:
"A circuit contains a 10 V voltage source, a 2 A current source, and three resistors: R1 = 6Ω connected in series with the voltage source, R2 = 4Ω connected between the junction of R1 and the current source, and R3 = 3Ω connected from that junction to ground. The 2A current source is connected in parallel with R3. Using the Superposition Theorem, determine the current through R2."

WRONG example (will be deleted):
"Using the Superposition Theorem, determine the current through the 4Ω resistor in the circuit below."

If you cannot describe the circuit topology in text alone for a given theorem question then generate a DIFFERENT question type instead — for example a power calculation or impedance calculation that does not require a circuit diagram.
` : '';
}

export function buildPhasorInstructions(hasPhasorTopic: boolean): string {
  return hasPhasorTopic ? `
## PHASOR DIAGRAM GENERATION
For questions involving phasor diagrams:
- Set question_type to "short_answer" NOT "graph_plotting"
- The student reads the phasor diagram and answers analytically
- Generate a diagramConfig with type "phasor_diagram"
- Include every phasor mentioned in the question
- angleDeg follows standard convention: positive = anticlockwise from positive real axis
- magnitude is the RMS or peak value given in the question
- Use blue (#3b82f6) for voltage phasors, red (#ef4444) for current phasors, green (#22c55e) for impedance phasors
Example for V = 100 at 30 degrees and I = 5 at -15 degrees:
{
  "type": "phasor_diagram",
  "title": "Phasor diagram",
  "phasors": [
    {"magnitude": 100, "angleDeg": 30, "label": "V", "colour": "#3b82f6"},
    {"magnitude": 5, "angleDeg": -15, "label": "I", "colour": "#ef4444"}
  ]
}
The question should then ask the student to:
- Calculate the phase difference between V and I
- State which phasor leads and by how much
- Calculate apparent power S = VI*
- NOT ask them to "draw" or "represent" the phasors — the diagram is shown to them
` : '';
}

export function buildNodalAnalysisInstruction(isElectricalEngineering: boolean): string {
  return isElectricalEngineering ? `
## NODAL/MESH ANALYSIS QUESTIONS
For nodal or mesh analysis questions without diagrams:
The question MUST specify:
1. How many nodes exist and their labels (V1, V2, Va etc)
2. Which components connect between which nodes
3. All component values (resistance, impedance, source voltages)
4. Which node is the reference (ground)
Minimum information required for a solvable nodal analysis question:
"A circuit has nodes V1 and V2 with ground as reference. Between V1 and ground: 10 ohm resistor. Between V2 and ground: 5 ohm resistor. Between V1 and V2: 4 ohm resistor. A 20V source connects from ground to V1. Using nodal analysis, find V1 and V2."
Never write a nodal analysis question that only says "use the network shown" — all topology must be in the text.
` : '';
}

export function buildDeltaWyeInstructions(hasDeltaWyeTopic: boolean): string {
  return hasDeltaWyeTopic ? `
## DELTA VS WYE COMPARISON DIAGRAM
For delta vs wye comparison questions:
- Set diagramConfig: { "type": "delta_wye_comparison" }
- No other fields are needed — the diagram is static
- Use the diagram as a reference comparison, not as something the student must draw
` : '';
}
