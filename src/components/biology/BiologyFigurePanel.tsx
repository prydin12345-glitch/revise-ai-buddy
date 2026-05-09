import React, { useState } from 'react';
import BiologyDiagramDraw from './BiologyDiagramDraw';
import { DiagramModal, ZoomHint } from '@/components/shared/DiagramModal';
import type { BiologyDiagramConfig } from './types';

interface BiologyFigurePanelProps {
  config: BiologyDiagramConfig;
  figureNumber?: number;
  isExam?: boolean;
}

const BiologyFigurePanel: React.FC<BiologyFigurePanelProps> = ({
  config,
  figureNumber = 1,
  isExam = false,
}) => {
  const [enlarged, setEnlarged] = useState(false);
  if (isExam) return null;

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
          <BiologyDiagramDraw config={config} />
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
          <BiologyDiagramDraw config={{ ...config, scale: 1.6 }} />
        </div>
      </DiagramModal>
    </>
  );
};

export default BiologyFigurePanel;
