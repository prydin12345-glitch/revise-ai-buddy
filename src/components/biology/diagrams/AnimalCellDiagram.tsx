import React from 'react';
import type { DiagramProps, DiagramLabelData, DiagramMeta } from '../types';
import { applyLetterLabels } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const animalCellMeta: DiagramMeta = {
  diagramKey: 'animal_cell',
  labelData: [
    { id: 'cell_membrane', displayName: 'Cell membrane', x: 430, y: 30, anchorX: 370, anchorY: 80 },
    { id: 'nucleus', displayName: 'Nucleus', x: 80, y: 200, anchorX: 200, anchorY: 200 },
    { id: 'nucleolus', displayName: 'Nucleolus', x: 420, y: 165, anchorX: 268, anchorY: 195 },
    { id: 'mitochondria', displayName: 'Mitochondria', x: 80, y: 50, anchorX: 140, anchorY: 130 },
    { id: 'rough_er', displayName: 'Rough ER', x: 80, y: 330, anchorX: 170, anchorY: 280 },
    { id: 'ribosome', displayName: 'Ribosomes (80S)', x: 420, y: 360, anchorX: 230, anchorY: 290 },
    { id: 'golgi', displayName: 'Golgi apparatus', x: 430, y: 290, anchorX: 350, anchorY: 285 },
    { id: 'cytoplasm', displayName: 'Cytoplasm', x: 100, y: 380 },
    { id: 'centriole', displayName: 'Centriole', x: 430, y: 240, anchorX: 348, anchorY: 255 },
    { id: 'lysosome', displayName: 'Lysosome', x: 80, y: 130, anchorX: 158, anchorY: 168 },
  ],
};

const AnimalCellDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  letterLabels,
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = applyLetterLabels(animalCellMeta.labelData, letterLabels);

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Cell membrane — oval */}
      <ellipse cx={250} cy={200} rx={210} ry={160}
        fill="#fef9c3" stroke="#1a1a1a" strokeWidth={2.5} />

      {/* Cytoplasm fill is the ellipse itself */}

      {/* Nucleus */}
      <ellipse cx={250} cy={200} rx={60} ry={50}
        fill="#dbeafe" stroke="#1a1a1a" strokeWidth={2} />
      {/* Nuclear pores */}
      {[30, 90, 150, 210, 270, 330].map(a => {
        const rad = (a * Math.PI) / 180;
        return (
          <circle key={a}
            cx={250 + 60 * Math.cos(rad)} cy={200 + 50 * Math.sin(rad)}
            r={2.5} fill="#1a1a1a" />
        );
      })}
      {/* Nucleolus */}
      <circle cx={260} cy={195} r={14} fill="#93c5fd" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Mitochondria */}
      {[[140, 130, 20], [340, 120, -15]].map(([cx, cy, rot], i) => (
        <g key={`mito-${i}`} transform={`rotate(${rot}, ${cx}, ${cy})`}>
          <ellipse cx={cx} cy={cy} rx={28} ry={12}
            fill="#fde68a" stroke="#1a1a1a" strokeWidth={1.5} />
          {/* Cristae */}
          {[-12, 0, 12].map(dx => (
            <line key={dx}
              x1={cx + dx} y1={cy - 8} x2={cx + dx} y2={cy + 8}
              stroke="#b45309" strokeWidth={0.8} />
          ))}
        </g>
      ))}

      {/* Rough ER — wavy lines with dots */}
      {[0, 12, 24].map(dy => (
        <g key={`rer-${dy}`}>
          <path
            d={`M 160 ${265 + dy} Q 180 ${258 + dy} 200 ${265 + dy} Q 220 ${272 + dy} 240 ${265 + dy}`}
            fill="none" stroke="#1a1a1a" strokeWidth={1.5} />
          {[165, 180, 195, 210, 225, 235].map(rx => (
            <circle key={rx} cx={rx} cy={265 + dy + (rx % 2 === 0 ? -2 : 2)} r={1.5} fill="#6366f1" />
          ))}
        </g>
      ))}

      {/* Golgi apparatus — stacked curved shapes */}
      {[0, 10, 20, 30].map(dy => (
        <path key={`golgi-${dy}`}
          d={`M 310 ${270 + dy} Q 340 ${262 + dy} 370 ${270 + dy}`}
          fill="none" stroke="#1a1a1a" strokeWidth={2}
          strokeLinecap="round" />
      ))}
      {/* Vesicles */}
      <circle cx={375} cy={280} r={5} fill="#e9d5ff" stroke="#1a1a1a" strokeWidth={1} />
      <circle cx={380} cy={295} r={4} fill="#e9d5ff" stroke="#1a1a1a" strokeWidth={1} />

      {/* Centriole — pair of short barrel shapes */}
      <g transform="translate(335, 245)">
        <rect x={0} y={0} width={12} height={20} rx={2}
          fill="none" stroke="#1a1a1a" strokeWidth={1.5} />
        <rect x={6} y={5} width={12} height={20} rx={2}
          fill="none" stroke="#1a1a1a" strokeWidth={1.5}
          transform="rotate(90, 12, 15)" />
      </g>

      {/* Lysosome */}
      <circle cx={160} cy={170} r={12} fill="#fca5a5" stroke="#1a1a1a" strokeWidth={1.5} />
      {/* Dots inside lysosome */}
      {[[156, 167], [164, 173], [160, 165]].map(([lx, ly], i) => (
        <circle key={i} cx={lx} cy={ly} r={1.5} fill="#7f1d1d" />
      ))}

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

export default AnimalCellDiagram;
