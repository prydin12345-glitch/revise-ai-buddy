import type { CircuitConfig, CircuitComponentType } from './types';
import { shouldSuppressDiagram, isConceptOnlyQuestion } from '@/utils/diagramSuppression';

/**
 * Strip LaTeX markup so regex can match plain values.
 */
function stripLatex(raw: string): string {
  let s = raw;
  s = s.replace(/\\text\{([^}]*)\}/g, '$1');
  s = s.replace(/\\,/g, ' ');
  s = s.replace(/\\Omega/g, 'Ω');
  s = s.replace(/R_\{?1\}?/g, 'R₁');
  s = s.replace(/R_\{?2\}?/g, 'R₂');
  s = s.replace(/R_\{?3\}?/g, 'R₃');
  s = s.replace(/R_\{?4\}?/g, 'R₄');
  s = s.replace(/L_\{?1\}?/g, 'L₁');
  s = s.replace(/L_\{?2\}?/g, 'L₂');
  s = s.replace(/R_\{?T\}?/gi, 'Rₜ');
  s = s.replace(/R_\{?F\}?/gi, 'R_F');
  s = s.replace(/\$/g, '');
  s = s.replace(/\s+/g, ' ');
  return s;
}

// ── Robust label extractors ──

interface ExtractedResistor {
  symbol: string;
  value: string;
  label: string;
  ohms: number;
}

function extractResistorLabels(cleaned: string): ExtractedResistor[] {
  const results: ExtractedResistor[] = [];

  // Pattern 1: R₁ = 600 Ω  /  R₁ = 2.2 kΩ  /  R_F = 1.0 kΩ  /  Rₜ = 500 Ω
  const namedPattern = /\b(R[₁₂₃₄₅_F]|Rₜ)\s*=\s*([\d.]+)\s*([kK]?)\s*[ΩΩ]/g;
  let match;
  while ((match = namedPattern.exec(cleaned)) !== null) {
    const symbol = match[1];
    const rawVal = match[2];
    const isK = match[3].toLowerCase() === 'k';
    const ohms = parseFloat(rawVal) * (isK ? 1000 : 1);
    const displayValue = isK ? `${rawVal} kΩ` : `${rawVal} Ω`;
    results.push({ symbol, value: displayValue, label: `${symbol} = ${displayValue}`, ohms });
  }

  // Pattern 2: "resistance 600 Ω" / "resistor of 600 Ω" / "600 Ω resistor"
  const genericPattern = /(?:resistor|resistance)\s*(?:of\s*)?([\d.]+)\s*([kK]?)\s*[ΩΩ]|([\d.]+)\s*([kK]?)\s*[ΩΩ]\s*resistor/gi;
  while ((match = genericPattern.exec(cleaned)) !== null) {
    const rawVal = match[1] ?? match[3];
    const rawK = match[2] ?? match[4] ?? '';
    if (!rawVal) continue;
    const isK = rawK.toLowerCase() === 'k';
    const ohms = parseFloat(rawVal) * (isK ? 1000 : 1);
    if (results.some(r => r.ohms === ohms)) continue;
    const idx = results.length;
    const symbol = `R${SUBSCRIPTS[idx] || ''}`;
    const displayValue = isK ? `${rawVal} kΩ` : `${rawVal} Ω`;
    results.push({ symbol, value: displayValue, label: `${symbol} = ${displayValue}`, ohms });
  }

  return results;
}

function extractBatteryLabel(cleaned: string): string {
  const patterns = [
    /(?:battery|cell|emf|e\.m\.f\.?)\s*(?:of\s*)?(?:=\s*)?([\d.]+)\s*V/i,
    /electromotive\s+force[^.]*?([\d.]+)\s*V/i,
    /power\s+supply[^.]*?([\d.]+)\s*V/i,
    /supply[^.]*?([\d.]+)\s*V/i,
    /([\d.]+)\s*V\s*(?:battery|cell|supply|source)/i,
  ];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m) return `ε = ${m[1]}V`;
  }
  return 'ε';
}

/**
 * Detects a circuit diagram config from question text.
 */
