import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Image } from 'lucide-react';
import { MechanicsDraw } from './MechanicsDraw';
import type { MechanicsConfig } from './types';
import { useIsMobile } from '@/hooks/use-mobile';

interface MechanicsFigurePanelProps {
  config: MechanicsConfig;
  figureNumber?: number;
}

const MechanicsFigurePanel: React.FC<MechanicsFigurePanelProps> = ({ config, figureNumber = 1 }) => {
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
        <Image className="h-3.5 w-3.5" />
        Figure {figureNumber}
      </Button>
    );
  }

  return (
    <div className={`mb-4 rounded-lg border bg-card p-3 ${isMobile ? 'w-full' : 'w-full max-w-[420px]'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">Figure {figureNumber}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <MechanicsDraw config={config} />
    </div>
  );
};

export default MechanicsFigurePanel;
