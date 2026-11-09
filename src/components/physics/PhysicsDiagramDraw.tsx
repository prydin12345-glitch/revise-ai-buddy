import { RayDiagramRenderer } from './diagrams/RayDiagramRenderer';
import { WaveDiagramRenderer } from './diagrams/WaveDiagramRenderer';
import { MagneticFieldRenderer } from './diagrams/MagneticFieldRenderer';
import { NuclearDecayRenderer } from './diagrams/NuclearDecayRenderer';
import { EMSpectrumRenderer } from './diagrams/EMSpectrumRenderer';
import type { PhysicsDiagramConfig } from './types';

interface Props {
  config: PhysicsDiagramConfig;
  mode?: 'assessment' | 'solution';
}

export const PhysicsDiagramDraw = ({ config, mode = 'solution' }: Props) => {
  switch (config.type) {
    case 'ray_diagram':
      return <RayDiagramRenderer config={config} mode={mode} />;
    case 'wave_diagram':
      return <WaveDiagramRenderer config={config} mode={mode} />;
    case 'magnetic_field':
      return <MagneticFieldRenderer config={config} mode={mode} />;
    case 'nuclear_decay':
      return <NuclearDecayRenderer config={config} mode={mode} />;
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
