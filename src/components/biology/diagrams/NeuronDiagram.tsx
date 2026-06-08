import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import { applyLetterLabels } from '../types';
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

const STROKE = '#1a1a1a';
const SOMA_FILL = '#e0e7ff';
const NUC_FILL = '#c7d2fe';

const MotorNeuron = ({ cy }: { cy: number }) => {
  const dendrites = [
    'M 70 190 L 35 140 L 20 120',
    'M 70 190 L 30 170 L 10 155',
    'M 70 190 L 35 210 L 15 230',
    'M 70 190 L 30 240 L 20 260',
    'M 70 190 L 45 160 L 35 135',
  ];
  const myelinSegments = [
    { x: 165, w: 55 }, { x: 235, w: 55 }, { x: 305, w: 55 }, { x: 375, w: 45 },
  ];
  return (
    <>
      {dendrites.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
      ))}
      <ellipse cx={100} cy={cy} rx={40} ry={38} fill={SOMA_FILL} stroke={STROKE} strokeWidth={2} />
      <circle cx={100} cy={cy + 5} r={14} fill={NUC_FILL} stroke={STROKE} strokeWidth={1.5} />
      <line x1={140} y1={cy} x2={160} y2={cy} stroke={STROKE} strokeWidth={3} />
      <line x1={160} y1={cy} x2={420} y2={cy} stroke="#cbd5e1" strokeWidth={2} />
      {myelinSegments.map((seg, i) => (
        <rect key={`my-${i}`} x={seg.x} y={cy - 18} width={seg.w} height={36} rx={18}
          fill="#fde68a" stroke={STROKE} strokeWidth={1.5} />
      ))}
      {[220, 290, 360].map(nx => (
        <circle key={nx} cx={nx + 5} cy={cy} r={3} fill="#ef4444" stroke={STROKE} strokeWidth={1} />
      ))}
      {['M 420 190 L 445 175 L 450 168', 'M 420 190 L 448 190 L 455 190', 'M 420 190 L 445 205 L 450 215']
        .map((d, i) => (<path key={`term-${i}`} d={d} fill="none" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />))}
      {[[450, 168], [455, 190], [450, 215]].map(([tx, ty], i) => (
        <circle key={`bulb-${i}`} cx={tx} cy={ty} r={5} fill="#bfdbfe" stroke={STROKE} strokeWidth={1.5} />
      ))}
    </>
  );
};

// Sensory neurone — pseudounipolar: long peripheral dendron on left,
// soma branches off the middle of the axon, axon continues to terminals on right.
const SensoryNeuron = ({ cy }: { cy: number }) => {
  const receptorBranches = [
    'M 20 175 L 5 165', 'M 20 190 L 0 190', 'M 20 205 L 5 215', 'M 25 165 L 12 150', 'M 25 215 L 12 230',
  ];
  return (
    <>
      {/* Receptor dendron tree on far left */}
      {receptorBranches.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={STROKE} strokeWidth={1.6} strokeLinecap="round" />
      ))}
      <circle cx={25} cy={190} r={6} fill="#fecaca" stroke={STROKE} strokeWidth={1.5} />
      {/* Long peripheral process */}
      <line x1={25} y1={cy} x2={250} y2={cy} stroke={STROKE} strokeWidth={2.5} />
      {/* Myelin on peripheral process */}
      {[{ x: 70, w: 50 }, { x: 140, w: 50 }, { x: 210, w: 35 }].map((s, i) => (
        <rect key={`my1-${i}`} x={s.x} y={cy - 14} width={s.w} height={28} rx={14}
          fill="#fde68a" stroke={STROKE} strokeWidth={1.4} />
      ))}
      {/* Soma branching off above */}
      <line x1={260} y1={cy} x2={260} y2={cy - 40} stroke={STROKE} strokeWidth={2} />
      <ellipse cx={260} cy={cy - 70} rx={28} ry={28} fill={SOMA_FILL} stroke={STROKE} strokeWidth={2} />
      <circle cx={260} cy={cy - 68} r={10} fill={NUC_FILL} stroke={STROKE} strokeWidth={1.5} />
      {/* Central axon continues to right */}
      <line x1={260} y1={cy} x2={450} y2={cy} stroke={STROKE} strokeWidth={2.5} />
      {[{ x: 290, w: 50 }, { x: 360, w: 50 }].map((s, i) => (
        <rect key={`my2-${i}`} x={s.x} y={cy - 14} width={s.w} height={28} rx={14}
          fill="#fde68a" stroke={STROKE} strokeWidth={1.4} />
      ))}
      {['M 450 190 L 465 178', 'M 450 190 L 470 190', 'M 450 190 L 465 202'].map((d, i) => (
        <path key={`t-${i}`} d={d} fill="none" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
      ))}
    </>
  );
};

