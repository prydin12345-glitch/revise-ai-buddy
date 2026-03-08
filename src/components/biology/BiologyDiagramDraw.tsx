import React from 'react';
import type { DiagramProps } from './types';
import AnimalCellDiagram from './diagrams/AnimalCellDiagram';
import PlantCellDiagram from './diagrams/PlantCellDiagram';
import NeuronDiagram from './diagrams/NeuronDiagram';
import HeartDiagram from './diagrams/HeartDiagram';
import DnaHelixDiagram from './diagrams/DnaHelixDiagram';
import MitosisDiagram from './diagrams/MitosisDiagram';

export interface BiologyDiagramConfig extends DiagramProps {
  type: 'animal_cell' | 'plant_cell' | 'neuron' | 'heart' | 'dna_helix' | 'mitosis';
}

const MissingDiagram: React.FC<{ type?: string }> = ({ type }) => (
  <svg width="300" height="80" style={{ background: 'white', display: 'block', margin: '0 auto' }}>
    <rect x="8" y="8" width="284" height="64"
      fill="#fff8f8" stroke="#cc0000" strokeWidth={1} strokeDasharray="4 2" rx={4} />
    <text x="150" y="40" textAnchor="middle" fontSize="11" fill="#cc0000" fontFamily="serif">
      Biology diagram "{type || 'unknown'}" not recognised
    </text>
  </svg>
);

const BiologyDiagramDraw: React.FC<{ config: BiologyDiagramConfig }> = ({ config }) => {
  try {
    const props: DiagramProps = {
      showLabels: config.showLabels,
      labelMode: config.labelMode,
      revealedLabels: config.revealedLabels,
      onLabelClick: config.onLabelClick,
      scale: config.scale,
    };

    switch (config.type) {
      case 'animal_cell': return <AnimalCellDiagram {...props} />;
      case 'plant_cell': return <PlantCellDiagram {...props} />;
      case 'neuron': return <NeuronDiagram {...props} />;
      case 'heart': return <HeartDiagram {...props} />;
      case 'dna_helix': return <DnaHelixDiagram {...props} />;
      case 'mitosis': return <MitosisDiagram {...props} />;
      default: return <MissingDiagram type={(config as any).type} />;
    }
  } catch {
    return <MissingDiagram type={config?.type} />;
  }
};

export default BiologyDiagramDraw;
