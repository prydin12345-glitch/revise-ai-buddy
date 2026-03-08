import React from 'react';
import CircuitDraw from '@/components/circuit/CircuitDraw';
import type { CircuitConfig } from '@/components/circuit/types';
import VerticalLiftRenderer, { type VerticalLiftConfig } from './VerticalLiftRenderer';
import { ArrowMarkerDefs } from '../svg-helpers';

export interface DualConfig {
  type: 'dual';
  left: CircuitConfig;
  right: VerticalLiftConfig;
}

const DualRenderer: React.FC<{ config: DualConfig }> = ({ config }) => {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
      {/* Circuit side */}
      <div style={{ flex: '1 1 220px', minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>Circuit</div>
        <CircuitDraw config={config.left} width={260} />
      </div>
      {/* Mechanics side */}
      <div style={{ flex: '1 1 220px', minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>Mechanics</div>
        <svg
          viewBox="0 0 480 320"
          width="100%"
          style={{ maxWidth: 260, display: 'block', background: 'white', borderRadius: 4, border: '1px solid #e5e7eb' }}
        >
          <g transform="translate(20, 10)">
            <ArrowMarkerDefs />
            <VerticalLiftRenderer config={config.right} />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default DualRenderer;
