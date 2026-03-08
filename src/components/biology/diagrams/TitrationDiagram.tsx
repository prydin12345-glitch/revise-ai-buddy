import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const titrationMeta: DiagramMeta = {
  diagramKey: 'titration',
  labelData: [
    { id: 'burette', displayName: 'Burette', x: 400, y: 60, anchorX: 260, anchorY: 60 },
    { id: 'burette_clamp', displayName: 'Burette clamp', x: 400, y: 100, anchorX: 210, anchorY: 100 },
    { id: 'retort_stand', displayName: 'Retort stand', x: 400, y: 140, anchorX: 185, anchorY: 140 },
    { id: 'tap', displayName: 'Tap', x: 400, y: 200, anchorX: 265, anchorY: 215 },
    { id: 'conical_flask', displayName: 'Conical flask', x: 400, y: 280, anchorX: 310, anchorY: 300 },
    { id: 'indicator', displayName: 'Indicator solution', x: 400, y: 310, anchorX: 260, anchorY: 310 },
    { id: 'white_tile', displayName: 'White tile', x: 400, y: 365, anchorX: 260, anchorY: 365 },
  ],
};

const TitrationDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = titrationMeta.labelData;

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Retort stand — vertical rod and base */}
      <rect x={180} y={40} width={8} height={340} fill="#94a3b8" stroke="#1a1a1a" strokeWidth={1.5} rx={2} />
      <rect x={150} y={370} width={80} height={10} fill="#94a3b8" stroke="#1a1a1a" strokeWidth={1.5} rx={2} />

      {/* Burette clamp — horizontal arm */}
      <rect x={188} y={95} width={55} height={8} fill="#94a3b8" stroke="#1a1a1a" strokeWidth={1} rx={2} />
      {/* Clamp jaws */}
      <path d="M 238 93 L 245 85 L 245 113 L 238 105" fill="none" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Burette — tall thin tube */}
      <rect x={248} y={35} width={16} height={180} fill="#e0f2fe" stroke="#1a1a1a" strokeWidth={1.5} rx={2} />
      {/* Graduation marks */}
      {Array.from({ length: 18 }, (_, i) => (
        <line key={i} x1={248} y1={45 + i * 10} x2={253} y2={45 + i * 10}
          stroke="#64748b" strokeWidth={0.7} />
      ))}
      {/* Liquid level in burette */}
      <rect x={249} y={80} width={14} height={128} fill="#bfdbfe" opacity={0.4} />
      {/* Meniscus */}
      <path d="M 249 80 Q 256 76 263 80" fill="#bfdbfe" stroke="#3b82f6" strokeWidth={0.8} />

      {/* Tap */}
      <rect x={252} y={210} width={8} height={12} fill="#fbbf24" stroke="#1a1a1a" strokeWidth={1} rx={1} />
      {/* Tap handle */}
      <rect x={260} y={212} width={14} height={4} fill="#fbbf24" stroke="#1a1a1a" strokeWidth={1} rx={1} />

      {/* Drip */}
      <ellipse cx={256} cy={232} rx={2} ry={3} fill="#3b82f6" />

      {/* Conical flask */}
      <path d="M 220 340 L 250 270 L 270 270 L 300 340 Z"
        fill="#fce7f3" stroke="#1a1a1a" strokeWidth={2} />
      {/* Flask neck */}
      <rect x={250} y={255} width={20} height={16} fill="white" stroke="#1a1a1a" strokeWidth={1.5} />
      {/* Liquid inside flask */}
      <path d="M 228 330 L 250 285 L 270 285 L 292 330 Z"
        fill="#f9a8d4" opacity={0.5} />

      {/* White tile */}
      <rect x={200} y={355} width={120} height={15} fill="white" stroke="#1a1a1a" strokeWidth={1.5} rx={2} />
      {/* Tile pattern */}
      <line x1={230} y1={355} x2={230} y2={370} stroke="#e5e7eb" strokeWidth={0.5} />
      <line x1={260} y1={355} x2={260} y2={370} stroke="#e5e7eb" strokeWidth={0.5} />
      <line x1={290} y1={355} x2={290} y2={370} stroke="#e5e7eb" strokeWidth={0.5} />

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default TitrationDiagram;
