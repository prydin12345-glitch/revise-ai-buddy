import { SupplyDemandDiagram } from './diagrams/SupplyDemandDiagram';
import { PPFDiagram } from './diagrams/PPFDiagram';
import { LorenzCurveDiagram } from './diagrams/LorenzCurveDiagram';
import { BreakEvenDiagram } from './diagrams/BreakEvenDiagram';
import type { EconomicsDiagramConfig } from './types';

interface Props { config: EconomicsDiagramConfig; }

export const EconomicsDiagramDraw = ({ config }: Props) => {
  switch (config.type) {
    case 'supply_demand': return <SupplyDemandDiagram config={config} />;
    case 'ppf': return <PPFDiagram config={config} />;
    case 'lorenz_curve': return <LorenzCurveDiagram config={config} />;
    case 'break_even': return <BreakEvenDiagram config={config} />;
    default:
      if (typeof window !== 'undefined' && (import.meta as any)?.env?.DEV) {
        console.warn(`EconomicsDiagramDraw: no renderer for type "${(config as any).type}"`);
      }
      return null;
  }
};

export default EconomicsDiagramDraw;
