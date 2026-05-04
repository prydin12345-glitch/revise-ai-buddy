import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

const cx = 250;
const cy = 200;
const rx = 160;
const ry = 90;

export const bacterialCellMeta: DiagramMeta = {
  diagramKey: 'bacterial_cell',
  labelData: [
    { id: 'capsule', displayName: 'Capsule', x: 80, y: 70, anchorX: cx - rx - 14, anchorY: cy - 30 },
    { id: 'cell_wall', displayName: 'Cell wall', x: 440, y: 70, anchorX: cx + rx + 8, anchorY: cy - 40 },
    { id: 'cell_membrane', displayName: 'Cell membrane', x: 460, y: 110, anchorX: cx + rx - 4, anchorY: cy - 10 },
    { id: 'cytoplasm', displayName: 'Cytoplasm', x: cx - 90, y: cy + 60 },
    { id: 'nucleoid', displayName: 'Nucleoid (circular DNA)', x: cx, y: cy - 65, anchorX: cx, anchorY: cy - 8 },
    { id: 'plasmid', displayName: 'Plasmid', x: cx + 110, y: cy + 70, anchorX: cx + 60, anchorY: cy + 40 },
    { id: 'ribosome', displayName: 'Ribosomes (70S)', x: 70, y: cy + 70, anchorX: cx - 70, anchorY: cy + 30 },
    { id: 'flagellum', displayName: 'Flagellum', x: 460, y: cy + 50, anchorX: cx + rx + 60, anchorY: cy + 4 },
    { id: 'pili', displayName: 'Pili', x: cx, y: 30, anchorX: cx, anchorY: cy - ry - 6 },
  ],
};

const BacterialCellDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = bacterialCellMeta.labelData;

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Capsule (outermost gel layer) */}
      <ellipse cx={cx} cy={cy} rx={rx + 14} ry={ry + 14}
        fill="#fef3c7" stroke="#a16207" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.55} />

      {/* Cell wall */}
      <ellipse cx={cx} cy={cy} rx={rx + 6} ry={ry + 6}
        fill="none" stroke="#15803d" strokeWidth={3} />

      {/* Cell membrane + cytoplasm */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
        fill="#fefce8" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Nucleoid — irregular blob of circular DNA */}
      <path
        d={`M ${cx - 40} ${cy} Q ${cx - 30} ${cy - 28} ${cx} ${cy - 18}
            Q ${cx + 40} ${cy - 8} ${cx + 30} ${cy + 18}
            Q ${cx} ${cy + 28} ${cx - 30} ${cy + 14} Z`}
        fill="#dbeafe" stroke="#1d4ed8" strokeWidth={1.5} />
      {/* DNA squiggles */}
      <path d={`M ${cx - 25} ${cy - 5} Q ${cx - 5} ${cy - 15} ${cx + 15} ${cy + 5} Q ${cx + 25} ${cy + 12} ${cx - 10} ${cy + 10}`}
        fill="none" stroke="#1e3a8a" strokeWidth={1} />

      {/* Plasmids */}
      <ellipse cx={cx + 60} cy={cy + 40} rx={10} ry={6} fill="none" stroke="#b91c1c" strokeWidth={1.5} />
      <ellipse cx={cx - 75} cy={cy - 35} rx={8} ry={5} fill="none" stroke="#b91c1c" strokeWidth={1.5} />

      {/* Ribosomes (small dots) */}
      {[[cx - 70, cy + 30], [cx - 50, cy + 45], [cx + 35, cy - 45],
        [cx + 80, cy - 10], [cx - 90, cy - 15], [cx + 70, cy + 15]].map(([rxp, ryp], i) => (
        <circle key={i} cx={rxp} cy={ryp} r={2.5} fill="#7c2d12" />
      ))}

      {/* Flagellum — wavy tail */}
      <path
        d={`M ${cx + rx} ${cy + 4} Q ${cx + rx + 30} ${cy - 10} ${cx + rx + 55} ${cy + 8}
            Q ${cx + rx + 80} ${cy + 26} ${cx + rx + 110} ${cy + 4}`}
        fill="none" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Pili — bristles around perimeter */}
      {[-60, -30, 0, 30, 60, 120, 150, 180, 210, 240].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = cx + rx * Math.cos(rad);
        const y1 = cy + ry * Math.sin(rad);
        const x2 = cx + (rx + 12) * Math.cos(rad);
        const y2 = cy + (ry + 12) * Math.sin(rad);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#52525b" strokeWidth={1} />;
      })}

      {/* Note */}
      <text x={cx} y={385} textAnchor="middle" fontSize={10} fontStyle="italic" fill="#475569">
        No membrane-bound organelles (prokaryote)
      </text>

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel
          key={label.id}
          label={label}
          mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)}
        />
      ))}
    </DiagramShell>
  );
};

export default BacterialCellDiagram;
