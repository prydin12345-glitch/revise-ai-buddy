import React from 'react';
import { ConnectedParticlesConfig, COLORS, MARKER_IDS, FONT } from '../types';
import { HatchedGround, AngleArc } from '../svg-helpers';

interface Props {
  config: ConnectedParticlesConfig;
}

const ConnectedParticlesRenderer: React.FC<Props> = ({ config }) => {
  const { massA, massB, angle, surface } = config;
  const angleRad = (angle * Math.PI) / 180;

  const slopeBaseX = 60;
  const slopeBaseY = 300;
  const slopeLen = 220;
  const slopeTopX = slopeBaseX + slopeLen * Math.cos(angleRad);
  const slopeTopY = slopeBaseY - slopeLen * Math.sin(angleRad);

  const pulleyR = 12;
  const pulleyCx = slopeTopX + pulleyR * Math.sin(angleRad);
  const pulleyCy = slopeTopY - pulleyR * Math.cos(angleRad);

  const blockAt = 0.5;
  const blockAx = slopeBaseX + slopeLen * blockAt * Math.cos(angleRad);
  const blockAy = slopeBaseY - slopeLen * blockAt * Math.sin(angleRad);

  const blockBx = pulleyCx + pulleyR;
  const blockBTopY = pulleyCy + 20;
  const blockBH = 36;
  const labelB = `${massB} kg`;
  const blockBW = Math.max(40, labelB.length * 8 + 10);

  return (
    <g>
      {/* Ground */}
      <HatchedGround x1={slopeBaseX} y1={slopeBaseY} x2={slopeBaseX + 280} y2={slopeBaseY} />
      {/* Slope */}
      <line x1={slopeBaseX} y1={slopeBaseY} x2={slopeTopX} y2={slopeTopY} stroke={COLORS.structural} strokeWidth={2} />
      <line x1={slopeTopX} y1={slopeTopY} x2={slopeTopX} y2={slopeBaseY} stroke={COLORS.structural} strokeWidth={1.5} strokeDasharray="4 3" />
      <AngleArc cx={slopeBaseX} cy={slopeBaseY} startAngleDeg={0} endAngleDeg={angle} label={`${angle}°`} />

      {/* Pulley */}
      <circle cx={pulleyCx} cy={pulleyCy} r={pulleyR} fill="white" stroke={COLORS.structural} strokeWidth={1.5} />
      <circle cx={pulleyCx} cy={pulleyCy} r={2} fill={COLORS.structural} />

      {/* String A → pulley */}
      <line x1={blockAx} y1={blockAy} x2={pulleyCx - pulleyR * Math.cos(angleRad)} y2={pulleyCy + pulleyR * Math.sin(angleRad)} stroke={COLORS.tension} strokeWidth={1.5} />
      {/* String pulley → B */}
      <line x1={pulleyCx + pulleyR} y1={pulleyCy} x2={blockBx} y2={blockBTopY} stroke={COLORS.tension} strokeWidth={1.5} />

      {/* Block A on slope (rotated) */}
      <g transform={`translate(${blockAx}, ${blockAy}) rotate(${-angle})`}>
        <rect x={-20} y={-30} width={40} height={30} fill="white" stroke={COLORS.structural} strokeWidth={2} />
        <text x={0} y={-15} textAnchor="middle" dominantBaseline="central" fontFamily={FONT.family} fontSize={12} fill={COLORS.label}>{`${massA}kg`}</text>
      </g>

      {/* Block B hanging */}
      <rect x={blockBx - blockBW / 2} y={blockBTopY} width={blockBW} height={blockBH} fill="white" stroke={COLORS.structural} strokeWidth={2} />
      <text x={blockBx} y={blockBTopY + blockBH / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT.family} fontSize={12} fill={COLORS.label}>{labelB}</text>

      {/* Weight arrows */}
      <line x1={blockAx} y1={blockAy + 5} x2={blockAx} y2={blockAy + 45} stroke={COLORS.weight} strokeWidth={2} markerEnd={`url(#${MARKER_IDS.red})`} />
      <text x={blockAx + 12} y={blockAy + 50} fontFamily={FONT.family} fontSize={12} fill={COLORS.weight}>{`${massA}g`}</text>

      <line x1={blockBx} y1={blockBTopY + blockBH} x2={blockBx} y2={blockBTopY + blockBH + 36} stroke={COLORS.weight} strokeWidth={2} markerEnd={`url(#${MARKER_IDS.red})`} />
      <text x={blockBx + 10} y={blockBTopY + blockBH + 48} fontFamily={FONT.family} fontSize={12} fill={COLORS.weight}>{`${massB}g`}</text>

      {/* Tension labels */}
      <text x={(blockAx + pulleyCx) / 2 - 14} y={(blockAy + pulleyCy) / 2 - 10} fontFamily={FONT.family} fontSize={12} fill={COLORS.label}>T</text>
      <text x={pulleyCx + pulleyR + 10} y={blockBTopY - 4} fontFamily={FONT.family} fontSize={12} fill={COLORS.label}>T</text>

      {/* Surface label */}
      <text x={slopeBaseX + slopeLen * 0.5 * Math.cos(angleRad)} y={slopeBaseY + 22} textAnchor="middle" fontFamily="serif" fontStyle="italic" fontSize={11} fill={COLORS.angle}>{surface}</text>
    </g>
  );
};

export default ConnectedParticlesRenderer;
