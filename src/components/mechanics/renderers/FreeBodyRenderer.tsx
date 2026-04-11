import React from 'react';
import { FreeBodyConfig, COLORS, MARKER_IDS } from '../types';
import { HatchedGround, ForceLabel } from '../svg-helpers';

interface Props {
  config: FreeBodyConfig;
}

const FreeBodyRenderer: React.FC<Props> = ({ config }) => {
  const { mass, appliedForce, surface, unknowns, showLabels } = config;

  const groundY = 220;
  const blockW = 60;
  const blockH = 50;
  const cx = 200;
  const cy = groundY - blockH / 2;
  const arrowLen = 70;

  const isUnknown = (field: string) => unknowns.includes(field);

  return (
    <g>
      {/* Ground */}
      <HatchedGround x1={40} y1={groundY} x2={360} y2={groundY} />

      {/* Block */}
      <rect
        x={cx - blockW / 2}
        y={groundY - blockH}
        width={blockW}
        height={blockH}
        fill="white"
        stroke={COLORS.structural}
        strokeWidth={2}
      />
      <ForceLabel x={cx} y={groundY - blockH / 2} text={String(mass)} show={showLabels} />

      {/* Weight (downward) */}
      <line
        x1={cx}
        y1={groundY}
        x2={cx}
        y2={groundY + arrowLen}
        stroke={COLORS.weight}
        strokeWidth={2}
        markerEnd={`url(#${MARKER_IDS.red})`}
      />
      <ForceLabel
        x={cx + 22}
        y={groundY + arrowLen + 14}
        text={isUnknown('weight') ? 'W' : `${mass}g`}
        show={showLabels}
        color={COLORS.weight}
      />

      {/* Normal reaction (upward) */}
      <line
        x1={cx}
        y1={groundY - blockH}
        x2={cx}
        y2={groundY - blockH - arrowLen}
        stroke={COLORS.normal}
        strokeWidth={2}
        markerEnd={`url(#${MARKER_IDS.blue})`}
      />
      <ForceLabel
        x={cx + 14}
        y={groundY - blockH - arrowLen - 10}
        text={isUnknown('normal') ? 'R' : 'R'}
        show={showLabels}
        color={COLORS.normal}
      />

      {/* Applied force */}
      {appliedForce && (
        <g>
          {(() => {
            const forceDir = config.appliedForceDir;
            const slopeAngle = (config as any).slopeAngle;
            if (forceDir === 'up-slope' && slopeAngle) {
              const rad = (slopeAngle * Math.PI) / 180;
              const dx = Math.cos(rad) * arrowLen;
              const dy = -Math.sin(rad) * arrowLen;
              return (
                <>
                  <line
                    x1={cx + blockW / 2}
                    y1={cy}
                    x2={cx + blockW / 2 + dx}
                    y2={cy + dy}
                    stroke={COLORS.velocity}
                    strokeWidth={2}
                    markerEnd={`url(#${MARKER_IDS.green})`}
                  />
                  <ForceLabel
                    x={cx + blockW / 2 + dx + 16}
                    y={cy + dy}
                    text={isUnknown('appliedForce') ? 'P' : `${appliedForce} N`}
                    show={showLabels}
                    color={COLORS.velocity}
                  />
                </>
              );
            }
            return (
              <>
                <line
                  x1={cx + blockW / 2}
                  y1={cy}
                  x2={cx + blockW / 2 + arrowLen}
                  y2={cy}
                  stroke={COLORS.velocity}
                  strokeWidth={2}
                  markerEnd={`url(#${MARKER_IDS.green})`}
                />
                <ForceLabel
                  x={cx + blockW / 2 + arrowLen + 16}
                  y={cy}
                  text={isUnknown('appliedForce') ? 'P' : `${appliedForce} N`}
                  show={showLabels}
                  color={COLORS.velocity}
                />
              </>
            );
          })()}
        </g>
      )}

      {/* Friction (leftward) */}
      {surface === 'rough' && (
        <g>
          <line
            x1={cx - blockW / 2}
            y1={cy}
            x2={cx - blockW / 2 - arrowLen * 0.6}
            y2={cy}
            stroke={COLORS.friction}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.orange})`}
          />
          <ForceLabel
            x={cx - blockW / 2 - arrowLen * 0.6 - 14}
            y={cy}
            text="F"
            show={showLabels}
            color={COLORS.friction}
          />
        </g>
      )}

      {/* Surface label */}
      {showLabels && (
        <text
          x={cx}
          y={groundY + 28}
          textAnchor="middle"
          fontFamily={FONT.family}
          fontStyle={FONT.style}
          fontSize={11}
          fill={COLORS.angle}
        >
          {surface}
        </text>
      )}
    </g>
  );
};

export default FreeBodyRenderer;
