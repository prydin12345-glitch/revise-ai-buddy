import React from 'react';
import { COLORS, FONT, MARKER_IDS } from '../types';

export interface VerticalLiftConfig {
  type: 'vertical_lift';
  mass: string | number;
  height: number | string;
  time?: number | string;
  unknowns?: string[];
}

const VerticalLiftRenderer: React.FC<{ config: VerticalLiftConfig }> = ({ config }) => {
  const { mass, height, time, unknowns = [] } = config;
  const cx = 200;
  const groundY = 260;
  const topY = 60;
  const boxW = 60;
  const boxH = 40;
  const boxX = cx - boxW / 2;
  const boxY = groundY - boxH;

  return (
    <g>
      {/* Ground line */}
      <line x1={80} y1={groundY} x2={320} y2={groundY} stroke={COLORS.structural} strokeWidth={2} />
      {/* Ground hatching */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1={100 + i * 28} y1={groundY} x2={88 + i * 28} y2={groundY + 12}
          stroke={COLORS.structural} strokeWidth={1} />
      ))}

      {/* Height reference — dashed vertical line */}
      <line x1={boxX - 30} y1={topY} x2={boxX - 30} y2={groundY}
        stroke={COLORS.angle} strokeWidth={1} strokeDasharray="4 3" />
      {/* Dimension arrow */}
      <line x1={boxX - 30} y1={topY + 4} x2={boxX - 30} y2={groundY - 4}
        stroke={COLORS.structural} strokeWidth={1.5} markerStart={`url(#${MARKER_IDS.black})`} markerEnd={`url(#${MARKER_IDS.black})`} />
      <text x={boxX - 45} y={(topY + groundY) / 2} textAnchor="middle"
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size} fill={COLORS.label}
        transform={`rotate(-90, ${boxX - 45}, ${(topY + groundY) / 2})`}>
        h = {height} m
      </text>

      {/* Mass box */}
      <rect x={boxX} y={boxY} width={boxW} height={boxH}
        fill="white" stroke={COLORS.structural} strokeWidth={2} />
      <text x={cx} y={boxY + boxH / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size} fill={COLORS.label}>
        {mass} kg
      </text>

      {/* Upward force arrow from motor */}
      <line x1={cx} y1={boxY - 5} x2={cx} y2={topY + 20}
        stroke={COLORS.velocity} strokeWidth={2} markerEnd={`url(#${MARKER_IDS.green})`} />
      <text x={cx + 16} y={topY + 45} textAnchor="start"
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12} fill={COLORS.velocity}>
        M↑
      </text>

      {/* Weight arrow */}
      <line x1={cx} y1={groundY} x2={cx} y2={groundY + 35}
        stroke={COLORS.weight} strokeWidth={2} markerEnd={`url(#${MARKER_IDS.red})`} />
      <text x={cx + 8} y={groundY + 32} textAnchor="start"
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12} fill={COLORS.weight}>
        W
      </text>

      {/* Time annotation */}
      {time && (
        <g>
          <rect x={280} y={topY} width={90} height={24} rx={4} fill="#f0f0f0" stroke={COLORS.angle} strokeWidth={1} />
          <text x={325} y={topY + 13} textAnchor="middle" dominantBaseline="central"
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12} fill={COLORS.label}>
            t = {time} s
          </text>
        </g>
      )}

      {/* Unknown annotations */}
      {unknowns.includes('GPE') && (
        <text x={320} y={topY + 50} textAnchor="start"
          fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12} fill={COLORS.angle}>
          GPE = ?
        </text>
      )}
      {unknowns.includes('electricalEnergy') && (
        <text x={320} y={topY + 68} textAnchor="start"
          fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12} fill={COLORS.angle}>
          E = ?
        </text>
      )}
    </g>
  );
};

export default VerticalLiftRenderer;
