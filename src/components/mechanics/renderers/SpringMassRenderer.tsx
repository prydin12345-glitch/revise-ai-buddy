import React from 'react';
import { SpringMassConfig, COLORS, MARKER_IDS, FONT } from '../types';

interface Props {
  config: SpringMassConfig;
}

const SpringMassRenderer: React.FC<Props> = ({ config }) => {
  const { mass, extension, naturalLength = 0.5, springConstant } = config;

  const ceilY = 30;
  const springTopY = ceilY + 14;
  const coilCount = 8;
  const coilHeight = 16;
  const springHeight = coilCount * coilHeight;
  const springBottomY = springTopY + springHeight;
  const massTopY = springBottomY;
  const massCx = 220;
  const massH = 44;
  const massLabel = `${mass} kg`;
  const massW = Math.max(50, massLabel.length * 9 + 12);

  const points: string[] = [`${massCx},${springTopY}`];
  for (let i = 0; i < coilCount; i++) {
    const y = springTopY + i * coilHeight + coilHeight / 2;
    const x = i % 2 === 0 ? massCx + 16 : massCx - 16;
    points.push(`${x},${y}`);
  }
  points.push(`${massCx},${springBottomY}`);

  const naturalSplit = naturalLength / (naturalLength + Math.max(extension, 0.0001));
  const naturalY = springTopY + springHeight * naturalSplit;

  return (
    <g>
      {/* Ceiling */}
      <rect x={150} y={ceilY - 12} width={140} height={12} fill="#e5e7eb" stroke={COLORS.structural} strokeWidth={1} />
      {[...Array(6)].map((_, i) => (
        <line key={i} x1={155 + i * 22} y1={ceilY - 12} x2={148 + i * 22} y2={ceilY - 22} stroke={COLORS.structural} strokeWidth={1} opacity={0.5} />
      ))}

      {/* Spring */}
      <polyline points={points.join(' ')} fill="none" stroke={COLORS.structural} strokeWidth={2} strokeLinejoin="round" />

      {/* Natural length dimension */}
      <line x1={massCx + 40} y1={springTopY} x2={massCx + 40} y2={naturalY} stroke={COLORS.angle} strokeWidth={1} strokeDasharray="4 3" />
      <text x={massCx + 46} y={(springTopY + naturalY) / 2 + 4} fontFamily={FONT.family} fontStyle="italic" fontSize={11} fill={COLORS.angle}>l₀</text>

      {/* Extension dimension */}
      {extension > 0 && (
        <>
          <line x1={massCx + 54} y1={naturalY} x2={massCx + 54} y2={springBottomY} stroke={COLORS.friction} strokeWidth={1.5} />
          <text x={massCx + 60} y={springBottomY - 4} fontFamily={FONT.family} fontStyle="italic" fontSize={11} fill={COLORS.friction}>x</text>
        </>
      )}

      {/* Mass block */}
      <rect x={massCx - massW / 2} y={massTopY} width={massW} height={massH} fill="white" stroke={COLORS.structural} strokeWidth={1.5} rx={3} />
      <text x={massCx} y={massTopY + massH / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT.family} fontSize={13} fill={COLORS.label}>{massLabel}</text>

      {/* Weight arrow */}
      <line x1={massCx} y1={massTopY + massH} x2={massCx} y2={massTopY + massH + 42} stroke={COLORS.weight} strokeWidth={2} markerEnd={`url(#${MARKER_IDS.red})`} />
      <text x={massCx + 10} y={massTopY + massH + 40} fontFamily={FONT.family} fontSize={13} fill={COLORS.weight}>W</text>

      {/* Tension/spring force upward */}
      <line x1={massCx - 30} y1={massTopY} x2={massCx - 30} y2={massTopY - 42} stroke={COLORS.normal} strokeWidth={2} markerEnd={`url(#${MARKER_IDS.blue})`} />
      <text x={massCx - 46} y={massTopY - 16} fontFamily={FONT.family} fontSize={13} fill={COLORS.normal}>T</text>

      {/* Spring constant label */}
      {springConstant != null && (
        <text x={massCx - 56} y={springTopY + springHeight / 2} textAnchor="end" fontFamily={FONT.family} fontStyle="italic" fontSize={12} fill={COLORS.angle}>k = {springConstant}</text>
      )}
    </g>
  );
};

export default SpringMassRenderer;
