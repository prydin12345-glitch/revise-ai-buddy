import React from 'react';
import BiologyDiagramDraw, { type BiologyDiagramConfig } from '@/components/biology/BiologyDiagramDraw';

export interface MultiDiagramOption {
  label: string;            // e.g. "A", "B", "C", "D"
  type: string;             // biology diagram type, e.g. "neuron"
  variant?: string;         // optional variant hint (not all diagrams use this)
  [key: string]: any;       // pass-through for diagram-specific keys
}

interface MultiDiagramOptionPanelProps {
  diagrams: MultiDiagramOption[];
  className?: string;
}

/**
 * Renders 2–4 small diagrams side-by-side, labelled A/B/C/D.
 * Used for MCQs like "Which of the following diagrams A to D shows a sensory neurone?".
 */
export const MultiDiagramOptionPanel: React.FC<MultiDiagramOptionPanelProps> = ({
  diagrams,
  className = '',
}) => {
  if (!Array.isArray(diagrams) || diagrams.length === 0) return null;

  const cols = diagrams.length >= 4 ? 'sm:grid-cols-4' : diagrams.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <div className={`grid grid-cols-2 ${cols} gap-3 my-4 ${className}`}>
      {diagrams.map((d, i) => {
        const { label, ...rest } = d;
        const config = { ...rest, scale: 0.6 } as BiologyDiagramConfig;
        return (
          <div
            key={`${label}-${i}`}
            className="relative rounded-lg border border-border bg-card p-2 flex flex-col items-center"
          >
            <div className="absolute top-2 left-2 z-10 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {label}
            </div>
            <div className="w-full flex items-center justify-center pt-4">
              <BiologyDiagramDraw config={config} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MultiDiagramOptionPanel;
