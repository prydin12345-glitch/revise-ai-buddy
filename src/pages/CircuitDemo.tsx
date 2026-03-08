import React from 'react';
import CircuitDraw from '@/components/circuit/CircuitDraw';
import type { CircuitConfig } from '@/components/circuit/types';

// Example 1: Simple series circuit (matches UK GCSE exam style)
const seriesCircuit: CircuitConfig = {
  type: 'circuit',
  gridSpacing: 80,
  nodes: [
    { id: 'TL', col: 0, row: 0 },
    { id: 'TR', col: 3, row: 0 },
    { id: 'BR', col: 3, row: 2 },
    { id: 'BL', col: 0, row: 2 },
    { id: 'BM1', col: 1, row: 2 },
    { id: 'BM2', col: 2, row: 2 },
  ],
  wires: [
    { from: 'TL', to: 'TR', component: 'battery', label: '6V' },
    { from: 'TR', to: 'BR', component: 'wire' },
    { from: 'BR', to: 'BM2', component: 'lamp' },
    { from: 'BM2', to: 'BM1', component: 'variable_resistor', label: 'R' },
    { from: 'BM1', to: 'BL', component: 'wire' },
    { from: 'BL', to: 'TL', component: 'wire' },
    { from: 'BM1', to: 'BM2', component: 'voltmeter', label: 'V' },
  ],
  showLabels: true,
};

// Example 2: Parallel circuit
const parallelCircuit: CircuitConfig = {
  type: 'circuit',
  gridSpacing: 80,
  nodes: [
    { id: 'TL', col: 0, row: 0 },
    { id: 'TR', col: 4, row: 0 },
    { id: 'ML', col: 0, row: 1 },
    { id: 'MR', col: 4, row: 1 },
    { id: 'BL', col: 0, row: 2 },
    { id: 'BR', col: 4, row: 2 },
  ],
  wires: [
    { from: 'TL', to: 'TR', component: 'battery', label: '12V' },
    { from: 'TR', to: 'MR', component: 'wire' },
    { from: 'MR', to: 'BR', component: 'wire' },
    { from: 'TL', to: 'ML', component: 'wire' },
    { from: 'ML', to: 'BL', component: 'wire' },
    { from: 'ML', to: 'MR', component: 'lamp', label: 'L₁' },
    { from: 'BL', to: 'BR', component: 'resistor', label: 'R' },
  ],
  showLabels: true,
};

// Example 3: All components showcase
const showcaseCircuit: CircuitConfig = {
  type: 'circuit',
  gridSpacing: 80,
  nodes: [
    { id: 'A', col: 0, row: 0 },
    { id: 'B', col: 2, row: 0 },
    { id: 'C', col: 4, row: 0 },
    { id: 'D', col: 4, row: 2 },
    { id: 'E', col: 2, row: 2 },
    { id: 'F', col: 0, row: 2 },
  ],
  wires: [
    { from: 'A', to: 'B', component: 'battery', label: '9V' },
    { from: 'B', to: 'C', component: 'switch_open', label: 'S' },
    { from: 'C', to: 'D', component: 'ammeter', label: 'A' },
    { from: 'D', to: 'E', component: 'diode' },
    { from: 'E', to: 'F', component: 'lamp', label: 'L' },
    { from: 'F', to: 'A', component: 'resistor', label: '100Ω' },
  ],
  showLabels: true,
};

const CircuitDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <h1 className="text-3xl font-bold text-foreground">Circuit Diagram Test</h1>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            1. Series Circuit — Battery + Variable Resistor + Lamp + Voltmeter
          </h2>
          <CircuitDraw config={seriesCircuit} width={480} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            2. Parallel Circuit — Battery + Lamp ∥ Resistor
          </h2>
          <CircuitDraw config={parallelCircuit} width={520} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            3. Component Showcase — All symbols
          </h2>
          <CircuitDraw config={showcaseCircuit} width={520} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            4. Labels Hidden (showLabels: false)
          </h2>
          <CircuitDraw config={{ ...seriesCircuit, showLabels: false }} width={480} />
        </section>
      </div>
    </div>
  );
};

export default CircuitDemo;
