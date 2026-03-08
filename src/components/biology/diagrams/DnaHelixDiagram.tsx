import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const dnaHelixMeta: DiagramMeta = {
  diagramKey: 'dna_helix',
  labelData: [
    { id: 'backbone', displayName: 'Sugar-phosphate backbone', x: 100, y: 30, anchorX: 155, anchorY: 60 },
    { id: 'adenine', displayName: 'Adenine', x: 410, y: 95, anchorX: 290, anchorY: 95 },
    { id: 'thymine', displayName: 'Thymine', x: 410, y: 120, anchorX: 220, anchorY: 95 },
    { id: 'guanine', displayName: 'Guanine', x: 410, y: 195, anchorX: 285, anchorY: 195 },
    { id: 'cytosine', displayName: 'Cytosine', x: 410, y: 220, anchorX: 225, anchorY: 195 },
    { id: 'hydrogen_bond', displayName: 'Hydrogen bond', x: 410, y: 155, anchorX: 260, anchorY: 145 },
    { id: 'base_pair', displayName: 'Base pair', x: 100, y: 145, anchorX: 220, anchorY: 145 },
    { id: 'five_prime', displayName: "5' end", x: 135, y: 370, anchorX: 170, anchorY: 345 },
    { id: 'three_prime', displayName: "3' end", x: 350, y: 370, anchorX: 320, anchorY: 345 },
  ],
};

const DnaHelixDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = dnaHelixMeta.labelData;

  // Generate helix backbone as sinusoidal curves
  const steps = 8;
  const yStart = 50;
  const yEnd = 350;
  const centreX = 250;
  const amplitude = 70;
  const stepH = (yEnd - yStart) / steps;

  // Base pairs with colours
  const basePairs: Array<{ y: number; leftColor: string; rightColor: string; type: 'AT' | 'GC' }> = [
    { y: yStart + stepH * 0.5, leftColor: '#ef4444', rightColor: '#fca5a5', type: 'AT' },
    { y: yStart + stepH * 1.5, leftColor: '#ef4444', rightColor: '#fca5a5', type: 'AT' },
    { y: yStart + stepH * 2.5, leftColor: '#3b82f6', rightColor: '#93c5fd', type: 'GC' },
    { y: yStart + stepH * 3.5, leftColor: '#3b82f6', rightColor: '#93c5fd', type: 'GC' },
    { y: yStart + stepH * 4.5, leftColor: '#ef4444', rightColor: '#fca5a5', type: 'AT' },
    { y: yStart + stepH * 5.5, leftColor: '#3b82f6', rightColor: '#93c5fd', type: 'GC' },
    { y: yStart + stepH * 6.5, leftColor: '#ef4444', rightColor: '#fca5a5', type: 'AT' },
    { y: yStart + stepH * 7.5, leftColor: '#3b82f6', rightColor: '#93c5fd', type: 'GC' },
  ];

  // Backbone curves (two sinusoids, phase-shifted)
  const backbonePath = (phase: number) => {
    const points: string[] = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const y = yStart + t * (yEnd - yStart);
      const x = centreX + amplitude * Math.sin((t * Math.PI * 3) + phase);
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return points.join(' ');
  };

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Backbone strands */}
      <path d={backbonePath(0)} fill="none" stroke="#f59e0b" strokeWidth={3} />
      <path d={backbonePath(Math.PI)} fill="none" stroke="#f59e0b" strokeWidth={3} />

      {/* Base pairs as rungs */}
      {basePairs.map((bp, i) => {
        const t = (bp.y - yStart) / (yEnd - yStart);
        const x1 = centreX + amplitude * Math.sin(t * Math.PI * 3);
        const x2 = centreX + amplitude * Math.sin(t * Math.PI * 3 + Math.PI);
        const leftX = Math.min(x1, x2);
        const rightX = Math.max(x1, x2);
        const mid = (leftX + rightX) / 2;

        return (
          <g key={`bp-${i}`}>
            {/* Left half of rung */}
            <line x1={leftX} y1={bp.y} x2={mid} y2={bp.y}
              stroke={bp.leftColor} strokeWidth={4} strokeLinecap="round" />
            {/* Right half of rung */}
            <line x1={mid} y1={bp.y} x2={rightX} y2={bp.y}
              stroke={bp.rightColor} strokeWidth={4} strokeLinecap="round" />
            {/* Hydrogen bonds (dashed in middle) */}
            <line x1={mid - 8} y1={bp.y} x2={mid + 8} y2={bp.y}
              stroke="#6b7280" strokeWidth={1} strokeDasharray="2 2" />
          </g>
        );
      })}

      {/* Antiparallel arrows */}
      <defs>
        <marker id="dna-arrow" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="#f59e0b" />
        </marker>
      </defs>
      {/* 5'→3' on left strand */}
      <line x1={170} y1={55} x2={170} y2={340}
        stroke="#f59e0b" strokeWidth={1.5} markerEnd="url(#dna-arrow)" opacity={0.6} />
      <text x={163} y={355} fontSize={9} fill="#f59e0b" fontFamily="serif">5'→3'</text>

      {/* 3'→5' on right strand */}
      <line x1={330} y1={340} x2={330} y2={55}
        stroke="#f59e0b" strokeWidth={1.5} markerEnd="url(#dna-arrow)" opacity={0.6} />
      <text x={323} y={50} fontSize={9} fill="#f59e0b" fontFamily="serif">3'→5'</text>

      {/* One full turn bracket */}
      <line x1={145} y1={yStart + stepH * 0.5} x2={145} y2={yStart + stepH * 3.5}
        stroke="#64748b" strokeWidth={1} />
      <line x1={140} y1={yStart + stepH * 0.5} x2={150} y2={yStart + stepH * 0.5}
        stroke="#64748b" strokeWidth={1} />
      <line x1={140} y1={yStart + stepH * 3.5} x2={150} y2={yStart + stepH * 3.5}
        stroke="#64748b" strokeWidth={1} />
      <text x={130} y={(yStart + stepH * 0.5 + yStart + stepH * 3.5) / 2}
        textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="serif" writingMode="vertical-rl">
        1 turn
      </text>

      {/* Legend */}
      <rect x={380} y={280} width={10} height={10} fill="#ef4444" rx={1} />
      <text x={395} y={289} fontSize={9} fill="#1a1a1a" fontFamily="serif">A–T</text>
      <rect x={380} y={296} width={10} height={10} fill="#3b82f6" rx={1} />
      <text x={395} y={305} fontSize={9} fill="#1a1a1a" fontFamily="serif">G–C</text>

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default DnaHelixDiagram;
