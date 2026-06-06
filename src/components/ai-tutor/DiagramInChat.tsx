import { Suspense, lazy } from 'react';
import { Loader2, ImageIcon } from 'lucide-react';
import type { DiagramSignal } from './diagram-lookup';

// Lazy-load subject dispatchers so the chat bundle stays light.
const BiologyDiagramDraw = lazy(() => import('@/components/biology/BiologyDiagramDraw'));
const ChemistryDiagramDraw = lazy(() => import('@/components/biology/ChemistryDiagramDraw'));
const PhysicsDiagramDraw = lazy(() =>
  import('@/components/physics/PhysicsDiagramDraw').then(m => ({ default: m.PhysicsDiagramDraw }))
);
const EconomicsDiagramDraw = lazy(() =>
  import('@/components/economics/EconomicsDiagramDraw').then(m => ({ default: m.EconomicsDiagramDraw }))
);
const MathsDiagramDraw = lazy(() =>
  import('@/components/maths/MathsDiagramDraw').then(m => ({ default: m.MathsDiagramDraw }))
);

interface DiagramInChatProps {
  signal: DiagramSignal;
}

export const DiagramInChat = ({ signal }: DiagramInChatProps) => {
  const config: any = {
    type: signal.type,
    ...(signal.config ?? {}),
  };

  const renderDispatcher = () => {
    switch (signal.subject) {
      case 'biology':    return <BiologyDiagramDraw config={config} />;
      case 'chemistry':  return <ChemistryDiagramDraw config={config} />;
      case 'physics':    return <PhysicsDiagramDraw config={config} />;
      case 'economics':  return <EconomicsDiagramDraw config={config} />;
      case 'maths':      return <MathsDiagramDraw config={config} />;
      default:           return null;
    }
  };

  const label = signal.type.replace(/_/g, ' ');

  return (
    <div className="my-2 rounded-xl border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-muted/40">
        <ImageIcon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="p-3 flex items-center justify-center bg-white">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          }
        >
          {renderDispatcher()}
        </Suspense>
      </div>
    </div>
  );
};

export default DiagramInChat;
