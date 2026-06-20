// FILE: supabase/functions/_shared/circuit-validation.ts
// Single source of truth for circuit components on the server side, plus a
// deterministic validator/repairer. The renderer (src/components/circuit)
// stays the visual source of truth; this list must match its CircuitComponentType
// union and the switch in symbols.tsx. When you add a component, add it in BOTH
// places.
//
// Philosophy mirrors the graph pipeline: the AI proposes a circuit, this code
// disposes — anything that would render as a dropped wire or a red "?" box is
// caught here and either repaired or the diagram is nulled so the question
// degrades to text rather than showing a broken figure to a student.

export const CIRCUIT_COMPONENTS = {
  dc: ['battery', 'resistor', 'variable_resistor', 'thermistor', 'lamp', 'voltmeter', 'ammeter', 'switch_open', 'switch_closed', 'diode', 'motor', 'fuse', 'galvanometer'],
  ac: ['ac_source', 'inductor', 'capacitor', 'impedance', 'current_source'],
  universal: ['wire', 'ground', 'open_terminal', 'junction'],
} as const;

export const ALL_CIRCUIT_COMPONENTS: string[] = [
  ...CIRCUIT_COMPONENTS.dc,
  ...CIRCUIT_COMPONENTS.ac,
  ...CIRCUIT_COMPONENTS.universal,
];

// A few common synonyms the model emits — mapped to the real component so a
// near-miss becomes a correct render instead of a "?" box.
const COMPONENT_ALIASES: Record<string, string> = {
  cell: 'battery',
  emf_source: 'battery',
  dc_source: 'battery',
  voltage_source: 'battery',
  bulb: 'lamp',
  light: 'lamp',
  globe: 'lamp',
  switch: 'switch_open',
  open_switch: 'switch_open',
  closed_switch: 'switch_closed',
  rheostat: 'variable_resistor',
  potentiometer: 'variable_resistor',
  ldr: 'thermistor',
  coil: 'inductor',
  cap: 'capacitor',
  amp_meter: 'ammeter',
  volt_meter: 'voltmeter',
  galvo: 'galvanometer',
  ac: 'ac_source',
};

export interface CircuitValidationResult {
  ok: boolean;
  repaired: boolean;
  reasons: string[];
  config: any | null; // repaired config, or null if unsalvageable
}

/**
 * Validate (and lightly repair) a circuit diagramConfig.
 * Returns config=null when the circuit cannot be safely rendered, so the
 * caller can drop the diagram and let the question stand as text.
 */
export function validateCircuitConfig(config: any): CircuitValidationResult {
  const reasons: string[] = [];
  let repaired = false;

  if (!config || typeof config !== 'object') {
    return { ok: false, repaired: false, reasons: ['no config'], config: null };
  }
  // Static comparison diagrams are valid as-is.
  if (config.type && config.type !== 'circuit') {
    return { ok: true, repaired: false, reasons: [], config };
  }

  const nodes = Array.isArray(config.nodes) ? config.nodes : [];
  const wires = Array.isArray(config.wires) ? config.wires : [];

  if (nodes.length < 2) {
    return { ok: false, repaired: false, reasons: ['fewer than 2 nodes'], config: null };
  }
  if (wires.length < 2) {
    return { ok: false, repaired: false, reasons: ['fewer than 2 wires'], config: null };
  }

  const nodeIds = new Set<string>();
  for (const n of nodes) {
    if (n && typeof n.id === 'string') nodeIds.add(n.id);
  }

  // 1. Map component aliases and reject wires with unknown components or
  //    missing node endpoints. A wire we can't render is dropped; if dropping
  //    it breaks the circuit (below minimum) we null the whole diagram.
  const cleanWires: any[] = [];
  for (const w of wires) {
    if (!w || typeof w !== 'object') { reasons.push('malformed wire'); repaired = true; continue; }
    if (!nodeIds.has(w.from) || !nodeIds.has(w.to)) {
      reasons.push(`wire references missing node (${w.from}->${w.to})`);
      repaired = true;
      continue; // unrenderable — drop it
    }
    let component = typeof w.component === 'string' ? w.component : 'wire';
    if (!ALL_CIRCUIT_COMPONENTS.includes(component)) {
      const alias = COMPONENT_ALIASES[component.toLowerCase()];
      if (alias) { component = alias; repaired = true; reasons.push(`aliased "${w.component}"→"${alias}"`); }
      else { component = 'wire'; repaired = true; reasons.push(`unknown component "${w.component}" → wire`); }
    }
    cleanWires.push({ ...w, component });
  }

  if (cleanWires.length < 2) {
    return { ok: false, repaired: true, reasons: [...reasons, 'too few wires after cleaning'], config: null };
  }

  // 2. Closed-loop check: every node that carries a wire must have degree >= 2,
  //    otherwise it's a dangling stub (open circuit) the renderer shows oddly.
  const degree = new Map<string, number>();
  for (const w of cleanWires) {
    degree.set(w.from, (degree.get(w.from) ?? 0) + 1);
    degree.set(w.to, (degree.get(w.to) ?? 0) + 1);
  }
  // Allow voltmeter/ground/open_terminal endpoints to be degree-1 (they're
  // legitimately terminal), but any other stub means a broken loop.
  const terminalOk = new Set(['voltmeter', 'ground', 'open_terminal']);
  let danglingStubs = 0;
  for (const [id, deg] of degree) {
    if (deg < 2) {
      const attached = cleanWires.find(w => w.from === id || w.to === id);
      if (!attached || !terminalOk.has(attached.component)) danglingStubs++;
    }
  }
  if (danglingStubs > 0) {
    reasons.push(`${danglingStubs} dangling node(s) — circuit not a closed loop`);
    // A non-closed loop is misleading in an exam; safer to drop the figure.
    return { ok: false, repaired: true, reasons, config: null };
  }

  // 3. Ensure junctions referenced exist; drop stale ones rather than fail.
  let junctions = Array.isArray(config.junctions) ? config.junctions : [];
  const cleanJunctions = junctions.filter((j: string) => nodeIds.has(j));
  if (cleanJunctions.length !== junctions.length) { repaired = true; reasons.push('removed stale junctions'); }

  return {
    ok: true,
    repaired,
    reasons,
    config: { ...config, wires: cleanWires, junctions: cleanJunctions },
  };
}

/** Build the component-list portion of the prompt from the source of truth, so
 *  the prompt can never advertise a component the renderer doesn't support. */
export function buildComponentListForPrompt(): string {
  return [
    `DC: ${CIRCUIT_COMPONENTS.dc.map(c => `"${c}"`).join(', ')}`,
    `AC: ${CIRCUIT_COMPONENTS.ac.map(c => `"${c}"`).join(', ')}`,
    `Universal: ${['wire', 'ground', 'open_terminal'].map(c => `"${c}"`).join(', ')}`,
  ].join('\n');
}
