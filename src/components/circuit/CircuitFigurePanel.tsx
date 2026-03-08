import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Zap, ZoomIn } from 'lucide-react';
import CircuitDraw from './CircuitDraw';
import type { CircuitConfig } from './types';
import { useIsMobile } from '@/hooks/use-mobile';

interface CircuitFigurePanelProps {
  config: CircuitConfig;
  figureNumber?: number;
}

const CircuitFigurePanel: React.FC<CircuitFigurePanelProps> = ({ config, figureNumber = 1 }) => {
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
        <Zap className="h-3.5 w-3.5" />
        Circuit {figureNumber}
      </Button>
    );
  }

  return (
    <>
      <div
        className={`mb-4 ${isMobile ? 'w-full' : 'w-full max-w-[540px]'}`}
        style={{
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: 4,
          padding: 12,
          overflow: 'visible',
          height: 'auto',
          minHeight: 'unset',
          cursor: 'zoom-in',
          position: 'relative',
        }}
        onClick={() => setEnlarged(true)}
      >
        <div className="flex items-center justify-between pb-1">
          <span style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>Circuit {figureNumber}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
            <X className="h-3.5 w-3.5" style={{ color: '#333' }} />
          </Button>
        </div>
        <div className="flex items-center justify-center w-full" style={{ height: 'auto' }}>
          <CircuitDraw config={config} width={500} />
        </div>
        {/* Zoom hint */}
        <div style={{ position: 'absolute', bottom: 8, right: 10, opacity: 0.4 }}>
          <ZoomIn size={14} color="#333" />
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
              CIRCUIT {figureNumber} — click outside to close
            </p>
            <CircuitDraw config={config} width={720} />
          </div>
        </div>
      )}
    </>
  );
};

export default CircuitFigurePanel;
