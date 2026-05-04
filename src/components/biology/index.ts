export { default as BiologyDiagramDraw } from './BiologyDiagramDraw';
export { default as BiologyFigurePanel } from './BiologyFigurePanel';
export type { BiologyDiagramConfig } from './BiologyDiagramDraw';
export { detectBiologyDiagram } from './biology-detector';
export { default as ChemistryDiagramDraw } from './ChemistryDiagramDraw';
export type { ChemistryDiagramConfig } from './ChemistryDiagramDraw';
export { default as DiagramLabel } from './DiagramLabel';
export { default as DiagramShell } from './DiagramShell';
export * from './types';

// Re-export metadata
export { animalCellMeta } from './diagrams/AnimalCellDiagram';
export { plantCellMeta } from './diagrams/PlantCellDiagram';
export { bacterialCellMeta } from './diagrams/BacterialCellDiagram';
export { neuronMeta } from './diagrams/NeuronDiagram';
export { heartMeta } from './diagrams/HeartDiagram';
export { dnaHelixMeta } from './diagrams/DnaHelixDiagram';
export { mitosisMeta } from './diagrams/MitosisDiagram';
export { titrationMeta } from './diagrams/TitrationDiagram';
export { refluxMeta } from './diagrams/RefluxDiagram';
export { electrolysisMeta } from './diagrams/ElectrolysisDiagram';
export { dotCrossMeta } from './diagrams/DotCrossDiagram';
export { chromatographyMeta } from './diagrams/ChromatographyDiagram';
