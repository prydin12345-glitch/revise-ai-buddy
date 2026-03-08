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
  labelMode?: 'visible' | 'hidden';
  revealedLabels?: Set<string>;
  onLabelClick?: (id: string) => void;
  scale?: number;
}

export interface DiagramMeta {
  diagramKey: string;
  labelData: DiagramLabelData[];
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
