import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const mitosisMeta: DiagramMeta = {
  diagramKey: 'mitosis',
  labelData: [
    { id: 'prophase', displayName: 'Prophase', x: 75, y: 375 },
    { id: 'metaphase', displayName: 'Metaphase', x: 200, y: 375 },
    { id: 'anaphase', displayName: 'Anaphase', x: 325, y: 375 },
    { id: 'telophase', displayName: 'Telophase', x: 450, y: 375 },
    { id: 'chromosome', displayName: 'Chromosome', x: 75, y: 20, anchorX: 65, anchorY: 150 },
    { id: 'spindle_fibre', displayName: 'Spindle fibre', x: 200, y: 20, anchorX: 200, anchorY: 130 },
    { id: 'cell_membrane', displayName: 'Cell membrane', x: 325, y: 20, anchorX: 325, anchorY: 80 },
    { id: 'nucleus', displayName: 'Nucleus', x: 450, y: 20, anchorX: 430, anchorY: 200 },
  ],
};

/** A single mitosis stage panel */
const StagePanel: React.FC<{ cx: number; stage: string }> = ({ cx, stage }) => {
  const cy = 200;
  const rx = 52;
  const ry = 80;

  return (
    <g>
      {/* Cell outline */}
      {stage === 'telophase' ? (
        <>
          {/* Pinching cell */}
          <ellipse cx={cx - 20} cy={cy - 25} rx={30} ry={50} fill="#fef9c3" stroke="#1a1a1a" strokeWidth={1.5} />
          <ellipse cx={cx + 20} cy={cy + 25} rx={30} ry={50} fill="#fef9c3" stroke="#1a1a1a" strokeWidth={1.5} />
          {/* Re-forming nuclei */}
          <ellipse cx={cx - 20} cy={cy - 25} rx={14} ry={18} fill="#dbeafe" stroke="#1a1a1a" strokeWidth={1} strokeDasharray="3 2" />
          <ellipse cx={cx + 20} cy={cy + 25} rx={14} ry={18} fill="#dbeafe" stroke="#1a1a1a" strokeWidth={1} strokeDasharray="3 2" />
          {/* Chromosomes decondensing */}
          {[[-25, -30], [-15, -20], [15, 20], [25, 30]].map(([dx, dy], i) => (
            <line key={i} x1={cx + dx - 4} y1={cy + dy - 4} x2={cx + dx + 4} y2={cy + dy + 4}
              stroke="#7c3aed" strokeWidth={1.5} opacity={0.6} />
          ))}
        </>
      ) : (
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fef9c3" stroke="#1a1a1a" strokeWidth={1.5} />
      )}

      {stage === 'prophase' && (
        <>
          {/* Condensing chromosomes — X shapes */}
          {[[-15, -20], [10, -10], [-5, 15], [15, 20]].map(([dx, dy], i) => (
            <g key={i} transform={`translate(${cx + dx}, ${cy + dy})`}>
              <line x1={-5} y1={-6} x2={5} y2={6} stroke="#7c3aed" strokeWidth={2.5} />
              <line x1={5} y1={-6} x2={-5} y2={6} stroke="#7c3aed" strokeWidth={2.5} />
            </g>
          ))}
          {/* Dissolving nuclear envelope */}
          <ellipse cx={cx} cy={cy} rx={28} ry={35} fill="none" stroke="#64748b" strokeWidth={1} strokeDasharray="4 3" />
          {/* Spindle beginning to form */}
          <line x1={cx} y1={cy - ry + 10} x2={cx - 10} y2={cy - 20} stroke="#94a3b8" strokeWidth={0.8} />
          <line x1={cx} y1={cy + ry - 10} x2={cx + 10} y2={cy + 20} stroke="#94a3b8" strokeWidth={0.8} />
        </>
      )}

      {stage === 'metaphase' && (
        <>
          {/* Chromosomes aligned at equator */}
          {[-18, -6, 6, 18].map((dx, i) => (
            <g key={i} transform={`translate(${cx + dx}, ${cy})`}>
              <line x1={-3} y1={-6} x2={3} y2={6} stroke="#7c3aed" strokeWidth={2.5} />
              <line x1={3} y1={-6} x2={-3} y2={6} stroke="#7c3aed" strokeWidth={2.5} />
            </g>
          ))}
          {/* Spindle fibres to poles */}
          {[-18, -6, 6, 18].map((dx, i) => (
            <g key={`sf-${i}`}>
              <line x1={cx + dx} y1={cy - 8} x2={cx} y2={cy - ry + 8} stroke="#94a3b8" strokeWidth={0.8} />
              <line x1={cx + dx} y1={cy + 8} x2={cx} y2={cy + ry - 8} stroke="#94a3b8" strokeWidth={0.8} />
            </g>
          ))}
          {/* Poles */}
          <circle cx={cx} cy={cy - ry + 8} r={3} fill="#94a3b8" />
          <circle cx={cx} cy={cy + ry - 8} r={3} fill="#94a3b8" />
        </>
      )}

      {stage === 'anaphase' && (
        <>
          {/* Chromosomes being pulled to poles */}
          {[-12, 0, 12].map((dx, i) => (
            <g key={i}>
              {/* Top set */}
              <line x1={cx + dx - 3} y1={cy - 30 - i * 5} x2={cx + dx + 3} y2={cy - 22 - i * 5}
                stroke="#7c3aed" strokeWidth={2} />
              {/* Bottom set */}
              <line x1={cx + dx - 3} y1={cy + 30 + i * 5} x2={cx + dx + 3} y2={cy + 22 + i * 5}
                stroke="#7c3aed" strokeWidth={2} />
              {/* Spindle fibres */}
              <line x1={cx + dx} y1={cy - 30 - i * 5} x2={cx} y2={cy - ry + 5} stroke="#94a3b8" strokeWidth={0.7} />
              <line x1={cx + dx} y1={cy + 30 + i * 5} x2={cx} y2={cy + ry - 5} stroke="#94a3b8" strokeWidth={0.7} />
            </g>
          ))}
          {/* Poles */}
          <circle cx={cx} cy={cy - ry + 5} r={3} fill="#94a3b8" />
          <circle cx={cx} cy={cy + ry - 5} r={3} fill="#94a3b8" />
        </>
      )}
    </g>
  );
};

const MitosisDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = mitosisMeta.labelData;
  const stages: { cx: number; stage: string }[] = [
    { cx: 75, stage: 'prophase' },
    { cx: 200, stage: 'metaphase' },
    { cx: 325, stage: 'anaphase' },
    { cx: 450, stage: 'telophase' },
  ];

  return (
    <DiagramShell viewBox="0 0 530 400" maxWidth={530 * scale}>
      {stages.map(s => <StagePanel key={s.stage} {...s} />)}

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default MitosisDiagram;
