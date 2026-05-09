import React, { useState } from 'react';
import MechanicsDraw from './MechanicsDraw';
import { DiagramModal, ZoomHint } from '@/components/shared/DiagramModal';
import type { MechanicsConfig } from './types';

interface MechanicsFigurePanelProps {
  config: MechanicsConfig;
  figureNumber?: number;
  isExam?: boolean;
}

const MechanicsFigurePanel: React.FC<MechanicsFigurePanelProps> = ({
  config,
  figureNumber = 1,
  isExam = false,
}) => {
  const [enlarged, setEnlarged] = useState(false);
  if (isExam) return null;

  return (
    <>
      {/* Inline diagram — clickable to enlarge */}
      <div
        className="diagram-zoomable mb-4 w-full max-w-[480px]"
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
          <MechanicsDraw config={config} width={440} />
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

      {/* Enlarged modal */}
      <DiagramModal
        open={enlarged}
        onClose={() => setEnlarged(false)}
        title={`Figure ${figureNumber}`}
      >
        <MechanicsDraw config={config} width={860} />
      </DiagramModal>
    </>
  );
};

export default MechanicsFigurePanel;
