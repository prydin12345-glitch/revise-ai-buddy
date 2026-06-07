// Shared types for all Biology & Chemistry diagrams

export interface DiagramLabelData {
  id: string;
  displayName: string;
  description?: string;
  /** Position for the label text (SVG coords) */
  x: number;
  y: number;
  /** Optional anchor point on the structure, for a leader line */
  anchorX?: number;
  anchorY?: number;
}

export interface DiagramProps {
  showLabels?: boolean;
  labelMode?: 'visible' | 'hidden' | 'anonymous';
  /** When set, overrides each label's displayName by index (e.g. ["W","X","Y","Z"]).
   *  Used for "which of the labelled regions" MCQs so anatomical names aren't given away. */
  letterLabels?: string[];
  revealedLabels?: Set<string>;
  onLabelClick?: (id: string) => void;
  scale?: number;
}

/** Replace each label's displayName with the matching entry from letterLabels (by index). */
export const applyLetterLabels = <T extends { displayName: string }>(
  labels: T[],
  letterLabels?: string[],
): T[] => {
  if (!letterLabels || letterLabels.length === 0) return labels;
  return labels.map((l, i) =>
    letterLabels[i] !== undefined ? { ...l, displayName: letterLabels[i] } : l,
  );
};

export interface DiagramMeta {
  diagramKey: string;
  labelData: DiagramLabelData[];
}

export type BiologyDiagramType =
  | 'animal_cell'
  | 'plant_cell'
  | 'bacterial_cell'
  | 'neuron'
  | 'synapse'
  | 'heart'
  | 'dna_helix'
  | 'dna_replication'
  | 'protein_synthesis'
  | 'mitosis'
  | 'meiosis'
  | 'punnett_square'
  | 'food_web'
  | 'food_chain'
  | 'ecological_pyramid'
  | 'enzyme_substrate'
  | 'photosynthesis'
  | 'respiration'
  | 'gas_exchange'
  | 'leaf_section'
  | 'root_hair_cell'
  | 'population_growth'
  | 'nitrogen_cycle'
  | 'carbon_cycle'
  | 'immune_response'
  | 'homeostasis'
  | 'phylogenetic_tree'
  | 'gel_electrophoresis'
  | 'pcr';

export interface BiologyDiagramConfig extends DiagramProps {
  type: BiologyDiagramType;
  // Punnett square:
  crossType?: 'monohybrid' | 'dihybrid' | 'x_linked' | 'codominance';
  parent1?: string;
  parent2?: string;
  dominantTrait?: string;
  recessiveTrait?: string;
  // Food web/chain:
  organisms?: string[];
  pyramidType?: 'numbers' | 'biomass' | 'energy';
  // Enzyme:
  model?: 'lock_and_key' | 'induced_fit';
  hasInhibitor?: boolean;
  inhibitorType?: 'competitive' | 'non_competitive';
  // General:
  labels?: Record<string, string>;
}

export const DIAGRAM_STYLE = {
  stroke: '#1a1a1a',
  strokeWidth: 2,
  labelStroke: '#94a3b8',
  labelStrokeWidth: 1,
  fontFamily: 'serif',
  fontStyle: 'italic' as const,
  fontSize: 12,
  smallFontSize: 10,
  background: 'white',
  hiddenBoxFill: '#334155',
  hiddenBoxStroke: '#475569',
  revealedFill: '#dcfce7',
  revealedStroke: '#16a34a',
  revealedText: '#15803d',
} as const;
