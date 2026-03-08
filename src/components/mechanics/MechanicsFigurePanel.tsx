import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Image, ZoomIn } from 'lucide-react';
import MechanicsDraw from './MechanicsDraw';
import type { MechanicsConfig } from './types';
import { useIsMobile } from '@/hooks/use-mobile';

interface MechanicsFigurePanelProps {
  config: MechanicsConfig;
  figureNumber?: number;
}

const MechanicsFigurePanel: React.FC<MechanicsFigurePanelProps> = ({ config, figureNumber = 1 }) => {
  const [open, setOpen] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const isMobile = useIsMobile();

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="mb-3 gap-1.5 text-xs"
      >
        <Image className="h-3.5 w-3.5" />
        Figure {figureNumber}
      </Button>
    );
  }

  return (
    <>
      <div
        className={`mb-4 rounded-lg border bg-card ${isMobile ? 'w-full' : 'w-full max-w-[480px]'}`}
        style={{ overflow: 'visible', cursor: 'zoom-in', position: 'relative' }}
        onClick={() => setEnlarged(true)}
      >
        <div className="flex items-center justify-between p-3 pb-0">
          <span className="text-xs font-semibold text-muted-foreground">Figure {figureNumber}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center justify-center w-full p-4">
          <MechanicsDraw config={config} width={440} />
        </div>
        {/* Zoom hint */}
        <div style={{ position: 'absolute', bottom: 8, right: 10, opacity: 0.4 }}>
          <ZoomIn size={14} />
        </div>
      </div>

      {/* Enlarged modal */}
      {enlarged && (
        <div
          onClick={() => setEnlarged(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 8,
              padding: 24,
              maxWidth: '70vw',
              maxHeight: '75vh',
              overflow: 'auto',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              position: 'relative',
              cursor: 'default',
            }}
          >
            <button
              onClick={() => setEnlarged(false)}
              style={{
                position: 'absolute', top: 10, right: 12,
                background: 'none', border: 'none',
                fontSize: 18, cursor: 'pointer', color: '#666',
              }}
            >✕</button>
            <p style={{ fontSize: 11, color: '#888', letterSpacing: '0.1em', marginBottom: 12 }}>
              FIGURE {figureNumber} — click outside to close
            </p>
            <MechanicsDraw config={config} width={660} />
          </div>
        </div>
      )}
    </>
  );
};

export default MechanicsFigurePanel;
