export type MathsDiagramType =
  | 'probability_tree'
  | 'venn_two'
  | 'venn_three'
  | 'two_way_table'
  | 'sample_space'
  | 'punnett_maths';

// ── Probability Tree ─────────────────────────────────────────────────────────

export interface TreeBranch {
  label: string;
  probability: string;
  children?: TreeBranch[];
  highlight?: boolean;
}

export interface ProbabilityTreeConfig {
  type: 'probability_tree';
  stages: number;
  branches: TreeBranch[];
  title?: string;
  showOutcomes?: boolean;
  showFinalProbabilities?: boolean;
  question?: string;
}

// ── Venn Diagrams ─────────────────────────────────────────────────────────────

export interface VennTwoConfig {
  type: 'venn_two';
  setA: string;
  setB: string;
  onlyA?: string | number;
  onlyB?: string | number;
  both?: string | number;
  neither?: string | number;
  total?: number;
  showSetNotation?: boolean;
  universalSetLabel?: string;
  title?: string;
  highlightRegion?:
    | 'A'
    | 'B'
    | 'intersection'
    | 'union'
    | 'A_only'
    | 'B_only'
    | 'neither'
    | 'complement_A'
    | 'complement_B';
}

export interface VennThreeConfig {
  type: 'venn_three';
  setA: string;
  setB: string;
  setC: string;
  onlyA?: string | number;
  onlyB?: string | number;
  onlyC?: string | number;
  AB_only?: string | number;
  AC_only?: string | number;
  BC_only?: string | number;
  all_three?: string | number;
  neither?: string | number;
  total?: number;
  universalSetLabel?: string;
  title?: string;
}

// ── Two-Way Table ─────────────────────────────────────────────────────────────

export interface TwoWayTableConfig {
  type: 'two_way_table';
  rowVariable: string;
  colVariable: string;
  rowLabels: string[];
  colLabels: string[];
  data: (number | null)[][];
  rowTotals?: (number | null)[];
  colTotals?: (number | null)[];
  grandTotal?: number | null;
  title?: string;
  highlightCell?: { row: number; col: number };
}

// ── Sample Space ──────────────────────────────────────────────────────────────

export interface SampleSpaceConfig {
  type: 'sample_space';
  event1Label: string;
  event2Label: string;
  event1Values: string[];
  event2Values: string[];
  highlightCondition?: string;
  title?: string;
}

// ── Maths Punnett (probability framing) ──────────────────────────────────────

export interface PunnettMathsConfig {
  type: 'punnett_maths';
  parent1: string;
  parent2: string;
  showAsFractions?: boolean;
  title?: string;
}

export type MathsDiagramConfig =
  | ProbabilityTreeConfig
  | VennTwoConfig
  | VennThreeConfig
  | TwoWayTableConfig
  | SampleSpaceConfig
  | PunnettMathsConfig;