export function detectCircuitConfig(questionText: string, topicTag?: string, subjectName?: string): CircuitConfig | null {
  // Early exit — suppress diagram for theoretical topics
  if (shouldSuppressDiagram(topicTag ?? '', questionText, subjectName ?? '')) {
    return null;
  }

  const cleaned = stripLatex(questionText);
  const text = cleaned.toLowerCase();

  // ── AC vs DC classification ──

  // Strong AC keywords — each alone is enough to trigger AC path
  const acKeywords = [
    'alternating current', 'ac circuit', 'ac source', 'ac supply', 'ac voltage',
    'impedance', 'reactance', 'inductive reactance', 'capacitive reactance',
    'inductor', 'phasor', 'angular frequency',
    'complex impedance', 'r + jx', 'r + jω',
    'admittance', 'susceptance',
    'rlc circuit', 'rc circuit', 'rl circuit', 'lc circuit',
    'resonant frequency',
  ];

  // Weak AC keywords — need 2+ present to trigger AC (without a strong keyword)
  const weakAcKeywords = [
    'capacitance', 'inductance', 'capacitor', 'frequency', 'omega', 'ω',
  ];

  // DC override — if any of these are present, this is definitely NOT an AC question
  const dcOverrideKeywords = [
    'resistivity', 'potential divider', 'wheatstone', 'emf', 'e.m.f',
    'internal resistance', 'kirchhoff', "ohm's law", 'ohms law',
    'series resistor', 'parallel resistor', 'current divider', 'voltage divider',
    'cross-sectional area', 'wire of length', 'drift velocity', 'charge carriers',
    'thermistor', 'ldr', 'light dependent resistor', 'filament lamp',
  ];

  const isDcQuestion = dcOverrideKeywords.some(kw => text.includes(kw));

  const hasStrongAcKeyword = acKeywords.some(kw => text.includes(kw));
  const weakAcCount = weakAcKeywords.filter(kw => text.includes(kw)).length;

  const isAcCircuit = !isDcQuestion && (hasStrongAcKeyword || weakAcCount >= 2);

  // ── General circuit keyword check ──
  const circuitKeywords = [
    'circuit', 'resistor', 'resistance', 'voltmeter', 'ammeter',
    'battery', 'cell', 'lamp', 'bulb', 'switch', 'diode',
    'emf', 'e.m.f', 'potential difference', 'internal resistance',
    'series', 'parallel', 'connected in', 'thermistor', 'potential divider',
    'ldr', 'light dependent resistor',
  ];
  if (!isAcCircuit && !circuitKeywords.some(kw => text.includes(kw))) return null;

  const mechExclude = ['inclined plane', 'slope', 'pulley', 'beam', 'rod', 'projectile', 'tension'];
  if (mechExclude.some(kw => text.includes(kw))) return null;

  if (text.includes('plot a graph') || text.includes('i-v characteristic') || text.includes('use your graph')) return null;

  // Skip dual questions (motor + mechanical action) — handled by mechanics detector
  const isDual = /motor/i.test(text) && /lift|raise|pump|height|distance/i.test(text) && /\d+\s*kg/i.test(text);
  if (isDual) return null;

  // ── AC circuit path ──
  if (isAcCircuit) {
    return buildAcCircuitConfig(cleaned, text);
  }

  // ── Extract values using robust extractors ──
  const resistorLabels = extractResistorLabels(cleaned);
  const emfLabel = extractBatteryLabel(cleaned);

  const intResMatch = cleaned.match(/internal\s+resistance\s*(?:of\s*)?(?:=\s*)?(\d+\.?\d*)\s*Ω/i);
  const hasInternalRes = !!intResMatch;
  const intResLabel = intResMatch ? `r = ${intResMatch[1]}Ω` : 'r';

  // Thermistor
  const hasThermistor = /thermistor/.test(text);
  const thermistorMatch = cleaned.match(/thermistor[^.]*?(\d+\.?\d*)\s*(?:kΩ|Ω)/i)
    || cleaned.match(/Rₜ[^=]*?=?\s*(\d+\.?\d*)\s*(?:kΩ|Ω)/i);
  const thermistorUnit = cleaned.match(/thermistor[^.]*?\d+\.?\d*\s*(kΩ)/i) ? 'kΩ' : 'Ω';
  const thermistorLabel = thermistorMatch ? `Rₜ = ${thermistorMatch[1]}${thermistorUnit}` : 'Rₜ';

  // LDR
  const hasLDR = /ldr|light.dependent.resistor/.test(text);

  // Potential divider
  const isPotentialDivider = /potential\s+divider/.test(text);

  // Build legacy resistors array from extracted labels for backward compat
  const resistors = resistorLabels.map(r => ({ label: r.label, value: r.value }));

  // Fixed resistor in potential divider context
  const fixedResMatch = cleaned.match(/(?:fixed\s+)?resistor[^.]*?(\d+\.?\d*)\s*(kΩ|Ω)/i);

  // Detect components
  const hasVoltmeter = /voltmeter/.test(text);
  const hasAmmeter = /ammeter/.test(text);
  const hasSwitch = /switch/.test(text);
  const lampCount = (text.match(/\blamp|bulb\b/gi) || []).length;
  const isParallel = /parallel/.test(text);

  // ── Build circuit layout ──

  // Potential divider / thermistor / LDR series circuit
  if (isPotentialDivider || hasThermistor || hasLDR) {
    return buildPotentialDividerCircuit(
      resistors, hasThermistor, thermistorLabel, hasLDR,
      fixedResMatch, emfLabel, hasVoltmeter, hasAmmeter
    );
  }

  // ── Wheatstone bridge ──
  const isWheatstoneBridge =
    /wheatstone|bridge circuit|balanced.*bridge/i.test(text) ||
    (resistors.length === 4 && /galvanometer/i.test(text));
  if (isWheatstoneBridge) {
    return buildWheatstoneBridge(
      resistors[0]?.label ?? 'R₁', resistors[1]?.label ?? 'R₂',
      resistors[2]?.label ?? 'R₃', resistors[3]?.label ?? 'R₄',
      'G', emfLabel,
    );
  }

  // ── Series-parallel mixed ──
  const isSeriesParallel =
    /series.*parallel|parallel.*series|combination circuit/i.test(text) && resistors.length >= 3;
  if (isSeriesParallel) {
    return buildSeriesParallelCircuit(
      [{ type: 'resistor', label: resistors[0]?.label ?? 'R₁' }],
      [
        { type: 'resistor', label: resistors[1]?.label ?? 'R₂' },
        { type: 'resistor', label: resistors[2]?.label ?? 'R₃' },
      ],
      emfLabel, hasInternalRes ? intResLabel : undefined,
    );
  }

  if (isParallel && resistors.length >= 2) {
    return buildParallelResistorCircuit(resistors, emfLabel, hasInternalRes, intResLabel, hasAmmeter, hasVoltmeter);
  }

  if (isParallel && (resistors.length >= 1 || lampCount >= 1)) {
    return buildSimpleParallelCircuit(resistors, lampCount, emfLabel, hasInternalRes, intResLabel, hasAmmeter);
  }

  // ── Voltmeter across a component (non-parallel) ──
  const hasVoltmeterAcross = hasVoltmeter && resistors.length >= 2 && !isParallel;
  if (hasVoltmeterAcross) {
    return buildCircuitWithVoltmeter(
      resistors.map(r => ({ type: 'resistor' as const, label: r.label })),
      0, emfLabel,
    );
  }

  // ── 3+ series components ──
  if (!isParallel && resistors.length >= 3) {
    return buildTwoLoopSeriesCircuit(
      resistors.slice(0, 3).map(r => ({ type: 'resistor' as const, label: r.label })),
      emfLabel,
    );
  }

  return buildSeriesCircuit(resistors, lampCount, emfLabel, hasInternalRes, intResLabel, hasAmmeter, hasVoltmeter, hasSwitch);
}

