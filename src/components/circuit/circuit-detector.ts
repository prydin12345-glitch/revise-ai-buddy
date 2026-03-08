import type { CircuitConfig, CircuitComponentType } from './types';

/**
 * Attempts to detect a circuit diagram config from question text.
 * Returns null if no circuit diagram is appropriate.
 */
export function detectCircuitConfig(questionText: string): CircuitConfig | null {
  const text = questionText.toLowerCase();

  // Check if this is a circuit-related question
  const circuitKeywords = [
    'circuit', 'resistor', 'resistance', 'voltmeter', 'ammeter',
    'battery', 'cell', 'lamp', 'bulb', 'switch', 'diode',
    'current', 'voltage', 'emf', 'potential difference',
    'series', 'parallel', 'connected in'
  ];

  const isCircuit = circuitKeywords.some(kw => text.includes(kw));
  if (!isCircuit) return null;

  // Don't detect if it's clearly a mechanics question
  const mechanicsKeywords = ['inclined plane', 'slope', 'pulley', 'beam', 'rod', 'projectile', 'tension'];
  if (mechanicsKeywords.some(kw => text.includes(kw))) return null;

  // Try to extract circuit structure from the question
  const components: { type: CircuitComponentType; label: string }[] = [];

  // Detect battery/cell
  const emfMatch = text.match(/(?:battery|cell|emf|e\.m\.f\.)\s*(?:of\s*)?(\d+\.?\d*)\s*v/i);
  const emfLabel = emfMatch ? `${emfMatch[1]}V` : 'ε';

  // Detect resistors
  const resistorMatches = text.matchAll(/resistor\s*(?:of\s*)?(?:resistance\s*)?(\d+\.?\d*\s*[kΩω]?|R\d*)/gi);
  const resistors: { label: string }[] = [];
  for (const m of resistorMatches) {
    resistors.push({ label: m[1] || 'R' });
  }

  // If no specific resistors found, check for generic resistance mentions
  if (resistors.length === 0) {
    const rMatch = text.match(/resistance\s+(?:of\s+)?(\d+\.?\d*)\s*(?:Ω|ohm)/i);
    if (rMatch) {
      resistors.push({ label: `${rMatch[1]}Ω` });
    }
  }

  // Detect lamps/bulbs
  const lampCount = (text.match(/\blamp|bulb\b/gi) || []).length;

  // Detect voltmeter
  const hasVoltmeter = /voltmeter/.test(text);

  // Detect ammeter
  const hasAmmeter = /ammeter/.test(text);

  // Detect switch
  const hasSwitch = /switch/.test(text);

  // Detect if parallel circuit
  const isParallel = /parallel/.test(text);

  // Build a simple circuit config
  if (isParallel && (resistors.length >= 2 || (resistors.length >= 1 && lampCount >= 1))) {
    // Parallel circuit layout
    const nodes = [
      { id: 'TL', col: 0, row: 0 },
      { id: 'TR', col: 4, row: 0 },
      { id: 'ML', col: 0, row: 1 },
      { id: 'MR', col: 4, row: 1 },
      { id: 'BL', col: 0, row: 2 },
      { id: 'BR', col: 4, row: 2 },
    ];

    const wires: CircuitConfig['wires'] = [
      { from: 'TL', to: 'TR', component: 'battery', label: emfLabel },
      { from: 'TR', to: 'MR', component: 'wire' },
      { from: 'MR', to: 'BR', component: 'wire' },
      { from: 'TL', to: 'ML', component: 'wire' },
      { from: 'ML', to: 'BL', component: 'wire' },
    ];

    // First branch
    if (lampCount > 0) {
      wires.push({ from: 'ML', to: 'MR', component: 'lamp', label: lampCount > 1 ? 'L₁' : '' });
    } else if (resistors.length > 0) {
      wires.push({ from: 'ML', to: 'MR', component: 'resistor', label: resistors[0].label });
    }

    // Second branch
    if (resistors.length > (lampCount > 0 ? 0 : 1)) {
      const rIdx = lampCount > 0 ? 0 : 1;
      wires.push({ from: 'BL', to: 'BR', component: 'resistor', label: resistors[rIdx]?.label || 'R' });
    } else if (lampCount > 1) {
      wires.push({ from: 'BL', to: 'BR', component: 'lamp', label: 'L₂' });
    }

    if (hasAmmeter) {
      // Insert ammeter on top wire
      nodes.push({ id: 'AM', col: 2, row: 0 });
    }

    return {
      type: 'circuit',
      gridSpacing: 80,
      nodes,
      wires,
      showLabels: true,
    };
  }

  // Series circuit (default)
  const seriesNodes = [
    { id: 'TL', col: 0, row: 0 },
    { id: 'TR', col: 3, row: 0 },
    { id: 'BR', col: 3, row: 2 },
    { id: 'BL', col: 0, row: 2 },
  ];

  const seriesWires: CircuitConfig['wires'] = [
    { from: 'TL', to: 'TR', component: 'battery', label: emfLabel },
    { from: 'TR', to: 'BR', component: hasSwitch ? 'switch_open' : 'wire' },
  ];

  // Bottom row: place components
  let nextCol = 3;
  const bottomNodes: typeof seriesNodes = [];

  if (lampCount > 0) {
    const midCol = 2;
    bottomNodes.push({ id: 'BM1', col: midCol, row: 2 });
    seriesWires.push({ from: 'BR', to: 'BM1', component: 'lamp', label: lampCount > 1 ? 'L₁' : '' });
    nextCol = midCol;
  }

  if (resistors.length > 0) {
    const rCol = lampCount > 0 ? 1 : 2;
    const fromNode = nextCol === 3 ? 'BR' : bottomNodes[bottomNodes.length - 1]?.id || 'BR';
    bottomNodes.push({ id: 'BM2', col: rCol, row: 2 });
    seriesWires.push({ from: fromNode, to: 'BM2', component: 'resistor', label: resistors[0].label });
    nextCol = rCol;
  }

  // Connect back to BL
  const lastBottomNode = bottomNodes.length > 0 ? bottomNodes[bottomNodes.length - 1].id : 'BR';
  if (lastBottomNode !== 'BL') {
    seriesWires.push({ from: lastBottomNode, to: 'BL', component: 'wire' });
  }
  seriesWires.push({ from: 'BL', to: 'TL', component: 'wire' });

  // Add voltmeter in parallel if present
  if (hasVoltmeter && bottomNodes.length >= 2) {
    seriesWires.push({
      from: bottomNodes[0].id,
      to: bottomNodes[1].id,
      component: 'voltmeter',
      label: 'V',
    });
  }

  // Add ammeter in series if present
  if (hasAmmeter) {
    // Place on left wire
    seriesNodes.push({ id: 'AL', col: 0, row: 1 });
    // Replace BL→TL wire with BL→AL + AL→TL
    const blIdx = seriesWires.findIndex(w => w.from === 'BL' && w.to === 'TL');
    if (blIdx >= 0) {
      seriesWires.splice(blIdx, 1,
        { from: 'BL', to: 'AL', component: 'ammeter', label: 'A' },
        { from: 'AL', to: 'TL', component: 'wire' }
      );
    }
  }

  return {
    type: 'circuit',
    gridSpacing: 80,
    nodes: [...seriesNodes, ...bottomNodes],
    wires: seriesWires,
    showLabels: true,
  };
}
