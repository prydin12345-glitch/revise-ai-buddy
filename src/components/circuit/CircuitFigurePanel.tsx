import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Zap } from 'lucide-react';
import CircuitDraw from './CircuitDraw';
import type { CircuitConfig } from './types';
import { useIsMobile } from '@/hooks/use-mobile';

interface CircuitFigurePanelProps {
  config: CircuitConfig;
  figureNumber?: number;
}

const CircuitFigurePanel: React.FC<CircuitFigurePanelProps> = ({ config, figureNumber = 1 }) => {
  const [open, setOpen] = useState(false);
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
    <div
      className={`mb-4 rounded-lg border bg-card ${isMobile ? 'w-full' : 'w-full max-w-[540px]'}`}
      style={{ overflow: 'visible', height: 'auto', minHeight: 'unset' }}
    >
      <div className="flex items-center justify-between p-3 pb-0">
        <span className="text-xs font-semibold text-muted-foreground">Circuit {figureNumber}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex items-center justify-center w-full p-4" style={{ height: 'auto' }}>
        <CircuitDraw config={config} width={500} />
      </div>
    </div>
  );
};

export default CircuitFigurePanel;
