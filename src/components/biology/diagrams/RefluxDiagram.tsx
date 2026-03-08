import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const refluxMeta: DiagramMeta = {
  diagramKey: 'reflux',
  labelData: [
    { id: 'round_bottom_flask', displayName: 'Round bottom flask', x: 90, y: 310, anchorX: 210, anchorY: 290 },
    { id: 'condenser', displayName: 'Condenser', x: 90, y: 100, anchorX: 235, anchorY: 115 },
    { id: 'water_in', displayName: 'Water in', x: 370, y: 200, anchorX: 290, anchorY: 190 },
    { id: 'water_out', displayName: 'Water out', x: 370, y: 80, anchorX: 290, anchorY: 80 },
    { id: 'heat_source', displayName: 'Heat source', x: 90, y: 375, anchorX: 210, anchorY: 365 },
    { id: 'anti_bumping', displayName: 'Anti-bumping granules', x: 370, y: 290, anchorX: 220, anchorY: 290 },
    { id: 'vapour', displayName: 'Reflux vapour', x: 370, y: 140, anchorX: 255, anchorY: 140 },
  ],
};

const RefluxDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = refluxMeta.labelData;

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Tripod */}
      <line x1={160} y1={350} x2={180} y2={380} stroke="#1a1a1a" strokeWidth={2} />
      <line x1={260} y1={350} x2={240} y2={380} stroke="#1a1a1a" strokeWidth={2} />
      <line x1={210} y1={350} x2={210} y2={385} stroke="#1a1a1a" strokeWidth={2} />

      {/* Gauze */}
      <rect x={165} y={345} width={90} height={6} fill="#d4d4d8" stroke="#1a1a1a" strokeWidth={1} />
      {/* Crosshatch */}
      {[175, 190, 205, 220, 235, 245].map(gx => (
        <line key={gx} x1={gx} y1={345} x2={gx} y2={351} stroke="#a1a1aa" strokeWidth={0.5} />
      ))}

      {/* Bunsen burner / heat source */}
      <rect x={200} y={385} width={20} height={10} fill="#f59e0b" stroke="#1a1a1a" strokeWidth={1} rx={2} />
      {/* Flame */}
      <path d="M 210 385 Q 205 370 210 360 Q 215 370 210 385" fill="#f97316" opacity={0.7} />

      {/* Round bottom flask */}
      <ellipse cx={210} cy={300} rx={50} ry={40}
        fill="#fef3c7" stroke="#1a1a1a" strokeWidth={2} />
      {/* Flask neck */}
      <rect x={200} y={245} width={20} height={20} fill="white" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Liquid in flask */}
      <ellipse cx={210} cy={305} rx={42} ry={32} fill="#fde68a" opacity={0.4} />

      {/* Anti-bumping granules */}
      {[[200, 318], [215, 315], [208, 310], [222, 312]].map(([gx, gy], i) => (
        <circle key={i} cx={gx} cy={gy} r={2.5} fill="#a3a3a3" stroke="#1a1a1a" strokeWidth={0.5} />
      ))}

      {/* Condenser — vertical tube with water jacket */}
      {/* Inner tube */}
      <rect x={205} y={50} width={10} height={200} fill="#e0f2fe" stroke="#1a1a1a" strokeWidth={1.5} />
      {/* Outer jacket */}
      <rect x={195} y={60} width={30} height={175} fill="none" stroke="#3b82f6" strokeWidth={2} rx={3} />

      {/* Water jacket fill */}
      <rect x={196} y={61} width={28} height={173} fill="#bfdbfe" opacity={0.2} rx={2} />

      {/* Water in arrow (bottom of jacket) */}
      <line x1={225} y1={190} x2={290} y2={190} stroke="#3b82f6" strokeWidth={1.5} />
      <polygon points="228,187 225,190 228,193" fill="#3b82f6" />

      {/* Water out arrow (top of jacket) */}
      <line x1={225} y1={80} x2={290} y2={80} stroke="#3b82f6" strokeWidth={1.5} />
      <polygon points="287,77 290,80 287,83" fill="#3b82f6" />

      {/* Vapour arrows going up inside condenser */}
      <defs>
        <marker id="reflux-up" markerWidth="5" markerHeight="4" refX="2.5" refY="0" orient="auto">
          <polygon points="0 4, 2.5 0, 5 4" fill="#ef4444" />
        </marker>
        <marker id="reflux-down" markerWidth="5" markerHeight="4" refX="2.5" refY="4" orient="auto">
          <polygon points="0 0, 2.5 4, 5 0" fill="#3b82f6" />
        </marker>
      </defs>
      {/* Up vapour */}
      <line x1={207} y1={200} x2={207} y2={80} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" markerEnd="url(#reflux-up)" />
      {/* Down condensed liquid */}
      <line x1={213} y1={80} x2={213} y2={200} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 3" markerEnd="url(#reflux-down)" />

      {/* Top of condenser — open to air */}
      <line x1={205} y1={50} x2={215} y2={50} stroke="#1a1a1a" strokeWidth={2} />

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default RefluxDiagram;
