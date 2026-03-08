import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const heartMeta: DiagramMeta = {
  diagramKey: 'heart',
  labelData: [
    { id: 'left_atrium', displayName: 'Left atrium', x: 355, y: 115 },
    { id: 'right_atrium', displayName: 'Right atrium', x: 145, y: 115 },
    { id: 'left_ventricle', displayName: 'Left ventricle', x: 340, y: 270 },
    { id: 'right_ventricle', displayName: 'Right ventricle', x: 160, y: 270 },
    { id: 'aorta', displayName: 'Aorta', x: 350, y: 25, anchorX: 310, anchorY: 55 },
    { id: 'pulmonary_artery', displayName: 'Pulmonary artery', x: 130, y: 25, anchorX: 190, anchorY: 55 },
    { id: 'pulmonary_vein', displayName: 'Pulmonary vein', x: 440, y: 85, anchorX: 390, anchorY: 100 },
    { id: 'vena_cava', displayName: 'Vena cava', x: 55, y: 85, anchorX: 110, anchorY: 100 },
    { id: 'av_valve', displayName: 'AV valve', x: 55, y: 195, anchorX: 170, anchorY: 195 },
    { id: 'semilunar_valve', displayName: 'Semilunar valve', x: 440, y: 55, anchorX: 300, anchorY: 65 },
    { id: 'septum', displayName: 'Septum', x: 250, y: 350, anchorX: 250, anchorY: 300 },
  ],
};

const HeartDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = heartMeta.labelData;

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Outer heart shape */}
      <path
        d="M 250 340 C 250 340 80 280 80 150 C 80 80 130 50 180 50 C 220 50 250 80 250 80 C 250 80 280 50 320 50 C 370 50 420 80 420 150 C 420 280 250 340 250 340 Z"
        fill="#fef2f2" stroke="#1a1a1a" strokeWidth={2.5}
      />

      {/* Septum — vertical divider */}
      <line x1={250} y1={70} x2={250} y2={330} stroke="#1a1a1a" strokeWidth={3} />

      {/* Horizontal divider — atria/ventricle boundary */}
      <path d="M 100 190 Q 175 175 250 190 Q 325 175 400 190"
        fill="none" stroke="#1a1a1a" strokeWidth={2} />

      {/* Right side (deoxygenated — blue) */}
      {/* Right atrium fill */}
      <path d="M 100 190 Q 175 175 250 190 L 250 70 C 250 80 220 50 180 50 C 130 50 80 80 80 150 L 100 190 Z"
        fill="#dbeafe" opacity={0.5} />
      {/* Right ventricle fill */}
      <path d="M 100 190 Q 175 175 250 190 L 250 330 C 250 340 80 280 80 150 L 100 190 Z"
        fill="#bfdbfe" opacity={0.4} />

      {/* Left side (oxygenated — red) */}
      {/* Left atrium fill */}
      <path d="M 250 190 Q 325 175 400 190 L 420 150 C 420 80 370 50 320 50 C 280 50 250 80 250 70 L 250 190 Z"
        fill="#fecaca" opacity={0.5} />
      {/* Left ventricle fill — thicker wall */}
      <path d="M 250 190 Q 325 175 400 190 C 420 280 250 340 250 340 L 250 190 Z"
        fill="#fca5a5" opacity={0.4} />

      {/* Left ventricle thicker wall indicator */}
      <path d="M 280 200 L 280 310"
        stroke="#ef4444" strokeWidth={4} opacity={0.3} />

      {/* AV Valves — flap shapes */}
      {/* Right AV */}
      <path d="M 165 185 L 175 200 L 185 185" fill="none" stroke="#1a1a1a" strokeWidth={2} />
      {/* Left AV */}
      <path d="M 315 185 L 325 200 L 335 185" fill="none" stroke="#1a1a1a" strokeWidth={2} />

      {/* Major vessels */}
      {/* Vena cava (top-right of body = left side of diagram) */}
      <rect x={95} y={40} width={30} height={50} rx={4}
        fill="#93c5fd" stroke="#1a1a1a" strokeWidth={1.5} />
      <text x={110} y={37} textAnchor="middle" fontSize={8} fill="#64748b">SVC</text>

      {/* Pulmonary artery */}
      <rect x={180} y={40} width={28} height={40} rx={4}
        fill="#93c5fd" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Aorta */}
      <path d="M 290 55 Q 290 30 310 30 L 330 30 Q 350 30 350 55"
        fill="none" stroke="#dc2626" strokeWidth={3} />

      {/* Pulmonary vein */}
      <rect x={375} y={80} width={25} height={35} rx={4}
        fill="#fca5a5" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Semilunar valves (at base of aorta/pulmonary artery) */}
      <path d="M 293 58 L 298 50 L 303 58" fill="none" stroke="#1a1a1a" strokeWidth={1.5} />
      <path d="M 186 60 L 194 52 L 202 60" fill="none" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Flow arrows */}
      <defs>
        <marker id="heart-arrow-red" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0, 6 2.5, 0 5" fill="#dc2626" />
        </marker>
        <marker id="heart-arrow-blue" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0, 6 2.5, 0 5" fill="#2563eb" />
        </marker>
      </defs>

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default HeartDiagram;
