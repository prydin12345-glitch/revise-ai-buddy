// ── Circuit Diagram JSON Schema ──

export interface CircuitNode {
  id: string;
  col: number;
  row: number;
}

// NOTE: keep this union in sync with supabase/functions/_shared/circuit-validation.ts
// (ALL_CIRCUIT_COMPONENTS) and the switch in symbols.tsx. All three must agree.
export type CircuitComponentType =
  | 'battery'
  | 'resistor'
  | 'variable_resistor'
  | 'thermistor'
  | 'lamp'
  | 'voltmeter'
  | 'ammeter'
  | 'switch_open'
  | 'switch_closed'
  | 'diode'
  | 'motor'
  | 'wire'
  | 'junction'
  // AC & universal components
  | 'ac_source'
  | 'inductor'
  | 'capacitor'
  | 'impedance'
  | 'ground'
  | 'open_terminal'
  | 'fuse'
  | 'current_source'
  | 'galvanometer';

export interface CircuitWire {
  from: string;
  to: string;
  component: CircuitComponentType;
  label?: string;
}

/** Simple junction marker — just marks a node as a junction dot */
export interface CircuitJunction {
  at: string;
}

export interface CircuitConfig {
  type: 'circuit';
  gridSpacing: number;
  nodes: CircuitNode[];
  wires: CircuitWire[];
  junctions?: CircuitJunction[];
  showLabels: boolean;
  showCurrentArrows?: boolean;
  /** Label substring to visually highlight (e.g. "R₁") */
  highlightLabel?: string;
}

// ── Styling Constants ──
// IMPORTANT: All colours are hardcoded dark for rendering on white backgrounds.
// Never use "currentColor" or inherit from theme.

export const CIRCUIT_COLORS = {
  wire: '#1a1a1a',
  component: '#1a1a1a',
  label: '#1a1a1a',
  junction: '#1a1a1a',
  current: '#0055cc',
  unknown: '#888888',
} as const;

export const CIRCUIT_FONT = {
  family: 'serif',
  style: 'italic' as const,
  size: 13,
} as const;
