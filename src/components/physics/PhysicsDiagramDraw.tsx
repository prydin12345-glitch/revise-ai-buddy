import { RayDiagramRenderer } from './diagrams/RayDiagramRenderer';
import { WaveDiagramRenderer } from './diagrams/WaveDiagramRenderer';
import { MagneticFieldRenderer } from './diagrams/MagneticFieldRenderer';
import { NuclearDecayRenderer } from './diagrams/NuclearDecayRenderer';
import { EMSpectrumRenderer } from './diagrams/EMSpectrumRenderer';
import type { PhysicsDiagramConfig } from './types';

interface Props {
  config: PhysicsDiagramConfig;
}

export const PhysicsDiagramDraw = ({ config }: Props) => {
  switch (config.type) {
    case 'ray_diagram':
      return <RayDiagramRenderer config={config} />;
    case 'wave_diagram':
      return <WaveDiagramRenderer config={config} />;
    case 'magnetic_field':
      return <MagneticFieldRenderer config={config} />;
    case 'nuclear_decay':
      return <NuclearDecayRenderer config={config} />;
    case 'electromagnetic_spectrum':
      return <EMSpectrumRenderer config={config} />;
    default:
      if (typeof window !== 'undefined' && (import.meta as any)?.env?.DEV) {
        console.warn(`PhysicsDiagramDraw: no renderer for type "${(config as any).type}"`);
      }
      return null;
  }
};

export default PhysicsDiagramDraw;
