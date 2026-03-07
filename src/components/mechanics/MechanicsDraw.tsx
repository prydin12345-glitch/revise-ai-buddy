import React from 'react';
import { MechanicsConfig, COLORS } from './types';
import { ArrowMarkerDefs } from './svg-helpers';
import SlopeRenderer from './renderers/SlopeRenderer';
import PulleyRenderer from './renderers/PulleyRenderer';
import BeamRenderer from './renderers/BeamRenderer';
import ProjectileRenderer from './renderers/ProjectileRenderer';
import RodRenderer from './renderers/RodRenderer';
import FreeBodyRenderer from './renderers/FreeBodyRenderer';
import ConicalPendulumRenderer from './renderers/ConicalPendulumRenderer';
import VerticalMotionRenderer from './renderers/VerticalMotionRenderer';

export interface MechanicsDrawProps {
  config: MechanicsConfig;
  width?: number;
  height?: number;
}

const MechanicsDraw: React.FC<MechanicsDrawProps> = ({ config, width = 400, height = 300 }) => {
  const renderDiagram = () => {
    switch (config.type) {
      case 'slope':
        return <SlopeRenderer config={config} />;
      case 'pulley':
        return <PulleyRenderer config={config} />;
      case 'beam':
        return <BeamRenderer config={config} />;
      case 'projectile':
        return <ProjectileRenderer config={config} />;
      case 'rod':
        return <RodRenderer config={config} />;
      case 'free_body':
        return <FreeBodyRenderer config={config} />;
      case 'conical_pendulum':
        return <ConicalPendulumRenderer config={config} />;
      case 'vertical_motion':
        return <VerticalMotionRenderer config={config} />;
      default:
        return null;
    }
  };

  return (
    <svg
      viewBox="0 0 480 380"
      width="100%"
      style={{ maxWidth: width, display: 'block', margin: '0 auto', background: COLORS.background, border: '1px solid #e5e7eb', borderRadius: 6 }}
    >
      <g transform="translate(40, 40)">
        <ArrowMarkerDefs />
        {renderDiagram()}
      </g>
    </svg>
  );
};

export default MechanicsDraw;
