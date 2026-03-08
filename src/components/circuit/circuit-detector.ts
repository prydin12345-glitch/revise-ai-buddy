import type { CircuitConfig, CircuitComponentType } from './types';

/**
 * Detects a circuit diagram config from question text and builds
 * a proper multi-node layout with parallel branches where needed.
 */
export function detectCircuitConfig(questionText: string): CircuitConfig | null {
  const text = questionText.toLowerCase();

  // Check if circuit-related
  const circuitKeywords = [
    'circuit', 'resistor', 'resistance', 'voltmeter', 'ammeter',
    'battery', 'cell', 'lamp', 'bulb', 'switch', 'diode',
    'emf', 'potential difference', 'internal resistance',
    'series', 'parallel', 'connected in'
  ];
  if (!circuitKeywords.some(kw => text.includes(kw))) return null;

  // Exclude mechanics questions
  const mechExclude = ['inclined plane', 'slope', 'pulley', 'beam', 'rod', 'projectile', 'tension'];
  if (mechExclude.some(kw => text.includes(kw))) return null;

  // ── Extract values from the question text ──

  // EMF
  const emfMatch = text.match(/(?:battery|cell|emf|e\.m\.f\.?)\s*(?:of\s*)?(?:=\s*)?(\d+\.?\d*)\s*v/i);
  const emfLabel = emfMatch ? `ε = ${emfMatch[1]}V` : 'ε';

  // Internal resistance
  const intResMatch = text.match(/internal\s+resistance\s*(?:of\s*)?(?:=\s*)?(\d+\.?\d*)\s*(?:Ω|ohm|ω)/i);
  const hasInternalRes = !!intResMatch;
  const intResLabel = intResMatch ? `r = ${intResMatch[1]}Ω` : 'r';

  // Resistors — extract all with values
  const resistors: { label: string; value: string }[] = [];
  // Pattern: R₁ = 12Ω or R1 = 12 Ω or resistor of 12Ω etc.
  const rPatterns = [
    /R[₁1]\s*=\s*(\d+\.?\d*)\s*(?:Ω|ohm|ω)/gi,
    /R[₂2]\s*=\s*(\d+\.?\d*)\s*(?:Ω|ohm|ω)/gi,
    /R[₃3]\s*=\s*(\d+\.?\d*)\s*(?:Ω|ohm|ω)/gi,
    /R[₄4]\s*=\s*(\d+\.?\d*)\s*(?:Ω|ohm|ω)/gi,
  ];
  const subscripts = ['₁', '₂', '₃', '₄'];
  for (let i = 0; i < rPatterns.length; i++) {
    const m = rPatterns[i].exec(questionText);
    if (m) {
      resistors.push({ label: `R${subscripts[i]} = ${m[1]}Ω`, value: m[1] });
    }
  }

  // Fallback: generic "resistor of X Ω" or "resistance X Ω"
  if (resistors.length === 0) {
    const genericMatches = questionText.matchAll(/(?:resistor|resistance)\s*(?:of\s*)?(\d+\.?\d*)\s*(?:Ω|ohm)/gi);
    let idx = 0;
    for (const m of genericMatches) {
      resistors.push({ label: `R${subscripts[idx] || ''} = ${m[1]}Ω`, value: m[1] });
      idx++;
    }
  }

  // If still nothing, try bare "X Ω" near resistor context
  if (resistors.length === 0) {
    const bareMatch = text.match(/(\d+\.?\d*)\s*(?:Ω|ohm)/);
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

/**
 * Parallel resistor circuit: R1 and R2 in parallel, optionally R3 in series.
 * Uses the user-provided grid layout pattern.
 */
function buildParallelResistorCircuit(
  resistors: { label: string }[],
  emfLabel: string,
  hasInternalRes: boolean,
  intResLabel: string,
  hasAmmeter: boolean,
  hasVoltmeter: boolean,
): CircuitConfig {
  const nodes = [
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
    // Parallel branch 1: TM → MM (vertical)
    wires.push({ from: 'TM', to: 'MM', component: 'resistor', label: resistors[0].label });
    // Parallel branch 2: MR ← MM (horizontal) — but we need TM→MR path too
    wires.push({ from: 'MM', to: 'ML', component: 'wire' });
    wires.push({ from: 'MM', to: 'MR', component: 'resistor', label: resistors[1].label });
    wires.push({ from: 'MR', to: 'BR', component: 'wire' });

    junctions.push({ at: 'TM' }, { at: 'MM' }, { at: 'MR' });
  } else {
    // R1 & R2 in parallel only
    wires.push({ from: 'TL', to: 'TR', component: 'wire' });
    wires.push({ from: 'TR', to: 'MR', component: 'wire' });
    // Branch 1: top
    wires.push({ from: 'TL', to: 'ML', component: 'wire' });
    wires.push({ from: 'ML', to: 'MR', component: 'resistor', label: resistors[0].label });
    // Branch 2: bottom  
    wires.push({ from: 'TL', to: 'BL', component: 'wire' });
    wires.push({ from: 'BL', to: 'BR', component: 'resistor', label: resistors[1].label });
    wires.push({ from: 'BR', to: 'TR', component: 'wire' });

    // Use simpler layout
    nodes.length = 0;
    nodes.push(
      { id: 'TL', col: 0, row: 0 },
      { id: 'TR', col: 4, row: 0 },
      { id: 'ML', col: 0, row: 2 },
      { id: 'MR', col: 4, row: 2 },
      { id: 'BL', col: 0, row: 4 },
      { id: 'BR', col: 4, row: 4 },
    );

    junctions.push({ at: 'TL' }, { at: 'TR' });
  }

  // Bottom return wire with battery (and optional internal resistance)
  if (hasInternalRes) {
    wires.push({ from: 'BR', to: 'BL', component: 'resistor', label: intResLabel });
    wires.push({ from: 'BL', to: 'TL', component: 'battery', label: emfLabel });
  } else {
    wires.push({ from: 'BR', to: 'BL', component: 'wire' });
    wires.push({ from: 'BL', to: 'TL', component: 'battery', label: emfLabel });
  }

  // Optional ammeter in series on top wire
  if (hasAmmeter) {
    nodes.push({ id: 'AT', col: 1, row: 0 });
    // Insert ammeter between TL and next node
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
  hasAmmeter: boolean,
): CircuitConfig {
  const nodes = [
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
    nodes.push({ id: 'IR', col: 2, row: 0 });
    // Add internal resistance in series with battery
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
  // Count total components to place
  const totalComponents = resistors.length + lampCount + (hasAmmeter ? 1 : 0) + (hasSwitch ? 1 : 0);
  
  // Build a rectangular layout with components distributed around the perimeter
  // Top row: battery (+ internal resistance)
  // Right side: wire down
  // Bottom row: components in series
  // Left side: wire up (with optional ammeter)

  const nodes: CircuitConfig['nodes'] = [];
  const wires: CircuitConfig['wires'] = [];

  // Determine how many columns we need for the bottom row
  const bottomSlots = Math.max(totalComponents, 1);
  const cols = Math.max(3, bottomSlots + 1);

  // Top-left and top-right
  nodes.push({ id: 'TL', col: 0, row: 0 });

  if (hasInternalRes) {
    nodes.push({ id: 'TM', col: Math.floor(cols / 2), row: 0 });
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
  let colPos = cols;
  const componentList: { type: CircuitComponentType; label: string }[] = [];

  // Add resistors
  resistors.forEach(r => componentList.push({ type: 'resistor', label: r.label }));
  // Add lamps
  for (let i = 0; i < lampCount; i++) {
    componentList.push({ type: 'lamp', label: lampCount > 1 ? `L${subscripts[i] || i + 1}` : '' });
  }

  const step = cols / (componentList.length + 1);
  componentList.forEach((comp, i) => {
    colPos = Math.round(cols - (i + 1) * step);
    if (colPos < 0) colPos = 0;
    const nodeId = `B${i}`;
    nodes.push({ id: nodeId, col: colPos, row: 2 });
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
    // Place voltmeter across the first component
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

const subscripts = ['₁', '₂', '₃', '₄', '₅'];
