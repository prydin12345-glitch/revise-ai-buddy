import React, { useState, useCallback } from 'react';
import { BiologyDiagramDraw, ChemistryDiagramDraw } from '@/components/biology';
import type { BiologyDiagramConfig } from '@/components/biology/BiologyDiagramDraw';
import type { ChemistryDiagramConfig } from '@/components/biology/ChemistryDiagramDraw';
import { Button } from '@/components/ui/button';

const biologyExamples: { title: string; config: BiologyDiagramConfig }[] = [
  { title: 'Animal Cell', config: { type: 'animal_cell', showLabels: true, labelMode: 'visible' } },
  { title: 'Plant Cell', config: { type: 'plant_cell', showLabels: true, labelMode: 'visible' } },
  { title: 'Neuron', config: { type: 'neuron', showLabels: true, labelMode: 'visible' } },
  { title: 'Heart', config: { type: 'heart', showLabels: true, labelMode: 'visible' } },
  { title: 'DNA Double Helix', config: { type: 'dna_helix', showLabels: true, labelMode: 'visible' } },
  { title: 'Mitosis Stages', config: { type: 'mitosis', showLabels: true, labelMode: 'visible' } },
];

const chemistryExamples: { title: string; config: ChemistryDiagramConfig }[] = [
  { title: 'Titration Setup', config: { type: 'titration', showLabels: true, labelMode: 'visible' } },
  { title: 'Reflux Condenser', config: { type: 'reflux', showLabels: true, labelMode: 'visible' } },
  { title: 'Electrolysis Cell', config: { type: 'electrolysis', showLabels: true, labelMode: 'visible' } },
  {
    title: 'Dot & Cross — NaCl (ionic)',
    config: {
      type: 'dot_cross',
      showLabels: true,
      labelMode: 'visible',
      dotCrossConfig: {
        type: 'dot_cross',
        molecule: 'NaCl',
        atoms: [
          { symbol: 'Na', electrons: 1, shell: 3, color: '#f59e0b', dotStyle: 'dot' },
          { symbol: 'Cl', electrons: 7, shell: 3, color: '#8b5cf6', dotStyle: 'cross' },
        ],
        bondType: 'ionic',
      },
    },
  },
  {
    title: 'Dot & Cross — H₂O (covalent)',
    config: {
      type: 'dot_cross',
      showLabels: true,
      labelMode: 'visible',
      dotCrossConfig: {
        type: 'dot_cross',
        molecule: 'H₂O',
        atoms: [
          { symbol: 'H', electrons: 1, shell: 1, color: '#ef4444', dotStyle: 'dot' },
          { symbol: 'O', electrons: 6, shell: 2, color: '#3b82f6', dotStyle: 'cross' },
          { symbol: 'H', electrons: 1, shell: 1, color: '#ef4444', dotStyle: 'dot' },
        ],
        bondType: 'covalent',
      },
    },
  },
  { title: 'Chromatography', config: { type: 'chromatography', showLabels: true, labelMode: 'visible' } },
];

const DiagramCard: React.FC<{
  title: string;
  children: React.ReactNode;
  labelMode: 'visible' | 'hidden';
  onToggle: () => void;
}> = ({ title, children, labelMode, onToggle }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <Button variant="outline" size="sm" onClick={onToggle} className="text-xs">
        {labelMode === 'visible' ? 'Hide labels' : 'Show labels'}
      </Button>
    </div>
    {children}
  </div>
);

const ScienceDiagramDemo: React.FC = () => {
  const [modes, setModes] = useState<Record<string, 'visible' | 'hidden'>>({});
  const [revealed, setRevealed] = useState<Record<string, Set<string>>>({});

  const getMode = (key: string): 'visible' | 'hidden' => modes[key] || 'visible';

  const toggleMode = useCallback((key: string) => {
    setModes(prev => ({ ...prev, [key]: prev[key] === 'hidden' ? 'visible' : 'hidden' }));
    setRevealed(prev => ({ ...prev, [key]: new Set() }));
  }, []);

  const handleLabelClick = useCallback((diagramKey: string, labelId: string) => {
    setRevealed(prev => {
      const current = new Set(prev[diagramKey] || []);
      if (current.has(labelId)) current.delete(labelId);
      else current.add(labelId);
      return { ...prev, [diagramKey]: current };
    });
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-2xl font-bold mb-2 text-foreground">Science Diagram Library</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Toggle "Hide labels" to test exam-mode labelling. Click the ? boxes to reveal answers.
      </p>

      <h2 className="text-lg font-semibold mb-4 text-foreground border-b pb-2">Biology</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {biologyExamples.map(ex => {
          const key = ex.config.type;
          const mode = getMode(key);
          return (
            <DiagramCard key={key} title={ex.title} labelMode={mode} onToggle={() => toggleMode(key)}>
              <BiologyDiagramDraw
                config={{
                  ...ex.config,
                  labelMode: mode,
                  showLabels: true,
                  revealedLabels: revealed[key] || new Set(),
                  onLabelClick: (id) => handleLabelClick(key, id),
                }}
              />
            </DiagramCard>
          );
        })}
      </div>

      <h2 className="text-lg font-semibold mb-4 text-foreground border-b pb-2">Chemistry</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {chemistryExamples.map((ex, i) => {
          const key = `${ex.config.type}-${i}`;
          const mode = getMode(key);
          return (
            <DiagramCard key={key} title={ex.title} labelMode={mode} onToggle={() => toggleMode(key)}>
              <ChemistryDiagramDraw
                config={{
                  ...ex.config,
                  labelMode: mode,
                  showLabels: true,
                  revealedLabels: revealed[key] || new Set(),
                  onLabelClick: (id) => handleLabelClick(key, id),
                }}
              />
            </DiagramCard>
          );
        })}
      </div>
    </div>
  );
};

export default ScienceDiagramDemo;
