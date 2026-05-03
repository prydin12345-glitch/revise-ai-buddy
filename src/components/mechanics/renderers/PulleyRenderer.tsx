import React from 'react';
import { PulleyConfig, COLORS, MARKER_IDS, FONT } from '../types';
import { HatchedGround, ForceLabel } from '../svg-helpers';

interface Props {
  config: PulleyConfig;
}

const PulleyRenderer: React.FC<Props> = ({ config }) => {
  const { masses, showLabels, showForces, surface, friction } = config;

  // Layout constants
  const tableY = 160;
  const tableLeft = 30;
  const tableRight = 260;
  const pulleyR = 18;
  const pulleyCx = tableRight;
  const pulleyCy = tableY - pulleyR - 2;
  const blockSize = 36;
  const hangLabel = `${masses.hanging} kg`;
  const surfLabel = `${masses.onSurface} kg`;
  const hangBlockW = Math.max(blockSize, hangLabel.length * 8 + 10);
  const surfBlockW = Math.max(blockSize, surfLabel.length * 8 + 10);

  // Surface block position
  const surfBlockX = 160;
  const surfBlockY = tableY - blockSize;

  // Hanging block position
  const hangX = pulleyCx + pulleyR;
  const hangTopY = pulleyCy + pulleyR + 30;
  const hangY = hangTopY + blockSize;

  const arrowLen = 50;

  return (
    <g>
      {/* Table surface with hatching */}
      <HatchedGround x1={tableLeft} y1={tableY} x2={tableRight} y2={tableY} />

      {/* Pulley support (bracket) */}
      <line x1={pulleyCx} y1={20} x2={pulleyCx} y2={pulleyCy - pulleyR} stroke={COLORS.structural} strokeWidth={2} />
      <line x1={pulleyCx - 15} y1={20} x2={pulleyCx + 15} y2={20} stroke={COLORS.structural} strokeWidth={3} />

      {/* Pulley wheel */}
      <circle cx={pulleyCx} cy={pulleyCy} r={pulleyR} fill="white" stroke={COLORS.structural} strokeWidth={2} />
      <circle cx={pulleyCx} cy={pulleyCy} r={3} fill={COLORS.structural} />

      {/* Surface block */}
      <rect
        x={surfBlockX - surfBlockW / 2}
        y={surfBlockY}
        width={surfBlockW}
        height={blockSize}
        fill="white"
        stroke={COLORS.structural}
        strokeWidth={2}
      />
      {showLabels && (
        <text x={surfBlockX} y={surfBlockY + blockSize / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT.family} fontSize={Math.min(13, 11 + (blockSize / surfBlockW) * 2)} fill={COLORS.label}>{surfLabel}</text>
      )}

      {/* String: surface block → pulley top → hanging block */}
      <line
        x1={surfBlockX + surfBlockW / 2}
        y1={surfBlockY + blockSize / 2}
        x2={pulleyCx - pulleyR}
        y2={pulleyCy}
        stroke={COLORS.tension}
        strokeWidth={1.5}
      />
      <line
        x1={pulleyCx + pulleyR}
        y1={pulleyCy}
        x2={hangX}
        y2={hangTopY}
        stroke={COLORS.tension}
        strokeWidth={1.5}
      />

      {/* Hanging block */}
      <rect
        x={hangX - hangBlockW / 2}
        y={hangTopY}
        width={hangBlockW}
        height={blockSize}
        fill="white"
        stroke={COLORS.structural}
        strokeWidth={2}
      />
      {showLabels && (
        <text x={hangX} y={hangTopY + blockSize / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT.family} fontSize={Math.min(13, 11 + (blockSize / hangBlockW) * 2)} fill={COLORS.label}>{hangLabel}</text>
      )}

      {/* Force arrows */}
      {showForces && (
        <g>
          {/* Weight on hanging block */}
          <line
            x1={hangX}
            y1={hangY}
            x2={hangX}
            y2={hangY + arrowLen}
            stroke={COLORS.weight}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.red})`}
          />
          <ForceLabel x={hangX + 20} y={hangY + arrowLen / 2} text={`${masses.hanging}g`} show={showLabels} color={COLORS.weight} />

          {/* Tension on hanging block (upward) */}
          <line
            x1={hangX}
            y1={hangTopY}
            x2={hangX}
            y2={hangTopY - arrowLen * 0.7}
            stroke={COLORS.structural}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.black})`}
          />
          <ForceLabel x={hangX - 32} y={hangTopY - 8} text="T" show={showLabels} />

          {/* Weight on surface block */}
          <line
            x1={surfBlockX}
            y1={tableY}
            x2={surfBlockX}
            y2={tableY + arrowLen}
            stroke={COLORS.weight}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.red})`}
          />
          <ForceLabel x={surfBlockX + 22} y={tableY + arrowLen / 2} text={`${masses.onSurface}g`} show={showLabels} color={COLORS.weight} />

          {/* Normal on surface block */}
          <line
            x1={surfBlockX}
            y1={surfBlockY}
            x2={surfBlockX}
            y2={surfBlockY - arrowLen}
            stroke={COLORS.normal}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.blue})`}
          />
          <ForceLabel x={surfBlockX - 16} y={surfBlockY - arrowLen / 2} text="R" show={showLabels} color={COLORS.normal} />

          {/* Tension on surface block (toward pulley) */}
          <line
            x1={surfBlockX + blockSize / 2}
            y1={surfBlockY + blockSize / 2}
            x2={surfBlockX + blockSize / 2 + arrowLen}
            y2={surfBlockY + blockSize / 2}
            stroke={COLORS.structural}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.black})`}
          />
          <ForceLabel x={surfBlockX + blockSize / 2 + arrowLen / 2} y={surfBlockY + blockSize / 2 - 14} text="T" show={showLabels} />

          {/* Friction on surface block */}
          {friction && surface === 'rough' && (
            <g>
              <line
                x1={surfBlockX - blockSize / 2}
                y1={surfBlockY + blockSize / 2}
                x2={surfBlockX - blockSize / 2 - arrowLen * 0.6}
                y2={surfBlockY + blockSize / 2}
                stroke={COLORS.friction}
                strokeWidth={2}
                markerEnd={`url(#${MARKER_IDS.orange})`}
              />
              <ForceLabel
                x={surfBlockX - blockSize / 2 - arrowLen * 0.3}
                y={surfBlockY + blockSize / 2 - 14}
                text="F"
                show={showLabels}
                color={COLORS.friction}
              />
            </g>
          )}
        </g>
      )}

      {/* Surface label */}
      {showLabels && (
        <text x={tableLeft + 10} y={tableY + 20} fontFamily="serif" fontSize={11} fill={COLORS.angle}>
          {surface}
        </text>
      )}
    </g>
  );
};

export default PulleyRenderer;