const SUBSCRIPTS = ['₁', '₂', '₃', '₄', '₅'];

/**
 * Potential divider / thermistor circuit:
 * Battery on left, two components in series on bottom, optional voltmeter across one.
 */
function buildPotentialDividerCircuit(
  resistors: { label: string }[],
  hasThermistor: boolean,
  thermistorLabel: string,
  hasLDR: boolean,
  fixedResMatch: RegExpMatchArray | null,
  emfLabel: string,
  hasVoltmeter: boolean,
  _hasAmmeter: boolean,
): CircuitConfig {
  const nodes: CircuitConfig['nodes'] = [
    { id: 'TL', col: 0, row: 0 },
    { id: 'TR', col: 3, row: 0 },
    { id: 'BR', col: 3, row: 2 },
    { id: 'BM', col: 1.5, row: 2 },
    { id: 'BL', col: 0, row: 2 },
  ];

  const comp1Type: CircuitComponentType = hasThermistor ? 'thermistor' : (hasLDR ? 'variable_resistor' : 'resistor');
  const comp1Label = hasThermistor ? thermistorLabel : (hasLDR ? 'LDR' : (resistors[0]?.label || 'R₁'));

  let comp2Label = resistors.length > 1 ? resistors[1].label : (resistors[0]?.label || 'R₂');
  if (fixedResMatch && (hasThermistor || hasLDR)) {
    const unit = fixedResMatch[2] || 'Ω';
    comp2Label = `R = ${fixedResMatch[1]}${unit}`;
  }

  const wires: CircuitConfig['wires'] = [
    { from: 'TL', to: 'TR', component: 'wire' },
    { from: 'TR', to: 'BR', component: 'wire' },
    { from: 'BR', to: 'BM', component: comp1Type, label: comp1Label },
    { from: 'BM', to: 'BL', component: 'resistor', label: comp2Label },
    { from: 'BL', to: 'TL', component: 'battery', label: emfLabel },
  ];

  // Optional voltmeter across the thermistor/LDR
  if (hasVoltmeter) {
    nodes.push({ id: 'VT', col: 3, row: 3 });
    nodes.push({ id: 'VB', col: 1.5, row: 3 });
    wires.push({ from: 'BR', to: 'VT', component: 'wire' });
    wires.push({ from: 'VT', to: 'VB', component: 'voltmeter', label: 'V' });
    wires.push({ from: 'VB', to: 'BM', component: 'wire' });
  }

  return { type: 'circuit', gridSpacing: 80, nodes, wires, junctions: [], showLabels: true };
}

