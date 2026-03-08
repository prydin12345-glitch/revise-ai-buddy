import type { CircuitConfig, CircuitComponentType } from './types';

/**
 * Strip LaTeX markup so regex can match plain values.
 * "$R_1$ of resistance $12.0 \, \Omega$" → "R₁ of resistance 12.0 Ω"
 */
function stripLatex(raw: string): string {
  let s = raw;
  // Remove \text{...} wrappers
  s = s.replace(/\\text\{([^}]*)\}/g, '$1');
  // Remove \, spacing commands
  s = s.replace(/\\,/g, ' ');
  // \Omega → Ω
  s = s.replace(/\\Omega/g, 'Ω');
  // Convert subscripts: R_1 or R_{1} → R₁
  s = s.replace(/R_\{?1\}?/g, 'R₁');
  s = s.replace(/R_\{?2\}?/g, 'R₂');
  s = s.replace(/R_\{?3\}?/g, 'R₃');
  s = s.replace(/R_\{?4\}?/g, 'R₄');
  s = s.replace(/L_\{?1\}?/g, 'L₁');
  s = s.replace(/L_\{?2\}?/g, 'L₂');
  // Strip remaining $ delimiters
  s = s.replace(/\$/g, '');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ');
  return s;
}

/**
 * Detects a circuit diagram config from question text and builds
 * a proper multi-node layout with parallel branches where needed.
 */
export function detectCircuitConfig(questionText: string): CircuitConfig | null {
  const cleaned = stripLatex(questionText);
  const text = cleaned.toLowerCase();

  // Check if circuit-related
  const circuitKeywords = [
    'circuit', 'resistor', 'resistance', 'voltmeter', 'ammeter',
    'battery', 'cell', 'lamp', 'bulb', 'switch', 'diode',
    'emf', 'e.m.f', 'potential difference', 'internal resistance',
    'series', 'parallel', 'connected in'
  ];
  if (!circuitKeywords.some(kw => text.includes(kw))) return null;

  // Exclude mechanics questions
  const mechExclude = ['inclined plane', 'slope', 'pulley', 'beam', 'rod', 'projectile', 'tension'];
  if (mechExclude.some(kw => text.includes(kw))) return null;

  // Also skip graph-plotting / I-V characteristic questions
  if (text.includes('plot a graph') || text.includes('i-v characteristic') || text.includes('use your graph')) return null;

  // ── Extract values from the cleaned text ──

  // EMF
  const emfMatch = cleaned.match(/(?:battery|cell|emf|e\.m\.f\.?)\s*(?:of\s*)?(?:=\s*)?(\d+\.?\d*)\s*V/i)
    || cleaned.match(/electromotive\s+force[^.]*?(\d+\.?\d*)\s*V/i);
  const emfLabel = emfMatch ? `ε = ${emfMatch[1]}V` : 'ε';

  // Internal resistance
  const intResMatch = cleaned.match(/internal\s+resistance\s*(?:of\s*)?(?:=\s*)?(\d+\.?\d*)\s*Ω/i);
  const hasInternalRes = !!intResMatch;
  const intResLabel = intResMatch ? `r = ${intResMatch[1]}Ω` : 'r';

  // Resistors — extract all with subscript labels
  const resistors: { label: string; value: string }[] = [];
  
  // R₁ = 12.0 Ω  (after LaTeX stripping)
  const r1m = cleaned.match(/R₁[^=]*?=?\s*(?:of\s+)?(?:resistance\s+)?(?:of\s+)?(\d+\.?\d*)\s*Ω/i)
    || cleaned.match(/resistance\s+(\d+\.?\d*)\s*Ω[^.]*R₁/i)
    || cleaned.match(/R₁\s*(?:of\s+)?(?:resistance\s+)?(\d+\.?\d*)\s*Ω/i);
  if (r1m) resistors.push({ label: `R₁ = ${r1m[1]}Ω`, value: r1m[1] });

  const r2m = cleaned.match(/R₂[^=]*?=?\s*(?:of\s+)?(?:resistance\s+)?(?:of\s+)?(\d+\.?\d*)\s*Ω/i)
    || cleaned.match(/resistance\s+(\d+\.?\d*)\s*Ω[^.]*R₂/i);
  if (r2m) resistors.push({ label: `R₂ = ${r2m[1]}Ω`, value: r2m[1] });

  const r3m = cleaned.match(/R₃[^=]*?=?\s*(?:of\s+)?(?:resistance\s+)?(?:of\s+)?(\d+\.?\d*)\s*Ω/i)
    || cleaned.match(/resistance\s+(\d+\.?\d*)\s*Ω[^.]*R₃/i);
  if (r3m) resistors.push({ label: `R₃ = ${r3m[1]}Ω`, value: r3m[1] });

  // Fallback: "resistor of X Ω" or "resistance X Ω" (generic)
  if (resistors.length === 0) {
    const genericMatches = cleaned.matchAll(/(?:resistor|resistance)\s*(?:of\s*)?(\d+\.?\d*)\s*Ω/gi);
    let idx = 0;
    for (const m of genericMatches) {
      resistors.push({ label: `R${SUBSCRIPTS[idx] || ''} = ${m[1]}Ω`, value: m[1] });
      idx++;
    }
  }

  // If still nothing, try bare "X Ω" near resistor context
  if (resistors.length === 0) {
    const bareMatch = text.match(/(\d+\.?\d*)\s*ω/);
    if (bareMatch) {
      resistors.push({ label: `R = ${bareMatch[1]}Ω`, value: bareMatch[1] });
    }
  }

  // Detect components
  const hasVoltmeter = /voltmeter/.test(text);
  const hasAmmeter = /ammeter/.test(text);
  const hasSwitch = /switch/.test(text);
  const lampCount = (text.match(/\blamp|bulb\b/gi) || []).length;
  const isParallel = /parallel/.test(text);

  // ── Build circuit layout ──

  if (isParallel && resistors.length >= 2) {
    return buildParallelResistorCircuit(resistors, emfLabel, hasInternalRes, intResLabel, hasAmmeter, hasVoltmeter);
  }

  if (isParallel && (resistors.length >= 1 || lampCount >= 1)) {
    return buildSimpleParallelCircuit(resistors, lampCount, emfLabel, hasInternalRes, intResLabel, hasAmmeter);
  }

  // Default: series circuit
  return buildSeriesCircuit(resistors, lampCount, emfLabel, hasInternalRes, intResLabel, hasAmmeter, hasVoltmeter, hasSwitch);
}

