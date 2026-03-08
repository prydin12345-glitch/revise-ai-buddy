import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const neuronMeta: DiagramMeta = {
  diagramKey: 'neuron',
  labelData: [
    { id: 'dendrite', displayName: 'Dendrite', x: 40, y: 30, anchorX: 55, anchorY: 140 },
    { id: 'cell_body', displayName: 'Cell body', x: 100, y: 60, anchorX: 100, anchorY: 180 },
    { id: 'nucleus', displayName: 'Nucleus', x: 100, y: 300, anchorX: 100, anchorY: 200 },
    { id: 'axon', displayName: 'Axon', x: 270, y: 300, anchorX: 270, anchorY: 200 },
    { id: 'myelin_sheath', displayName: 'Myelin sheath', x: 250, y: 95, anchorX: 250, anchorY: 170 },
    { id: 'schwann_cell', displayName: 'Schwann cell', x: 320, y: 95, anchorX: 315, anchorY: 170 },
    { id: 'node_of_ranvier', displayName: 'Node of Ranvier', x: 210, y: 340, anchorX: 210, anchorY: 200 },
    { id: 'axon_terminal', displayName: 'Axon terminal', x: 450, y: 120, anchorX: 435, anchorY: 170 },
    { id: 'impulse_direction', displayName: 'Direction of impulse', x: 300, y: 370 },
  ],
};

const NeuronDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = neuronMeta.labelData;
  const cy = 190; // axon centre Y

  // Dendrite paths (branching from cell body)
  const dendrites = [
    'M 70 190 L 35 140 L 20 120',
    'M 70 190 L 30 170 L 10 155',
    'M 70 190 L 35 210 L 15 230',
    'M 70 190 L 30 240 L 20 260',
    'M 70 190 L 45 160 L 35 135',
  ];

  // Myelin sheath segments along axon
  const myelinSegments = [
    { x: 165, w: 55 },
    { x: 235, w: 55 },
    { x: 305, w: 55 },
    { x: 375, w: 45 },
  ];

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Dendrites */}
      {dendrites.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#1a1a1a" strokeWidth={2} strokeLinecap="round" />
      ))}
      {/* Small branches at ends */}
      {[[20, 120], [10, 155], [15, 230], [20, 260], [35, 135]].map(([bx, by], i) => (
        <g key={`br-${i}`}>
          <line x1={bx} y1={by} x2={bx - 8} y2={by - 8} stroke="#1a1a1a" strokeWidth={1.2} />
          <line x1={bx} y1={by} x2={bx - 8} y2={by + 6} stroke="#1a1a1a" strokeWidth={1.2} />
        </g>
      ))}

      {/* Cell body (soma) */}
      <ellipse cx={100} cy={cy} rx={40} ry={38}
        fill="#e0e7ff" stroke="#1a1a1a" strokeWidth={2} />
      {/* Nucleus */}
      <circle cx={100} cy={cy + 5} r={14} fill="#c7d2fe" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Axon hillock → axon line */}
      <line x1={140} y1={cy} x2={160} y2={cy} stroke="#1a1a1a" strokeWidth={3} />

      {/* Axon continues under myelin, draw thin axon line full length */}
      <line x1={160} y1={cy} x2={420} y2={cy} stroke="#cbd5e1" strokeWidth={2} />

      {/* Myelin sheath segments */}
      {myelinSegments.map((seg, i) => (
        <rect key={`my-${i}`}
          x={seg.x} y={cy - 18} width={seg.w} height={36} rx={18}
          fill="#fde68a" stroke="#1a1a1a" strokeWidth={1.5} />
      ))}

      {/* Nodes of Ranvier — gaps between myelin, mark with small circles */}
      {[220, 290, 360].map(nx => (
        <circle key={nx} cx={nx + 5} cy={cy} r={3} fill="#ef4444" stroke="#1a1a1a" strokeWidth={1} />
      ))}

      {/* Axon terminals */}
      {[
        'M 420 190 L 445 175 L 450 168',
        'M 420 190 L 448 190 L 455 190',
        'M 420 190 L 445 205 L 450 215',
      ].map((d, i) => (
        <path key={`term-${i}`} d={d} fill="none" stroke="#1a1a1a" strokeWidth={2} strokeLinecap="round" />
      ))}
      {/* Terminal bulbs */}
      {[[450, 168], [455, 190], [450, 215]].map(([tx, ty], i) => (
        <circle key={`bulb-${i}`} cx={tx} cy={ty} r={5} fill="#bfdbfe" stroke="#1a1a1a" strokeWidth={1.5} />
      ))}

      {/* Direction arrow */}
      <defs>
        <marker id="neuron-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#dc2626" />
        </marker>
      </defs>
      <line x1={120} y1={350} x2={420} y2={350}
        stroke="#dc2626" strokeWidth={2} markerEnd="url(#neuron-arrow)" />

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default NeuronDiagram;
