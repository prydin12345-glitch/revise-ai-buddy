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
import VerticalLiftRenderer from './renderers/VerticalLiftRenderer';
import DualRenderer from './renderers/DualRenderer';

export interface MechanicsDrawProps {
  config: MechanicsConfig;
  width?: number;
  height?: number;
}

/** Visible error placeholder for broken/unknown configs */
const MissingDiagram: React.FC<{ type?: string; error?: string }> = ({ type, error }) => (
  <svg width="300" height="80" style={{ background: 'white', display: 'block', margin: '0 auto' }}>
    <rect x="8" y="8" width="284" height="64"
      fill="#fff8f8" stroke="#cc0000" strokeWidth={1} strokeDasharray="4 2" rx={4} />
    <text x="150" y="32" textAnchor="middle"
      fontSize="11" fill="#cc0000" fontFamily="serif">
      Diagram type &quot;{type || 'unknown'}&quot; not rendered
    </text>
    {error && (
      <text x="150" y="52" textAnchor="middle"
        fontSize="10" fill="#cc0000" fontFamily="serif" fontStyle="italic">
        {error}
      </text>
    )}
  </svg>
);

const MechanicsDraw: React.FC<MechanicsDrawProps> = ({ config, width = 400, height = 300 }) => {
  try {
    if (!config) return null;

    // Dual type renders side-by-side, not inside a single SVG
    if (config.type === 'dual') {
      return <DualRenderer config={config as any} />;
    }

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
        case 'vertical_lift':
          return <VerticalLiftRenderer config={config as any} />;
        default:
          return null;
      }
    };

    const diagram = renderDiagram();
    if (!diagram) {
      return <MissingDiagram type={config.type} />;
    }

    return (
      <svg
        viewBox="0 0 480 380"
        width="100%"
        style={{ maxWidth: width, display: 'block', margin: '0 auto', background: COLORS.background, border: '1px solid #e5e7eb', borderRadius: 6 }}
      >
        <g transform="translate(40, 40)">
          <ArrowMarkerDefs />
          {diagram}
        </g>
      </svg>
    );
  } catch (err: any) {
    return <MissingDiagram type={config?.type} error={err?.message} />;
  }
};

export default MechanicsDraw;