const SUBSCRIPTS = ['₁', '₂', '₃', '₄', '₅'];

/**
 * Parallel resistor circuit: R1 and R2 in parallel, optionally R3 in series.
 */
function buildParallelResistorCircuit(
  resistors: { label: string }[],
  emfLabel: string,
  hasInternalRes: boolean,
  intResLabel: string,
  _hasAmmeter: boolean,
  _hasVoltmeter: boolean,
): CircuitConfig {
  const nodes: CircuitConfig['nodes'] = [
    { id: 'TL', col: 0, row: 0 },
    { id: 'TM', col: 2, row: 0 },
    { id: 'TR', col: 4, row: 0 },
    { id: 'ML', col: 0, row: 2 },
    { id: 'MM', col: 2, row: 2 },
    { id: 'MR', col: 4, row: 2 },
    { id: 'BL', col: 0, row: 4 },
    { id: 'BR', col: 4, row: 4 },
  ];

  const wires: CircuitConfig['wires'] = [];
  const junctions: CircuitConfig['junctions'] = [];

  if (resistors.length >= 3) {
    // R1 & R2 in parallel, R3 in series
    wires.push({ from: 'TL', to: 'TM', component: 'wire' });
    wires.push({ from: 'TM', to: 'TR', component: 'resistor', label: resistors[2].label });
    wires.push({ from: 'TR', to: 'MR', component: 'wire' });
    wires.push({ from: 'TM', to: 'MM', component: 'resistor', label: resistors[0].label });
    wires.push({ from: 'MM', to: 'ML', component: 'wire' });
    wires.push({ from: 'MM', to: 'MR', component: 'resistor', label: resistors[1].label });
    wires.push({ from: 'MR', to: 'BR', component: 'wire' });
    junctions.push({ at: 'TM' }, { at: 'MM' }, { at: 'MR' });
  } else {
    // R1 & R2 in parallel only
    // Top branch
    wires.push({ from: 'TL', to: 'TM', component: 'wire' });
    wires.push({ from: 'TM', to: 'TR', component: 'resistor', label: resistors[0].label });
    // Bottom branch (through middle row)
    wires.push({ from: 'TM', to: 'MM', component: 'wire' });
    wires.push({ from: 'MM', to: 'MR', component: 'resistor', label: resistors[1].label });
    wires.push({ from: 'MR', to: 'TR', component: 'wire' });
    // Right side down
    wires.push({ from: 'TR', to: 'BR', component: 'wire' });
    junctions.push({ at: 'TM' }, { at: 'TR' });
  }

  // Bottom return wire with battery (and optional internal resistance)
  if (hasInternalRes) {
    wires.push({ from: 'BR', to: 'BL', component: 'resistor', label: intResLabel });
    wires.push({ from: 'BL', to: 'TL', component: 'battery', label: emfLabel });
  } else {
    wires.push({ from: 'BR', to: 'BL', component: 'wire' });
    wires.push({ from: 'BL', to: 'TL', component: 'battery', label: emfLabel });
  }

  return { type: 'circuit', gridSpacing: 80, nodes, wires, junctions, showLabels: true };
}