/**
 * Parallel resistor circuit.
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
    wires.push({ from: 'TL', to: 'TM', component: 'wire' });
    wires.push({ from: 'TM', to: 'TR', component: 'resistor', label: resistors[2].label });
    wires.push({ from: 'TR', to: 'MR', component: 'wire' });
    wires.push({ from: 'TM', to: 'MM', component: 'resistor', label: resistors[0].label });
    wires.push({ from: 'MM', to: 'ML', component: 'wire' });
    wires.push({ from: 'MM', to: 'MR', component: 'resistor', label: resistors[1].label });
    wires.push({ from: 'MR', to: 'BR', component: 'wire' });
    junctions.push({ at: 'TM' }, { at: 'MM' }, { at: 'MR' });
  } else {
    wires.push({ from: 'TL', to: 'TM', component: 'wire' });
    wires.push({ from: 'TM', to: 'TR', component: 'resistor', label: resistors[0].label });
    wires.push({ from: 'TM', to: 'MM', component: 'wire' });
    wires.push({ from: 'MM', to: 'MR', component: 'resistor', label: resistors[1].label });
    wires.push({ from: 'MR', to: 'TR', component: 'wire' });
    wires.push({ from: 'TR', to: 'BR', component: 'wire' });
    junctions.push({ at: 'TM' }, { at: 'TR' });
  }

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
 * Simple parallel circuit with mixed components.
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

  if (lampCount > 0) {
    wires.push({ from: 'ML', to: 'MR', component: 'lamp', label: lampCount > 1 ? 'L₁' : '' });
  } else if (resistors.length > 0) {
    wires.push({ from: 'ML', to: 'MR', component: 'resistor', label: resistors[0].label });
  }

  if (resistors.length > (lampCount > 0 ? 0 : 1)) {
    const rIdx = lampCount > 0 ? 0 : 1;
    wires.push({ from: 'BL', to: 'BR', component: 'resistor', label: resistors[rIdx]?.label || 'R' });
  } else if (lampCount > 1) {
    wires.push({ from: 'BL', to: 'BR', component: 'lamp', label: 'L₂' });
  }

  return { type: 'circuit', gridSpacing: 80, nodes, wires, junctions, showLabels: true };
}

/**
 * Series circuit — always at least 5 nodes and 5 wires.
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

  const componentList: { type: CircuitComponentType; label: string }[] = [];
  resistors.forEach(r => componentList.push({ type: 'resistor', label: r.label }));
  for (let i = 0; i < lampCount; i++) {
    componentList.push({ type: 'lamp', label: lampCount > 1 ? `L${SUBSCRIPTS[i] || i + 1}` : '' });
  }

  if (componentList.length === 0) {
    componentList.push({ type: 'resistor', label: 'R' });
  }

  const bottomSlots = componentList.length;
  const cols = Math.max(3, bottomSlots + 1);

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

  nodes.push({ id: 'BR', col: cols, row: 2 });
  if (hasSwitch) {
    wires.push({ from: 'TR', to: 'BR', component: 'switch_open', label: 'S' });
  } else {
    wires.push({ from: 'TR', to: 'BR', component: 'wire' });
  }

  let prevNode = 'BR';
  const step = cols / (componentList.length + 1);
  componentList.forEach((comp, i) => {
    const colPos = Math.round(cols - (i + 1) * step);
    const nodeId = `B${i}`;
    nodes.push({ id: nodeId, col: Math.max(colPos, 0), row: 2 });
    wires.push({ from: prevNode, to: nodeId, component: comp.type, label: comp.label });
    prevNode = nodeId;
  });

  nodes.push({ id: 'BL', col: 0, row: 2 });
  if (prevNode !== 'BL') {
    wires.push({ from: prevNode, to: 'BL', component: 'wire' });
  }

  if (hasAmmeter) {
    nodes.push({ id: 'AL', col: 0, row: 1 });
    wires.push({ from: 'BL', to: 'AL', component: 'ammeter', label: 'A' });
    wires.push({ from: 'AL', to: 'TL', component: 'wire' });
  } else {
    wires.push({ from: 'BL', to: 'TL', component: 'wire' });
  }

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

/**
 * Build an AC circuit config from question text.
 */
