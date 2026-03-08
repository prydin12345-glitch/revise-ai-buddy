import React from 'react';
import type { DiagramProps } from './types';
import TitrationDiagram from './diagrams/TitrationDiagram';
import RefluxDiagram from './diagrams/RefluxDiagram';
import ElectrolysisDiagram from './diagrams/ElectrolysisDiagram';
import DotCrossDiagram, { type DotCrossConfig } from './diagrams/DotCrossDiagram';
import ChromatographyDiagram from './diagrams/ChromatographyDiagram';

export interface ChemistryDiagramConfig extends DiagramProps {
  type: 'titration' | 'reflux' | 'electrolysis' | 'dot_cross' | 'chromatography';
  dotCrossConfig?: DotCrossConfig;
}

const MissingDiagram: React.FC<{ type?: string }> = ({ type }) => (
  <svg width="300" height="80" style={{ background: 'white', display: 'block', margin: '0 auto' }}>
    <rect x="8" y="8" width="284" height="64"
      fill="#fff8f8" stroke="#cc0000" strokeWidth={1} strokeDasharray="4 2" rx={4} />
    <text x="150" y="40" textAnchor="middle" fontSize="11" fill="#cc0000" fontFamily="serif">
      Chemistry diagram "{type || 'unknown'}" not recognised
    </text>
  </svg>
);

const ChemistryDiagramDraw: React.FC<{ config: ChemistryDiagramConfig }> = ({ config }) => {
  try {
    const props: DiagramProps = {
      showLabels: config.showLabels,
      labelMode: config.labelMode,
      revealedLabels: config.revealedLabels,
      onLabelClick: config.onLabelClick,
      scale: config.scale,
    };

    switch (config.type) {
      case 'titration': return <TitrationDiagram {...props} />;
      case 'reflux': return <RefluxDiagram {...props} />;
      case 'electrolysis': return <ElectrolysisDiagram {...props} />;
      case 'dot_cross': return <DotCrossDiagram {...props} config={config.dotCrossConfig} />;
      case 'chromatography': return <ChromatographyDiagram {...props} />;
      default: return <MissingDiagram type={(config as any).type} />;
    }
  } catch {
    return <MissingDiagram type={config?.type} />;
  }
};

export default ChemistryDiagramDraw;
