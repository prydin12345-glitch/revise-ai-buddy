import React, { useState } from 'react';
import CircuitDraw from './CircuitDraw';
import { DiagramModal, ZoomHint } from '@/components/shared/DiagramModal';
import type { CircuitConfig } from './types';

interface CircuitFigurePanelProps {
  config: CircuitConfig;
  figureNumber?: number;
}

const CircuitFigurePanel: React.FC<CircuitFigurePanelProps> = ({
  config,
  figureNumber = 1,
}) => {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <>
      {/* Inline diagram — clickable to enlarge */}
      <div
        className="diagram-zoomable mb-4 w-full max-w-[540px]"
        onClick={() => setEnlarged(true)}
        style={{
          position: 'relative',
          cursor: 'zoom-in',
          background: 'white',
          border: '1px solid hsl(var(--border))',
          borderRadius: 8,
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <div className="p-3">
          <CircuitDraw config={config} width={500} />
        </div>
        <ZoomHint />

        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 10,
            fontSize: 10,
            color: 'hsl(var(--muted-foreground))',
            letterSpacing: '0.04em',
          }}
        >
          Circuit {figureNumber}
        </div>
      </div>

      {/* Enlarged modal */}
      <DiagramModal
        open={enlarged}
        onClose={() => setEnlarged(false)}
        title={`Circuit ${figureNumber}`}
      >
        <CircuitDraw config={config} width={860} />
      </DiagramModal>
    </>
  );
};

export default CircuitFigurePanel;
