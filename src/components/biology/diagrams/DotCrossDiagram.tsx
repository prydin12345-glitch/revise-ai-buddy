import React from 'react';
import type { DiagramProps, DiagramMeta } from '../types';
import DiagramShell from '../DiagramShell';
import DiagramLabel from '../DiagramLabel';

export interface DotCrossAtom {
  symbol: string;
  electrons: number;
  shell: number;
  color: string;
  dotStyle: 'dot' | 'cross';
}

export interface DotCrossConfig {
  type: 'dot_cross';
  molecule: string;
  atoms: DotCrossAtom[];
  bondType: 'ionic' | 'covalent';
  showLabels?: boolean;
  labelMode?: 'visible' | 'hidden';
}

export const dotCrossMeta: DiagramMeta = {
  diagramKey: 'dot_cross',
  labelData: [
    { id: 'outer_shell', displayName: 'Outer shell', x: 250, y: 30 },
    { id: 'electron', displayName: 'Electron', x: 250, y: 380 },
  ],
};

interface DotCrossDiagramProps extends DiagramProps {
  config?: DotCrossConfig;
}

/** Draw electrons (dots or crosses) evenly spaced on a circle */
const drawElectrons = (
  cx: number, cy: number, radius: number,
  count: number, style: 'dot' | 'cross', color: string,
  startAngle = 0,
) => {
  const els: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (i / Math.max(count, 1)) * Math.PI * 2;
    const ex = cx + radius * Math.cos(angle);
    const ey = cy + radius * Math.sin(angle);
    if (style === 'dot') {
      els.push(<circle key={`e-${i}`} cx={ex} cy={ey} r={3} fill={color} />);
    } else {
      els.push(
        <g key={`e-${i}`}>
          <line x1={ex - 4} y1={ey - 4} x2={ex + 4} y2={ey + 4} stroke={color} strokeWidth={1.5} />
          <line x1={ex + 4} y1={ey - 4} x2={ex - 4} y2={ey + 4} stroke={color} strokeWidth={1.5} />
        </g>
      );
    }
  }
  return els;
};

const defaultConfig: DotCrossConfig = {
  type: 'dot_cross',
  molecule: 'NaCl',
  atoms: [
    { symbol: 'Na', electrons: 1, shell: 3, color: '#f59e0b', dotStyle: 'dot' },
    { symbol: 'Cl', electrons: 7, shell: 3, color: '#8b5cf6', dotStyle: 'cross' },
  ],
  bondType: 'ionic',
};

const DotCrossDiagram: React.FC<DotCrossDiagramProps> = ({
  config = defaultConfig,
  showLabels = true,
  labelMode = 'visible',
  revealedLabels = new Set(),
  onLabelClick,
  scale = 1,
}) => {
  const labels = dotCrossMeta.labelData;
  const { atoms, bondType, molecule } = config;
  const isIonic = bondType === 'ionic';

  // Position atoms
  const atomCount = atoms.length;
  const spacing = 180;
  const startX = 250 - ((atomCount - 1) * spacing) / 2;

  return (
    <DiagramShell maxWidth={500 * scale}>
      {/* Title */}
      <text x={250} y={25} textAnchor="middle" fontSize={14} fontFamily="serif" fontWeight="bold" fill="#1a1a1a">
        {molecule}
        {isIonic ? ' (ionic)' : ' (covalent)'}
      </text>

      {atoms.map((atom, ai) => {
        const cx = startX + ai * spacing;
        const cy = 200;
        const shellRadii = Array.from({ length: atom.shell }, (_, si) => 30 + si * 22);
        const outerR = shellRadii[shellRadii.length - 1];

        // For ionic: show charge
        const charge = isIonic
          ? (atom.dotStyle === 'dot'
            ? (atom.electrons <= 2 ? `${atom.electrons}+` : '')
            : (8 - atom.electrons === 1 ? '−' : `${8 - atom.electrons}−`))
          : '';

        return (
          <g key={`atom-${ai}`}>
            {/* Shells */}
            {shellRadii.map((r, si) => (
              <circle key={`shell-${si}`} cx={cx} cy={cy} r={r}
                fill="none" stroke="#cbd5e1" strokeWidth={1} strokeDasharray={si < shellRadii.length - 1 ? '3 2' : 'none'} />
            ))}

            {/* Atom symbol */}
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize={18} fontFamily="serif" fontWeight="bold" fill="#1a1a1a">
              {atom.symbol}
            </text>

            {/* Charge for ionic */}
            {isIonic && charge && (
              <text x={cx + outerR + 8} y={cy - outerR + 8}
                fontSize={12} fill="#dc2626" fontFamily="serif" fontWeight="bold">
                {charge}
              </text>
            )}

            {/* Electrons on outer shell */}
            {drawElectrons(cx, cy, outerR, atom.electrons, atom.dotStyle, atom.color)}

            {/* For ionic, show transferred electron */}
            {isIonic && atom.dotStyle === 'dot' && (
              <>
                {/* Arrow showing transfer */}
                <defs>
                  <marker id={`transfer-arrow-${ai}`} markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
                    <polygon points="0 0, 6 2.5, 0 5" fill="#64748b" />
                  </marker>
                </defs>
                <path
                  d={`M ${cx + outerR + 10} ${cy} Q ${cx + spacing / 2} ${cy - 50} ${startX + (ai + 1) * spacing - shellRadii[shellRadii.length - 1] - 10} ${cy}`}
                  fill="none" stroke="#64748b" strokeWidth={1} strokeDasharray="4 2"
                  markerEnd={`url(#transfer-arrow-${ai})`} />
              </>
            )}

            {/* For covalent — show overlap region */}
            {!isIonic && ai < atomCount - 1 && (
              <ellipse cx={cx + spacing / 2} cy={cy}
                rx={20} ry={outerR * 0.8}
                fill="#fef3c7" opacity={0.3} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 2" />
            )}
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(30, 360)">
        {atoms.map((atom, ai) => (
          <g key={`leg-${ai}`} transform={`translate(${ai * 150}, 0)`}>
            {atom.dotStyle === 'dot'
              ? <circle cx={8} cy={0} r={3} fill={atom.color} />
              : <g>
                  <line x1={4} y1={-4} x2={12} y2={4} stroke={atom.color} strokeWidth={1.5} />
                  <line x1={12} y1={-4} x2={4} y2={4} stroke={atom.color} strokeWidth={1.5} />
                </g>
            }
            <text x={20} y={4} fontSize={10} fill="#1a1a1a" fontFamily="serif">
              = {atom.symbol} electron
            </text>
          </g>
        ))}
      </g>

      {/* Labels */}
      {showLabels && labels.map(label => (
        <DiagramLabel key={label.id} label={label} mode={labelMode}
          revealed={revealedLabels.has(label.id)}
          onClick={() => onLabelClick?.(label.id)} />
      ))}
    </DiagramShell>
  );
};

export default DotCrossDiagram;
