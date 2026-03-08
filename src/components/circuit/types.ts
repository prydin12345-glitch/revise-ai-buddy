// ── Circuit Diagram JSON Schema ──

export interface CircuitNode {
  id: string;
  col: number;
  row: number;
}

export type CircuitComponentType =
  | 'battery'
  | 'resistor'
  | 'variable_resistor'
  | 'lamp'
  | 'voltmeter'
  | 'ammeter'
  | 'switch_open'
  | 'switch_closed'
  | 'diode'
  | 'wire'
  | 'junction';

export interface CircuitWire {
  from: string;
  to: string;
  component: CircuitComponentType;
  label?: string;
}

export interface CircuitJunction {
  at: string;
  branch: {
    to: string;
    component: CircuitComponentType;
    label?: string;
  }[];
}

export interface CircuitConfig {
  type: 'circuit';
  gridSpacing: number;
  nodes: CircuitNode[];
  wires: CircuitWire[];
  junctions?: CircuitJunction[];
  showLabels: boolean;
  showCurrentArrows?: boolean;
}

// ── Styling Constants ──

export const CIRCUIT_COLORS = {
  wire: '#000000',
  component: '#000000',
  label: '#000000',
  junction: '#000000',
  current: '#0055cc',
  unknown: '#888888',
} as const;

export const CIRCUIT_FONT = {
  family: 'serif',
  style: 'italic' as const,
  size: 13,
} as const;
