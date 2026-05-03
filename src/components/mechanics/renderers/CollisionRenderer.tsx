import React from 'react';
import { CollisionConfig, COLORS, MARKER_IDS, FONT } from '../types';

interface Props {
  config: CollisionConfig;
}

const CollisionRenderer: React.FC<Props> = ({ config }) => {
  const { massA, massB, uA, uB, vA, vB, collisionType } = config;

  const rowY1 = 80;
  const rowY2 = 240;
  const blockH = 36;
  const axY = 160;
  const blockAX = 120;
  const blockBX = 300;

  const renderBlock = (cx: number, y: number, mass: number, label: string) => {
    const t = `${mass}kg`;
    const w = Math.max(52, t.length * 9 + 12);
    return (
      <g>
        <rect x={cx - w / 2} y={y} width={w} height={blockH} fill="white" stroke={COLORS.structural} strokeWidth={1.5} rx={3} />
        <text x={cx} y={y + blockH / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT.family} fontSize={12} fill={COLORS.label}>{t}</text>
        <text x={cx} y={y - 8} textAnchor="middle" fontFamily={FONT.family} fontStyle="italic" fontSize={11} fill={COLORS.angle}>{label}</text>
      </g>
    );
  };

  const renderVelocity = (cx: number, y: number, vel: number | null, label: string) => {
    if (vel === null) {
      return <text x={cx} y={y} textAnchor="middle" fontFamily={FONT.family} fontStyle="italic" fontSize={12} fill={COLORS.angle}>{label} = ?</text>;
    }
    if (vel === 0) {
      return <text x={cx} y={y} textAnchor="middle" fontFamily={FONT.family} fontStyle="italic" fontSize={12} fill={COLORS.angle}>at rest</text>;
    }
    const dir = vel > 0 ? 1 : -1;
    const arrowLen = Math.min(60, Math.abs(vel) * 8);
    return (
      <g>
        <line x1={cx} y1={y} x2={cx + dir * arrowLen} y2={y} stroke={COLORS.velocity} strokeWidth={2} markerEnd={`url(#${MARKER_IDS.green})`} />
        <text x={cx + dir * (arrowLen / 2)} y={y - 8} textAnchor="middle" fontFamily={FONT.family} fontStyle="italic" fontSize={12} fill={COLORS.velocity}>{label} = {Math.abs(vel)} m/s</text>
      </g>
    );
  };

  return (
    <g>
      <text x={20} y={rowY1 + blockH / 2 + 5} fontFamily={FONT.family} fontSize={12} fontWeight={600} fill={COLORS.angle}>Before</text>
      {renderBlock(blockAX, rowY1, massA, 'A')}
      {renderBlock(blockBX, rowY1, massB, 'B')}
      {renderVelocity(blockAX, rowY1 - 28, uA, 'u_A')}
      {renderVelocity(blockBX, rowY1 - 28, uB, 'u_B')}

      <line x1={50} y1={axY + 18} x2={400} y2={axY + 18} stroke={COLORS.angle} strokeWidth={1} strokeDasharray="6 3" />
      <text x={225} y={axY + 32} textAnchor="middle" fontFamily={FONT.family} fontStyle="italic" fontSize={10} fill={COLORS.angle}>{collisionType}</text>

      <text x={20} y={rowY2 + blockH / 2 + 5} fontFamily={FONT.family} fontSize={12} fontWeight={600} fill={COLORS.angle}>After</text>
      {renderBlock(blockAX, rowY2, massA, 'A')}
      {renderBlock(blockBX, rowY2, massB, 'B')}
      {renderVelocity(blockAX, rowY2 - 28, vA, 'v_A')}
      {renderVelocity(blockBX, rowY2 - 28, vB, 'v_B')}
    </g>
  );
};

export default CollisionRenderer;
