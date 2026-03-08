import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export const chromatographyMeta: DiagramMeta = {
  diagramKey: 'chromatography',
  labelData: [
    { id: 'solvent_front', displayName: 'Solvent front', x: 100, y: 75, anchorX: 200, anchorY: 80 },
    { id: 'baseline', displayName: 'Baseline', x: 100, y: 315, anchorX: 200, anchorY: 320 },
    { id: 'sample_spot', displayName: 'Sample spot', x: 410, y: 330, anchorX: 280, anchorY: 330 },
    { id: 'component_a', displayName: 'Component A', x: 410, y: 150, anchorX: 260, anchorY: 155 },
    { id: 'component_b', displayName: 'Component B', x: 410, y: 210, anchorX: 280, anchorY: 220 },
    { id: 'component_c', displayName: 'Component C', x: 410, y: 260, anchorX: 240, anchorY: 270 },
    { id: 'rf_value', displayName: 'Rf value', x: 100, y: 195, anchorX: 170, anchorY: 195 },
    { id: 'paper', displayName: 'Chromatography paper', x: 410, y: 50, anchorX: 340, anchorY: 50 },
    { id: 'solvent', displayName: 'Solvent', x: 100, y: 365, anchorX: 200, anchorY: 365 },
  ],
};

const ChromatographyDiagram: React.FC<DiagramProps> = ({
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = chromatographyMeta.labelData;

  const paperX = 180;
  const paperW = 140;
  const paperTop = 40;
  const paperBot = 370;
  const baselineY = 320;
  const solventFrontY = 80;

  // Component spots
  const spots = [
    { cx: 260, cy: 155, rx: 14, ry: 10, color: '#ef4444' },
    { cx: 280, cy: 220, rx: 12, ry: 9, color: '#3b82f6' },
    { cx: 240, cy: 270, rx: 10, ry: 8, color: '#8b5cf6' },
  ];

  // Rf calculation for component A
  const distSpot = baselineY - spots[0].cy;
  const distFront = baselineY - solventFrontY;

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Beaker / container outline */}
      <rect x={160} y={340} width={180} height={50} rx={4}
        fill="#e0f2fe" stroke="#1a1a1a" strokeWidth={1.5} />
      {/* Solvent level in beaker */}
      <rect x={161} y={355} width={178} height={34} rx={3}
        fill="#bfdbfe" opacity={0.3} />

      {/* Paper strip */}
      <rect x={paperX} y={paperTop} width={paperW} height={paperBot - paperTop}
        fill="#fefce8" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Solvent front line */}
      <line x1={paperX} y1={solventFrontY} x2={paperX + paperW} y2={solventFrontY}
        stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 3" />

      {/* Solvent risen area */}
      <rect x={paperX + 1} y={solventFrontY} width={paperW - 2} height={paperBot - paperTop - (solventFrontY - paperTop)}
        fill="#bfdbfe" opacity={0.08} />

      {/* Baseline */}
      <line x1={paperX} y1={baselineY} x2={paperX + paperW} y2={baselineY}
        stroke="#1a1a1a" strokeWidth={1} strokeDasharray="4 2" />

      {/* Original sample spots on baseline */}
      <circle cx={250} cy={330} r={5} fill="#6b7280" opacity={0.6} />
      <circle cx={280} cy={330} r={4} fill="#6b7280" opacity={0.6} />

      {/* Separated component spots */}
      {spots.map((spot, i) => (
        <ellipse key={i} cx={spot.cx} cy={spot.cy} rx={spot.rx} ry={spot.ry}
          fill={spot.color} opacity={0.5} stroke={spot.color} strokeWidth={1} />
      ))}

      {/* Rf measurement lines */}
      {/* Distance to component A */}
      <line x1={175} y1={baselineY} x2={175} y2={spots[0].cy}
        stroke="#64748b" strokeWidth={1} />
      <line x1={170} y1={spots[0].cy} x2={180} y2={spots[0].cy}
        stroke="#64748b" strokeWidth={1} />
      <line x1={170} y1={baselineY} x2={180} y2={baselineY}
        stroke="#64748b" strokeWidth={1} />
      <text x={168} y={(baselineY + spots[0].cy) / 2} textAnchor="end"
        fontSize={8} fill="#64748b" fontFamily="serif" fontStyle="italic">
        d
      </text>

      {/* Distance to solvent front */}
      <line x1={165} y1={baselineY} x2={165} y2={solventFrontY}
        stroke="#64748b" strokeWidth={1} />
      <line x1={160} y1={solventFrontY} x2={170} y2={solventFrontY}
        stroke="#64748b" strokeWidth={1} />
      <text x={158} y={(baselineY + solventFrontY) / 2} textAnchor="end"
        fontSize={8} fill="#64748b" fontFamily="serif" fontStyle="italic">
        D
      </text>

      {/* Rf formula */}
      <text x={100} y={210} textAnchor="middle" fontSize={9} fill="#64748b" fontFamily="serif">
        Rf = d / D
      </text>
      <text x={100} y={225} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="serif">
        = {(distSpot / distFront).toFixed(2)}
      </text>

      {/* Ruler marks on side */}
      {Array.from({ length: 15 }, (_, i) => {
        const ry = paperTop + 20 + i * 20;
        const isMajor = i % 5 === 0;
        return (
          <g key={`ruler-${i}`}>
            <line x1={paperX + paperW + 5} y1={ry} x2={paperX + paperW + (isMajor ? 15 : 10)} y2={ry}
              stroke="#94a3b8" strokeWidth={isMajor ? 1 : 0.5} />
            {isMajor && (
              <text x={paperX + paperW + 18} y={ry + 3} fontSize={7} fill="#94a3b8" fontFamily="serif">
                {i}
              </text>
            )}
          </g>
        );
      })}

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default ChromatographyDiagram;
