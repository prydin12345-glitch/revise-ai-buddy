import React from 'react';
import { SlopeConfig, COLORS, MARKER_IDS, FONT } from '../types';
import { HatchedGround, AngleArc, ForceLabel, LabelPlacementRegistry } from '../svg-helpers';

interface Props {
  config: SlopeConfig;
}

const SlopeRenderer: React.FC<Props> = ({ config }) => {
  const { angle, mass, surface, showNormal, showWeight, showFriction, showComponents, showLabels } = config;
  const rad = (angle * Math.PI) / 180;

  // Slope geometry — bottom-left corner at origin, slope rises to the right
  const baseX = 50;
  const baseY = 260;
  const slopeLen = 280;
  const topX = baseX + slopeLen * Math.cos(rad);
  const topY = baseY - slopeLen * Math.sin(rad);

  // Mass block positioned 40% up the slope
  const t = 0.4;
  const blockCx = baseX + slopeLen * t * Math.cos(rad);
  const blockCy = baseY - slopeLen * t * Math.sin(rad);
  const blockSize = 30;

  // Force arrow length
  const arrowLen = 60;

  // Along-slope unit vectors (up-slope)
  const ux = Math.cos(rad);
  const uy = -Math.sin(rad);
  const nx = Math.sin(rad);
  const ny = Math.cos(rad);

  // Label placement registry — reserve occupied regions
  const registry = new LabelPlacementRegistry();
  registry.reserve({ x: blockCx - 28, y: blockCy - 40, width: 56, height: 40 });
  registry.reserve({ x: 30, y: baseY - 6, width: 340, height: 12 });

  const weightPos = registry.place(blockCx + 18, blockCy + arrowLen + 14, `${mass}g`, 13, 'start');
  const normalPos = registry.place(
    blockCx + nx * (arrowLen + 14),
    blockCy - ny * (arrowLen + 14) - 10,
    'R', 13, 'start',
  );
  const frictionPos = registry.place(
    blockCx + ux * arrowLen * 0.7 + 10,
    blockCy + uy * arrowLen * 0.7 - 10,
    'F', 13, 'start',
  );
  const angleBis = rad / 2;
  const anglePos = registry.place(
    baseX + Math.cos(angleBis) * 50,
    baseY - Math.sin(angleBis) * 50,
    `${angle}°`, 11, 'middle',
  );

  return (
    <g>
      {/* Ground baseline */}
      <HatchedGround x1={30} y1={baseY} x2={370} y2={baseY} />

      {/* Slope surface */}
      <line
        x1={baseX}
        y1={baseY}
        x2={topX}
        y2={topY}
        stroke={COLORS.structural}
        strokeWidth={2}
      />
      {/* Vertical edge */}
      <line x1={topX} y1={topY} x2={topX} y2={baseY} stroke={COLORS.structural} strokeWidth={1.5} strokeDasharray="4 3" />

      {/* Angle arc — uses placement-aware label position */}
      <AngleArc cx={baseX} cy={baseY} startAngleDeg={0} endAngleDeg={angle} showLabel={false} />
      {showLabels && (
        <text x={anglePos.x} y={anglePos.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT.family} fontStyle={FONT.style} fontSize={11} fill={COLORS.label}>{`${angle}°`}</text>
      )}

      {/* Mass block — drawn aligned to slope via rotation */}
      <g transform={`translate(${blockCx}, ${blockCy}) rotate(${-angle})`}>
        <rect
          x={-blockSize / 2}
          y={-blockSize}
          width={blockSize}
          height={blockSize}
          fill="white"
          stroke={COLORS.structural}
          strokeWidth={2}
        />
        <ForceLabel x={0} y={-blockSize / 2} text={String(mass)} show={showLabels} />
      </g>

      {/* Weight arrow — always vertical downward from block center */}
      {showWeight && (
        <g>
          <line
            x1={blockCx}
            y1={blockCy}
            x2={blockCx}
            y2={blockCy + arrowLen}
            stroke={COLORS.weight}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.red})`}
          />
          <ForceLabel x={blockCx + 18} y={blockCy + arrowLen + 15} text={`${mass}g`} show={showLabels} color={COLORS.weight} />
        </g>
      )}

      {/* Normal reaction — perpendicular to slope, away from surface */}
      {showNormal && (
        <g>
          <line
            x1={blockCx}
            y1={blockCy}
            x2={blockCx + nx * arrowLen}
            y2={blockCy - ny * arrowLen}
            stroke={COLORS.normal}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.blue})`}
          />
          <ForceLabel
            x={blockCx + nx * (arrowLen + 14)}
            y={blockCy - ny * (arrowLen + 14) - 10}
            text="R"
            show={showLabels}
            color={COLORS.normal}
          />
        </g>
      )}

      {/* Friction — along slope, opposing motion (down the slope) */}
      {showFriction && surface === 'rough' && (
        <g>
          <line
            x1={blockCx}
            y1={blockCy}
            x2={blockCx + ux * arrowLen * 0.7}
            y2={blockCy + uy * arrowLen * 0.7}
            stroke={COLORS.friction}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.orange})`}
          />
          <ForceLabel
            x={blockCx + ux * arrowLen * 0.7 + 8}
            y={blockCy + uy * arrowLen * 0.7 - 8}
            text="F"
            show={showLabels}
            color={COLORS.friction}
          />
        </g>
      )}

      {/* Weight components along/perpendicular to slope */}
      {showComponents && showWeight && (
        <g>
          {/* Component along slope (down) */}
          <line
            x1={blockCx}
            y1={blockCy}
            x2={blockCx - ux * arrowLen * 0.8}
            y2={blockCy - uy * arrowLen * 0.8}
            stroke={COLORS.weight}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            markerEnd={`url(#${MARKER_IDS.red})`}
          />
          <ForceLabel
            x={blockCx - ux * arrowLen * 0.8 - 18}
            y={blockCy - uy * arrowLen * 0.8}
            text={`${mass}g sin${angle}°`}
            show={showLabels}
            color={COLORS.weight}
          />
          {/* Component perpendicular to slope (into surface) */}
          <line
            x1={blockCx}
            y1={blockCy}
            x2={blockCx + nx * arrowLen * 0.6}
            y2={blockCy - ny * arrowLen * 0.6}
            stroke={COLORS.weight}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            markerEnd={`url(#${MARKER_IDS.red})`}
          />
        </g>
      )}

      {/* Surface label — below the ground line */}
      {showLabels && (
        <text
          x={baseX + slopeLen * 0.5 * Math.cos(rad)}
          y={baseY + 20}
          textAnchor="middle"
          fontFamily="serif"
          fontStyle="italic"
          fontSize={11}
          fill={COLORS.angle}
        >
          {surface}
        </text>
      )}
    </g>
  );
};

export default SlopeRenderer;
