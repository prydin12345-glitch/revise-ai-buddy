import React, { useState } from 'react';
import { EconomicsDiagramDraw } from './EconomicsDiagramDraw';
import { DiagramModal, ZoomHint } from '@/components/shared/DiagramModal';
import type { EconomicsDiagramConfig } from './types';

interface EconomicsFigurePanelProps {
  config: EconomicsDiagramConfig;
  figureNumber?: number;
}

const EconomicsFigurePanel: React.FC<EconomicsFigurePanelProps> = ({
  config,
  figureNumber = 1,
}) => {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <>
      <div
        className="diagram-zoomable mb-4 w-full max-w-[520px]"
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
          <EconomicsDiagramDraw config={config} />
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
          Figure {figureNumber}
        </div>
      </div>

      <DiagramModal
        open={enlarged}
        onClose={() => setEnlarged(false)}
        title={`Figure ${figureNumber}`}
      >
        <div style={{ padding: 16 }}>
          <EconomicsDiagramDraw config={config} />
        </div>
      </DiagramModal>
    </>
  );
};

export default EconomicsFigurePanel;