function buildAcCircuitConfig(cleaned: string, text: string): CircuitConfig {
  const hasInductor = /inductor|inductance|coil|\bL\s*=/i.test(cleaned);
  const hasCapacitor = /capacitor|capacitance|\bC\s*=/i.test(cleaned);
  const hasImpedance = /impedance|\bZ\s*=|R\s*\+\s*j/i.test(cleaned);

  const resistanceMatch = cleaned.match(/R\s*=\s*([\d.]+)\s*[ΩΩ]/);
  const reactanceMatch = cleaned.match(/X\s*=\s*([\d.]+)\s*[ΩΩ]/);
  const impedanceMatch = cleaned.match(/Z\s*=\s*([\d.]+)\s*[ΩΩ]/);
  const voltageMatch = cleaned.match(/V\s*=\s*([\d.]+)/);
  const inductanceMatch = cleaned.match(/L\s*=\s*([\d.]+)\s*[mM]?H/);
  const capacitanceMatch = cleaned.match(/C\s*=\s*([\d.]+)\s*[μuµ]?F/);

  const R = resistanceMatch ? `${resistanceMatch[1]}Ω` : 'R';
  const Z = impedanceMatch ? `${impedanceMatch[1]}Ω` : 'Z';
  const V = voltageMatch ? `${voltageMatch[1]}V` : 'V';
  const L = inductanceMatch ? `${inductanceMatch[1]}H` : 'L';
  const C = capacitanceMatch ? `${capacitanceMatch[1]}F` : 'C';

  const seriesComponents: Array<{ type: CircuitComponentType; label: string }> = [];

  if (hasImpedance && !hasInductor && !hasCapacitor) {
    const zLabel = reactanceMatch ? `Z = ${R} + j${reactanceMatch[1]}Ω` : `Z = ${Z}`;
    seriesComponents.push({ type: 'impedance', label: zLabel });
  } else {
    if (resistanceMatch) {
      seriesComponents.push({ type: 'resistor', label: `R = ${R}` });
    }
    if (hasInductor) {
      seriesComponents.push({ type: 'inductor', label: `L = ${L}` });
    }
    if (hasCapacitor) {
      seriesComponents.push({ type: 'capacitor', label: `C = ${C}` });
    }
  }

  if (seriesComponents.length === 0) {
    seriesComponents.push({ type: 'impedance', label: 'Z' });
  }

  const totalCols = Math.max(3, seriesComponents.length + 1);

  const nodes: CircuitConfig['nodes'] = [
    { id: 'TL', col: 0, row: 0 },
    { id: 'TR', col: totalCols, row: 0 },
    { id: 'BR', col: totalCols, row: 2 },
    { id: 'BL', col: 0, row: 2 },
    ...seriesComponents.slice(0, -1).map((_, i) => ({
      id: `TM${i}`,
      col: i + 1,
      row: 0,
    })),
  ];

  const wires: CircuitConfig['wires'] = [
    { from: 'BL', to: 'TL', component: 'ac_source' as CircuitComponentType, label: V },
    { from: 'BR', to: 'BL', component: 'wire' as CircuitComponentType },
    {
      from: 'TR', to: 'BR',
      component: (text.includes('current') ? 'ammeter' : 'wire') as CircuitComponentType,
      label: text.includes('current') ? 'I' : undefined,
    },
  ];

  if (seriesComponents.length === 1) {
    wires.push({
      from: 'TL', to: 'TR',
      component: seriesComponents[0].type,
      label: seriesComponents[0].label,
    });
  } else {
    const topNodes = ['TL', ...seriesComponents.slice(0, -1).map((_, i) => `TM${i}`), 'TR'];
    seriesComponents.forEach((comp, i) => {
      wires.push({
        from: topNodes[i],
        to: topNodes[i + 1],
        component: comp.type,
        label: comp.label,
      });
    });
  }

  return { type: 'circuit', gridSpacing: 80, nodes, wires, junctions: [], showLabels: true };
}

