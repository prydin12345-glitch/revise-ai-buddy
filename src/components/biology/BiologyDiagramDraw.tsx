import React from 'react';
import type { DiagramProps, BiologyDiagramConfig as BiologyDiagramConfigType } from './types';
import AnimalCellDiagram from './diagrams/AnimalCellDiagram';
import PlantCellDiagram from './diagrams/PlantCellDiagram';
import BacterialCellDiagram from './diagrams/BacterialCellDiagram';
import NeuronDiagram from './diagrams/NeuronDiagram';
import HeartDiagram from './diagrams/HeartDiagram';
import DnaHelixDiagram from './diagrams/DnaHelixDiagram';
import MitosisDiagram from './diagrams/MitosisDiagram';
import { PunnettSquareDiagram } from './diagrams/PunnettSquareDiagram';
import { FoodWebDiagram } from './diagrams/FoodWebDiagram';
import { EnzymeSubstrateDiagram } from './diagrams/EnzymeSubstrateDiagram';

export type BiologyDiagramConfig = BiologyDiagramConfigType;

const MissingDiagram: React.FC<{ type?: string }> = ({ type }) => {
  if (typeof window !== 'undefined' && (import.meta as any)?.env?.DEV) {
    console.warn(`BiologyDiagramDraw: no renderer for type "${type}"`);
  }
  return null;
};

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
      case 'bacterial_cell': return <BacterialCellDiagram {...props} />;
      case 'neuron': return <NeuronDiagram {...props} />;
      case 'heart': return <HeartDiagram {...props} />;
      case 'dna_helix': return <DnaHelixDiagram {...props} />;
      case 'mitosis': return <MitosisDiagram {...props} />;
      case 'punnett_square': return <PunnettSquareDiagram config={config} />;
      case 'food_web':
      case 'food_chain':
      case 'ecological_pyramid': return <FoodWebDiagram config={config} />;
      case 'enzyme_substrate': return <EnzymeSubstrateDiagram config={config} />;
      default: return <MissingDiagram type={(config as any).type} />;
    }
  } catch {
    return <MissingDiagram type={config?.type} />;
  }
};

export default BiologyDiagramDraw;