/**
 * Simple parallel circuit with mixed components (lamps + resistors).
 */
function buildSimpleParallelCircuit(
  resistors: { label: string }[],
  lampCount: number,
  emfLabel: string,
  hasInternalRes: boolean,
  intResLabel: string,
  _hasAmmeter: boolean,
): CircuitConfig {
  const nodes: CircuitConfig['nodes'] = [
    { id: 'TL', col: 0, row: 0 },
    { id: 'TR', col: 4, row: 0 },
    { id: 'ML', col: 0, row: 2 },
    { id: 'MR', col: 4, row: 2 },
    { id: 'BL', col: 0, row: 4 },
    { id: 'BR', col: 4, row: 4 },
  ];

  const wires: CircuitConfig['wires'] = [
    { from: 'TL', to: 'TR', component: 'battery', label: emfLabel },
    { from: 'TR', to: 'MR', component: 'wire' },
    { from: 'MR', to: 'BR', component: 'wire' },
    { from: 'TL', to: 'ML', component: 'wire' },
    { from: 'ML', to: 'BL', component: 'wire' },
  ];

  const junctions: CircuitConfig['junctions'] = [
    { at: 'MR' },
    { at: 'ML' },
  ];

  // Branch 1 (middle row)
  if (lampCount > 0) {
    wires.push({ from: 'ML', to: 'MR', component: 'lamp', label: lampCount > 1 ? 'L₁' : '' });
  } else if (resistors.length > 0) {
    wires.push({ from: 'ML', to: 'MR', component: 'resistor', label: resistors[0].label });
  }

  // Branch 2 (bottom row)
  if (resistors.length > (lampCount > 0 ? 0 : 1)) {
    const rIdx = lampCount > 0 ? 0 : 1;
    wires.push({ from: 'BL', to: 'BR', component: 'resistor', label: resistors[rIdx]?.label || 'R' });
  } else if (lampCount > 1) {
    wires.push({ from: 'BL', to: 'BR', component: 'lamp', label: 'L₂' });
  }

  if (hasInternalRes) {
    // Add internal resistance label to existing battery wire — replace it
    wires[0] = { from: 'TL', to: 'TR', component: 'battery', label: emfLabel };
    // We'd need an extra node; for simplicity, note it in the battery label
  }

  return { type: 'circuit', gridSpacing: 80, nodes, wires, junctions, showLabels: true };
}