// ── Multi-loop topology builders ──

function buildSeriesParallelCircuit(
  seriesComponents: Array<{ type: string; label: string }>,
  parallelComponents: Array<{ type: string; label: string }>,
  batteryLabel: string,
  internalResistance?: string,
): CircuitConfig {
  const nodes: CircuitConfig['nodes'] = [
    { id: 'TL', col: 0, row: 0 },
    { id: 'TM', col: 2, row: 0 },
    { id: 'TR', col: 4, row: 0 },
    { id: 'ML', col: 2, row: 2 },
    { id: 'MR', col: 4, row: 2 },
    { id: 'BL', col: 0, row: 2 },
  ];
  const wires: CircuitConfig['wires'] = [
    { from: 'BL', to: 'TL', component: 'battery' as CircuitComponentType, label: batteryLabel },
    { from: 'TL', to: 'TM', component: (seriesComponents[0]?.type ?? 'wire') as CircuitComponentType, label: seriesComponents[0]?.label },
    { from: 'TM', to: 'TR', component: (parallelComponents[0]?.type ?? 'resistor') as CircuitComponentType, label: parallelComponents[0]?.label },
    { from: 'ML', to: 'MR', component: (parallelComponents[1]?.type ?? 'resistor') as CircuitComponentType, label: parallelComponents[1]?.label },
    { from: 'TR', to: 'MR', component: 'wire' as CircuitComponentType },
    { from: 'MR', to: 'BL', component: internalResistance ? 'resistor' as CircuitComponentType : 'wire' as CircuitComponentType, label: internalResistance },
    { from: 'TM', to: 'ML', component: 'wire' as CircuitComponentType },
  ];
  return { type: 'circuit', gridSpacing: 80, nodes, wires, junctions: [{ at: 'TM' }, { at: 'MR' }], showLabels: true };
}

