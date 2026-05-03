import React from 'react';
import { RodConfig, COLORS, MARKER_IDS } from '../types';
import { HatchedGround, AngleArc, ForceLabel } from '../svg-helpers';

interface Props {
  config: RodConfig;
}

const RodRenderer: React.FC<Props> = ({ config }) => {
  const { angle, mass, length, wallType, floorType, showForces, showLabels } = config;
  const rad = (angle * Math.PI) / 180;

  // Wall on the left, floor at bottom
  const wallX = 60;
  const floorY = 260;
  const rodLen = 220;

  // Rod endpoints: bottom on floor, top on wall
  const bottomX = wallX + rodLen * Math.cos(rad);
  const bottomY = floorY;
  const topX = wallX;
  const topY = floorY - rodLen * Math.sin(rad);

  // Center of mass
  const midX = (bottomX + topX) / 2;
  const midY = (bottomY + topY) / 2;

  const arrowLen = 55;

  return (
    <g>
      {/* Wall (vertical, left side with hatching) */}
      <line x1={wallX} y1={30} x2={wallX} y2={floorY} stroke={COLORS.structural} strokeWidth={2} />
      {Array.from({ length: 16 }).map((_, i) => (
        <line
          key={`wh-${i}`}
          x1={wallX}
          y1={30 + i * 15}
          x2={wallX - 8}
          y2={38 + i * 15}
          stroke={COLORS.structural}
          strokeWidth={1}
        />
      ))}

      {/* Floor with hatching */}
      <HatchedGround x1={wallX} y1={floorY} x2={370} y2={floorY} />

      {/* Rod */}
      <line
        x1={bottomX}
        y1={bottomY}
        x2={topX}
        y2={topY}
        stroke={COLORS.structural}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Angle arc at floor */}
      <AngleArc cx={bottomX} cy={bottomY} startAngleDeg={180 - angle} endAngleDeg={180} radius={30} label={`${angle}°`} showLabel={showLabels} />

      {/* Center of mass dot */}
      <circle cx={midX} cy={midY} r={3} fill={COLORS.structural} />

      {showForces && (
        <g>
          {/* Weight at center of mass — vertical down */}
          <line
            x1={midX}
            y1={midY}
            x2={midX}
            y2={midY + arrowLen}
            stroke={COLORS.weight}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.red})`}
          />
          <ForceLabel x={midX + 18} y={midY + arrowLen / 2} text={`${mass}g`} show={showLabels} color={COLORS.weight} />

          {/* Wall reaction — horizontal, away from wall */}
          <line
            x1={topX}
            y1={topY}
            x2={topX + arrowLen}
            y2={topY}
            stroke={COLORS.normal}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.blue})`}
          />
          <ForceLabel x={topX + arrowLen + 12} y={topY - 4} text="S" show={showLabels} color={COLORS.normal} />

          {/* Floor normal — vertical up */}
          <line
            x1={bottomX}
            y1={bottomY}
            x2={bottomX}
            y2={bottomY - arrowLen}
            stroke={COLORS.normal}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.blue})`}
          />
          <ForceLabel x={bottomX + 14} y={bottomY - arrowLen / 2} text="R" show={showLabels} color={COLORS.normal} />

          {/* Floor friction — horizontal toward wall */}
          {floorType === 'rough' && (
            <g>
              <line
                x1={bottomX}
                y1={bottomY}
                x2={bottomX - arrowLen * 0.7}
                y2={bottomY}
                stroke={COLORS.friction}
                strokeWidth={2}
                markerEnd={`url(#${MARKER_IDS.orange})`}
              />
              <ForceLabel
                x={angle > 65 ? bottomX - arrowLen * 0.7 - 12 : bottomX - arrowLen * 0.4}
                y={bottomY - 14}
                text="F"
                show={showLabels}
                color={COLORS.friction}
              />
            </g>
          )}

          {/* Wall friction — vertical (if rough wall) */}
          {wallType === 'rough' && (
            <g>
              <line
                x1={topX}
                y1={topY}
                x2={topX}
                y2={topY + arrowLen * 0.6}
                stroke={COLORS.friction}
                strokeWidth={2}
                markerEnd={`url(#${MARKER_IDS.orange})`}
              />
              <ForceLabel
                x={topX - 16}
                y={angle > 65 ? topY - 20 : topY + arrowLen * 0.3}
                text="F'"
                show={showLabels}
                color={COLORS.friction}
              />
            </g>
          )}
        </g>
      )}

      {/* Surface labels */}
      {showLabels && (
        <g>
          <text x={wallX - 12} y={topY + 30} fontFamily="serif" fontSize={10} fill={COLORS.angle} textAnchor="end">
            {wallType}
          </text>
          <text x={bottomX + 30} y={floorY + 18} fontFamily="serif" fontSize={10} fill={COLORS.angle}>
            {floorType}
          </text>
        </g>
      )}

      {/* Length label — perpendicular to rod, horizontal text */}
      {showLabels && (() => {
        const rodAngleRad = (angle * Math.PI) / 180;
        // Perpendicular outward (away from the corner) — rod goes from bottom-right to top-left
        const perpX = -Math.sin(rodAngleRad);
        const perpY = -Math.cos(rodAngleRad);
        const lx = midX + perpX * 22;
        const ly = midY + perpY * 22;
        return (
          <text
            x={lx}
            y={ly}
            textAnchor="middle"
            fontFamily="serif"
            fontStyle="italic"
            fontSize={12}
            fill={COLORS.label}
          >
            {String(length)}
          </text>
        );
      })()}
    </g>
  );
};

export default RodRenderer;