/**
 * Series circuit with proper node count (minimum 6 nodes).
 */
function buildSeriesCircuit(
  resistors: { label: string }[],
  lampCount: number,
  emfLabel: string,
  hasInternalRes: boolean,
  intResLabel: string,
  hasAmmeter: boolean,
  hasVoltmeter: boolean,
  hasSwitch: boolean,
): CircuitConfig {
  const nodes: CircuitConfig['nodes'] = [];
  const wires: CircuitConfig['wires'] = [];

  // Determine how many columns we need for the bottom row
  const componentList: { type: CircuitComponentType; label: string }[] = [];
  resistors.forEach(r => componentList.push({ type: 'resistor', label: r.label }));
  for (let i = 0; i < lampCount; i++) {
    componentList.push({ type: 'lamp', label: lampCount > 1 ? `L${SUBSCRIPTS[i] || i + 1}` : '' });
  }

  const bottomSlots = Math.max(componentList.length, 1);
  const cols = Math.max(3, bottomSlots + 1);

  // Top-left
  nodes.push({ id: 'TL', col: 0, row: 0 });

  if (hasInternalRes) {
    const midCol = Math.floor(cols / 2);
    nodes.push({ id: 'TM', col: midCol, row: 0 });
    nodes.push({ id: 'TR', col: cols, row: 0 });
    wires.push({ from: 'TL', to: 'TM', component: 'battery', label: emfLabel });
    wires.push({ from: 'TM', to: 'TR', component: 'resistor', label: intResLabel });
  } else {
    nodes.push({ id: 'TR', col: cols, row: 0 });
    wires.push({ from: 'TL', to: 'TR', component: 'battery', label: emfLabel });
  }

  // Right side wire down
  nodes.push({ id: 'BR', col: cols, row: 2 });
  if (hasSwitch) {
    wires.push({ from: 'TR', to: 'BR', component: 'switch_open', label: 'S' });
  } else {
    wires.push({ from: 'TR', to: 'BR', component: 'wire' });
  }

  // Bottom row: place components from right to left
  let prevNode = 'BR';
  const step = cols / (componentList.length + 1);
  componentList.forEach((comp, i) => {
    const colPos = Math.round(cols - (i + 1) * step);
    const nodeId = `B${i}`;
    nodes.push({ id: nodeId, col: Math.max(colPos, 0), row: 2 });
    wires.push({ from: prevNode, to: nodeId, component: comp.type, label: comp.label });
    prevNode = nodeId;
  });

  // Bottom-left corner
  nodes.push({ id: 'BL', col: 0, row: 2 });
  if (prevNode !== 'BL') {
    wires.push({ from: prevNode, to: 'BL', component: 'wire' });
  }

  // Left side wire up (with optional ammeter)
  if (hasAmmeter) {
    nodes.push({ id: 'AL', col: 0, row: 1 });
    wires.push({ from: 'BL', to: 'AL', component: 'ammeter', label: 'A' });
    wires.push({ from: 'AL', to: 'TL', component: 'wire' });
  } else {
    wires.push({ from: 'BL', to: 'TL', component: 'wire' });
  }

  // Optional voltmeter across a component (parallel)
  if (hasVoltmeter && componentList.length >= 1) {
    const vFromId = 'BR';
    const vToId = nodes.find(n => n.id === 'B0')?.id || 'BL';
    nodes.push({ id: 'VT', col: Math.round(cols * 0.75), row: 3 });
    nodes.push({ id: 'VB', col: Math.round(cols * 0.25), row: 3 });
    wires.push({ from: vFromId, to: 'VT', component: 'wire' });
    wires.push({ from: 'VT', to: 'VB', component: 'voltmeter', label: 'V' });
    wires.push({ from: 'VB', to: vToId, component: 'wire' });
  }

  return { type: 'circuit', gridSpacing: 80, nodes, wires, showLabels: true };
}
