import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const electrolysisMeta: DiagramMeta = {
  diagramKey: 'electrolysis',
  labelData: [
    { id: 'anode', displayName: 'Anode (+)', x: 340, y: 350, anchorX: 310, anchorY: 250 },
    { id: 'cathode', displayName: 'Cathode (−)', x: 140, y: 350, anchorX: 190, anchorY: 250 },
    { id: 'electrolyte', displayName: 'Electrolyte', x: 250, y: 310, anchorX: 250, anchorY: 280 },
    { id: 'electrode', displayName: 'Electrode', x: 60, y: 200, anchorX: 183, anchorY: 200 },
    { id: 'battery', displayName: 'Battery', x: 250, y: 40, anchorX: 250, anchorY: 65 },
    { id: 'positive_ions', displayName: 'Positive ions', x: 60, y: 260, anchorX: 210, anchorY: 260 },
    { id: 'negative_ions', displayName: 'Negative ions', x: 430, y: 260, anchorX: 290, anchorY: 260 },
    { id: 'bubbles', displayName: 'Bubbles', x: 60, y: 160, anchorX: 185, anchorY: 170 },
  ],
};

const ElectrolysisDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = electrolysisMeta.labelData;

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Battery symbol */}
      <g transform="translate(250, 70)">
        {/* Long line (positive) */}
        <line x1={-15} y1={0} x2={15} y2={0} stroke="#1a1a1a" strokeWidth={2.5} />
        {/* Short line (negative) */}
        <line x1={-8} y1={-10} x2={8} y2={-10} stroke="#1a1a1a" strokeWidth={2.5} />
        {/* Second pair */}
        <line x1={-15} y1={-20} x2={15} y2={-20} stroke="#1a1a1a" strokeWidth={2.5} />
        <line x1={-8} y1={-30} x2={8} y2={-30} stroke="#1a1a1a" strokeWidth={2.5} />
        <text x={20} y={3} fontSize={10} fill="#1a1a1a" fontFamily="serif">+</text>
        <text x={13} y={-27} fontSize={10} fill="#1a1a1a" fontFamily="serif">−</text>
      </g>

      {/* Wires from battery to electrodes */}
      {/* Positive wire → right electrode (anode) */}
      <polyline points="265,70 350,70 350,140 310,140 310,160"
        fill="none" stroke="#dc2626" strokeWidth={2} />
      {/* Negative wire → left electrode (cathode) */}
      <polyline points="242,40 150,40 150,140 190,140 190,160"
        fill="none" stroke="#1a1a1a" strokeWidth={2} />

      {/* Current direction arrow */}
      <defs>
        <marker id="elec-arrow" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="#dc2626" />
        </marker>
      </defs>
      <line x1={310} y1={100} x2={310} y2={130}
        stroke="#dc2626" strokeWidth={1.5} markerEnd="url(#elec-arrow)" />
      <text x={320} y={118} fontSize={8} fill="#dc2626" fontFamily="serif">I</text>

      {/* Beaker */}
      <path d="M 140 150 L 140 330 Q 140 345 155 345 L 345 345 Q 360 345 360 330 L 360 150"
        fill="#e0f2fe" stroke="#1a1a1a" strokeWidth={2} />
      {/* Electrolyte solution */}
      <rect x={141} y={170} width={218} height={160} fill="#bfdbfe" opacity={0.3} />
      {/* Liquid surface */}
      <path d="M 141 170 Q 200 165 250 170 Q 300 175 359 170" fill="none" stroke="#3b82f6" strokeWidth={1} />

      {/* Cathode (left electrode) */}
      <rect x={183} y={160} width={14} height={120} fill="#4b5563" stroke="#1a1a1a" strokeWidth={1.5} rx={1} />

      {/* Anode (right electrode) */}
      <rect x={303} y={160} width={14} height={120} fill="#4b5563" stroke="#1a1a1a" strokeWidth={1.5} rx={1} />

      {/* Bubbles at cathode */}
      {[[185, 170], [192, 178], [188, 185], [195, 168], [183, 175]].map(([bx, by], i) => (
        <circle key={`bc-${i}`} cx={bx} cy={by} r={3} fill="white" stroke="#3b82f6" strokeWidth={0.8} opacity={0.8} />
      ))}

      {/* Bubbles at anode */}
      {[[315, 172], [320, 180], [312, 186], [318, 166]].map(([bx, by], i) => (
        <circle key={`ba-${i}`} cx={bx} cy={by} r={3} fill="white" stroke="#3b82f6" strokeWidth={0.8} opacity={0.8} />
      ))}

      {/* Ions in solution */}
      {/* Positive ions moving toward cathode */}
      {[[210, 230], [225, 250], [215, 270]].map(([ix, iy], i) => (
        <text key={`pi-${i}`} x={ix} y={iy} fontSize={10} fill="#dc2626" fontFamily="serif" fontWeight="bold">+</text>
      ))}
      {/* Negative ions moving toward anode */}
      {[[280, 235], [290, 255], [285, 275]].map(([ix, iy], i) => (
        <text key={`ni-${i}`} x={ix} y={iy} fontSize={10} fill="#2563eb" fontFamily="serif" fontWeight="bold">−</text>
      ))}

      {/* Ion movement arrows */}
      <line x1={230} y1={240} x2={200} y2={240} stroke="#dc2626" strokeWidth={0.8} markerEnd="url(#elec-arrow)" opacity={0.5} />
      <line x1={275} y1={245} x2={300} y2={245} stroke="#2563eb" strokeWidth={0.8} opacity={0.5} />

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default ElectrolysisDiagram;