function buildTwoLoopSeriesCircuit(
  components: Array<{ type: string; label: string }>,
  batteryLabel: string,
): CircuitConfig {
  const nodes: CircuitConfig['nodes'] = [
    { id: 'TL', col: 0, row: 0 },
    { id: 'TM1', col: 2, row: 0 },
    { id: 'TM2', col: 4, row: 0 },
    { id: 'TR', col: 6, row: 0 },
    { id: 'BR', col: 6, row: 2 },
    { id: 'BL', col: 0, row: 2 },
  ];
  const wires: CircuitConfig['wires'] = [
    { from: 'BL', to: 'TL', component: 'battery' as CircuitComponentType, label: batteryLabel },
    { from: 'TL', to: 'TM1', component: (components[0]?.type ?? 'resistor') as CircuitComponentType, label: components[0]?.label },
    { from: 'TM1', to: 'TM2', component: (components[1]?.type ?? 'resistor') as CircuitComponentType, label: components[1]?.label },
    { from: 'TM2', to: 'TR', component: components[2] ? components[2].type as CircuitComponentType : 'wire' as CircuitComponentType, label: components[2]?.label },
    { from: 'TR', to: 'BR', component: 'wire' as CircuitComponentType },
    { from: 'BR', to: 'BL', component: 'wire' as CircuitComponentType },
  ];
  return { type: 'circuit', gridSpacing: 80, nodes, wires, junctions: [], showLabels: true };
}

function buildCircuitWithVoltmeter(
  mainComponents: Array<{ type: string; label: string }>,
  voltmeterAcross: number,
  batteryLabel: string,
): CircuitConfig {
  const numMain = mainComponents.length;
  const topNodeIds = ['TL', ...mainComponents.map((_, i) => `TM${i}`), 'TR'];

  const nodes: CircuitConfig['nodes'] = [
    { id: 'TL', col: 0, row: 0 },
    ...mainComponents.map((_, i) => ({ id: `TM${i}`, col: (i + 1) * 2, row: 0 })),
    { id: 'TR', col: (numMain + 1) * 2, row: 0 },
    { id: 'BR', col: (numMain + 1) * 2, row: 2 },
    { id: 'BL', col: 0, row: 2 },
    { id: 'VM_BOT', col: (voltmeterAcross + 1) * 2, row: 3 },
    { id: 'VM_BOT2', col: (voltmeterAcross + 2) * 2, row: 3 },
  ];

  const wires: CircuitConfig['wires'] = [
    { from: 'BL', to: 'TL', component: 'battery' as CircuitComponentType, label: batteryLabel },
    ...mainComponents.map((comp, i) => ({
      from: topNodeIds[i],
      to: topNodeIds[i + 1],
      component: comp.type as CircuitComponentType,
      label: comp.label,
    })),
    { from: 'TR', to: 'BR', component: 'wire' as CircuitComponentType },
    { from: 'BR', to: 'BL', component: 'wire' as CircuitComponentType },
    { from: topNodeIds[voltmeterAcross], to: 'VM_BOT', component: 'wire' as CircuitComponentType },
    { from: 'VM_BOT', to: 'VM_BOT2', component: 'voltmeter' as CircuitComponentType, label: 'V' },
    { from: 'VM_BOT2', to: topNodeIds[voltmeterAcross + 1], component: 'wire' as CircuitComponentType },
  ];

  return {
    type: 'circuit', gridSpacing: 80, nodes, wires,
    junctions: [{ at: topNodeIds[voltmeterAcross] }, { at: topNodeIds[voltmeterAcross + 1] }],
    showLabels: true,
  };
}

function buildWheatstoneBridge(
  r1: string, r2: string, r3: string, r4: string,
  galvanometerLabel: string, batteryLabel: string,
): CircuitConfig {
  return {
    type: 'circuit',
    gridSpacing: 80,
    nodes: [
      { id: 'TL', col: 0, row: 0 },
      { id: 'TM', col: 2, row: 0 },
      { id: 'TR', col: 4, row: 0 },
      { id: 'BL', col: 0, row: 2 },
      { id: 'BM', col: 2, row: 2 },
      { id: 'BR', col: 4, row: 2 },
    ],
    wires: [
      { from: 'TL', to: 'TM', component: 'resistor', label: r1 },
      { from: 'TM', to: 'TR', component: 'resistor', label: r2 },
      { from: 'BL', to: 'BM', component: 'resistor', label: r3 },
      { from: 'BM', to: 'BR', component: 'resistor', label: r4 },
      { from: 'TM', to: 'BM', component: 'galvanometer', label: galvanometerLabel },
      { from: 'TL', to: 'BL', component: 'battery', label: batteryLabel },
      { from: 'TR', to: 'BR', component: 'wire' },
    ],
    junctions: [{ at: 'TM' }, { at: 'BM' }],
    showLabels: true,
  };
}