// Relay (interneuron) — small central soma, several short dendrites all round,
// no myelin sheath, short axon ending in a small terminal tree.
const RelayNeuron = ({ cy }: { cy: number }) => {
  const cx = 240;
  const dendrites = [
    `M ${cx - 30} ${cy} L 170 ${cy - 30} L 150 ${cy - 60}`,
    `M ${cx - 30} ${cy} L 160 ${cy} L 130 ${cy}`,
    `M ${cx - 30} ${cy} L 170 ${cy + 30} L 150 ${cy + 60}`,
    `M ${cx} ${cy - 30} L ${cx} ${cy - 70} L ${cx - 20} ${cy - 95}`,
    `M ${cx} ${cy - 30} L ${cx + 20} ${cy - 70} L ${cx + 35} ${cy - 95}`,
    `M ${cx} ${cy + 30} L ${cx - 15} ${cy + 65} L ${cx - 30} ${cy + 90}`,
    `M ${cx} ${cy + 30} L ${cx + 15} ${cy + 70}`,
  ];
  return (
    <>
      {dendrites.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={STROKE} strokeWidth={1.8} strokeLinecap="round" />
      ))}
      <ellipse cx={cx} cy={cy} rx={30} ry={30} fill={SOMA_FILL} stroke={STROKE} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={10} fill={NUC_FILL} stroke={STROKE} strokeWidth={1.5} />
      {/* Short axon to right */}
      <line x1={cx + 30} y1={cy} x2={380} y2={cy} stroke={STROKE} strokeWidth={2.5} />
      {/* Terminal tree */}
      {['M 380 190 L 410 170 L 425 160', 'M 380 190 L 415 190 L 435 190', 'M 380 190 L 410 210 L 425 220']
        .map((d, i) => (<path key={`t-${i}`} d={d} fill="none" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />))}
      {[[425, 160], [435, 190], [425, 220]].map(([tx, ty], i) => (
        <circle key={`b-${i}`} cx={tx} cy={ty} r={4} fill="#bfdbfe" stroke={STROKE} strokeWidth={1.4} />
      ))}
    </>
  );
};

// Bipolar neurone — single dendrite tree on one side, soma in middle,
// single axon on other side. Symmetrical and only two processes.
const BipolarNeuron = ({ cy }: { cy: number }) => {
  const cx = 235;
  const dendrites = [
    'M 60 190 L 30 160 L 15 145', 'M 60 190 L 25 180 L 8 175',
    'M 60 190 L 30 220 L 15 240', 'M 60 190 L 25 200 L 8 205',
  ];
  return (
    <>
      {dendrites.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={STROKE} strokeWidth={1.8} strokeLinecap="round" />
      ))}
      {/* Single dendrite stem into soma */}
      <line x1={60} y1={cy} x2={cx - 30} y2={cy} stroke={STROKE} strokeWidth={2.5} />
      {/* Soma */}
      <ellipse cx={cx} cy={cy} rx={30} ry={30} fill={SOMA_FILL} stroke={STROKE} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={10} fill={NUC_FILL} stroke={STROKE} strokeWidth={1.5} />
      {/* Single axon out the other side */}
      <line x1={cx + 30} y1={cy} x2={430} y2={cy} stroke={STROKE} strokeWidth={2.5} />
      {[{ x: 285, w: 55 }, { x: 355, w: 55 }].map((s, i) => (
        <rect key={`my-${i}`} x={s.x} y={cy - 16} width={s.w} height={32} rx={16}
          fill="#fde68a" stroke={STROKE} strokeWidth={1.4} />
      ))}
      {['M 430 190 L 455 178', 'M 430 190 L 460 190', 'M 430 190 L 455 202'].map((d, i) => (
        <path key={`t-${i}`} d={d} fill="none" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
      ))}
      {[[455, 178], [460, 190], [455, 202]].map(([tx, ty], i) => (
        <circle key={`b-${i}`} cx={tx} cy={ty} r={4} fill="#bfdbfe" stroke={STROKE} strokeWidth={1.4} />
      ))}
    </>
  );
};

const NeuronDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  letterLabels,
  variant,
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = applyLetterLabels(neuronMeta.labelData, letterLabels);
  const cy = 190;

  // Suppress anatomical labels when a variant is set (multi-option MCQs),
  // because the variants need to be distinguished by shape, not by labels.
  const renderLabels = showLabels && !variant;

  let body: React.ReactNode;
  switch (variant) {
    case 'sensory': body = <SensoryNeuron cy={cy} />; break;
    case 'relay': body = <RelayNeuron cy={cy} />; break;
    case 'bipolar': body = <BipolarNeuron cy={cy} />; break;
    case 'motor':
    default: body = <MotorNeuron cy={cy} />;
  }

  return (
    <DiagramShell maxWidth={500 * scale}>
      <defs>
        <marker id="neuron-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#dc2626" />
        </marker>
      </defs>
      {body}
      {renderLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default NeuronDiagram;
