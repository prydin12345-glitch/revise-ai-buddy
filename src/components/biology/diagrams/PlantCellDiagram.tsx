import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import { applyLetterLabels } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const plantCellMeta: DiagramMeta = {
  diagramKey: 'plant_cell',
  labelData: [
    { id: 'cell_wall', displayName: 'Cell wall', x: 460, y: 20, anchorX: 420, anchorY: 55 },
    { id: 'cell_membrane', displayName: 'Cell membrane', x: 460, y: 50, anchorX: 405, anchorY: 70 },
    { id: 'vacuole', displayName: 'Vacuole', x: 250, y: 220 },
    { id: 'nucleus', displayName: 'Nucleus', x: 90, y: 100, anchorX: 150, anchorY: 125 },
    { id: 'nucleolus', displayName: 'Nucleolus', x: 50, y: 130, anchorX: 145, anchorY: 130 },
    { id: 'chloroplast', displayName: 'Chloroplast', x: 440, y: 130, anchorX: 370, anchorY: 130 },
    { id: 'mitochondria', displayName: 'Mitochondria', x: 440, y: 320, anchorX: 360, anchorY: 300 },
    { id: 'rough_er', displayName: 'Rough ER', x: 60, y: 290, anchorX: 160, anchorY: 290 },
    { id: 'ribosome', displayName: 'Ribosome', x: 60, y: 315, anchorX: 165, anchorY: 300 },
    { id: 'golgi', displayName: 'Golgi apparatus', x: 440, y: 250, anchorX: 360, anchorY: 230 },
    { id: 'cytoplasm', displayName: 'Cytoplasm', x: 140, y: 340 },
  ],
};

const PlantCellDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = plantCellMeta.labelData;

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Cell wall — thick green rounded rect */}
      <rect x={40} y={40} width={420} height={320} rx={18}
        fill="none" stroke="#16a34a" strokeWidth={5} />

      {/* Cell membrane — just inside wall */}
      <rect x={52} y={52} width={396} height={296} rx={12}
        fill="#fefce8" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Large central vacuole */}
      <ellipse cx={250} cy={220} rx={140} ry={100}
        fill="#bfdbfe" stroke="#3b82f6" strokeWidth={1.5} opacity={0.6} />

      {/* Nucleus (top-left area) */}
      <ellipse cx={150} cy={125} rx={42} ry={35}
        fill="#dbeafe" stroke="#1a1a1a" strokeWidth={2} />
      {/* Nuclear pores */}
      {[0, 60, 120, 180, 240, 300].map(a => {
        const rad = (a * Math.PI) / 180;
        return <circle key={a} cx={150 + 42 * Math.cos(rad)} cy={125 + 35 * Math.sin(rad)} r={2} fill="#1a1a1a" />;
      })}
      {/* Nucleolus */}
      <circle cx={145} cy={130} r={10} fill="#93c5fd" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Chloroplasts — 3 ovals with thylakoid lines */}
      {[[370, 130, 15], [120, 80, -10], [340, 340, 5]].map(([cx, cy, rot], i) => (
        <g key={`chl-${i}`} transform={`rotate(${rot}, ${cx}, ${cy})`}>
          <ellipse cx={cx} cy={cy} rx={30} ry={14}
            fill="#86efac" stroke="#15803d" strokeWidth={1.5} />
          {[-14, -7, 0, 7, 14].map(dx => (
            <line key={dx}
              x1={cx + dx} y1={cy - 10} x2={cx + dx} y2={cy + 10}
              stroke="#166534" strokeWidth={0.6} opacity={0.5} />
          ))}
        </g>
      ))}

      {/* Mitochondria */}
      {[[360, 300, 20]].map(([cx, cy, rot], i) => (
        <g key={`mito-${i}`} transform={`rotate(${rot}, ${cx}, ${cy})`}>
          <ellipse cx={cx} cy={cy} rx={24} ry={10}
            fill="#fde68a" stroke="#1a1a1a" strokeWidth={1.5} />
          {[-10, 0, 10].map(dx => (
            <line key={dx} x1={cx + dx} y1={cy - 7} x2={cx + dx} y2={cy + 7}
              stroke="#b45309" strokeWidth={0.8} />
          ))}
        </g>
      ))}

      {/* Rough ER */}
      {[0, 10, 20].map(dy => (
        <g key={`rer-${dy}`}>
          <path d={`M 140 ${280 + dy} Q 160 ${273 + dy} 180 ${280 + dy} Q 200 ${287 + dy} 220 ${280 + dy}`}
            fill="none" stroke="#1a1a1a" strokeWidth={1.5} />
          {[145, 160, 175, 190, 205, 215].map(rx => (
            <circle key={rx} cx={rx} cy={280 + dy + (rx % 2 === 0 ? -2 : 2)} r={1.5} fill="#6366f1" />
          ))}
        </g>
      ))}

      {/* Golgi apparatus */}
      {[0, 10, 20].map(dy => (
        <path key={`golgi-${dy}`}
          d={`M 330 ${220 + dy} Q 355 ${213 + dy} 380 ${220 + dy}`}
          fill="none" stroke="#1a1a1a" strokeWidth={2} strokeLinecap="round" />
      ))}
      <circle cx={385} cy={230} r={4} fill="#e9d5ff" stroke="#1a1a1a" strokeWidth={1} />

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default PlantCellDiagram;
