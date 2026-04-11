import React from 'react';
import { VerticalMotionConfig, COLORS, MARKER_IDS, FONT } from '../types';
import { HatchedGround, ForceLabel } from '../svg-helpers';

interface Props {
  config: VerticalMotionConfig;
}

const VerticalMotionRenderer: React.FC<Props> = ({ config }) => {
  const { initialSpeed, direction, unknowns, showLabels } = config;

  const isUnknown = (field: string) => unknowns.includes(field);
  const isSpeedUnknown = isUnknown('speed') || isUnknown('velocity') || isUnknown('initialSpeed');

  const groundY = 270;
  const axisX = 120;
  const topY = 30;
  const launchY = groundY - 20;
  const peakY = topY + 40;

  return (
    <g>
      {/* Ground */}
      <HatchedGround x1={40} y1={groundY} x2={360} y2={groundY} />

      {/* Vertical axis */}
      <line x1={axisX} y1={groundY} x2={axisX} y2={topY} stroke={COLORS.structural} strokeWidth={1.5} markerEnd={`url(#${MARKER_IDS.black})`} />
      <text x={axisX - 12} y={topY - 6} fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size} fill={COLORS.label}>y</text>

      {/* Launch point A */}
      <circle cx={axisX} cy={launchY} r={6} fill={COLORS.structural} />
      <text x={axisX - 18} y={launchY + 4} fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size} fill={COLORS.label}>A</text>

      {/* Trajectory — vertical dashed line from launch to peak */}
      <line
        x1={axisX}
        y1={launchY}
        x2={axisX}
        y2={peakY}
        stroke={COLORS.angle}
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />

      {/* Dotted line at max height */}
      <line x1={axisX - 40} y1={peakY} x2={axisX + 80} y2={peakY} stroke={COLORS.angle} strokeWidth={1} strokeDasharray="3 3" />
      <text
        x={axisX + 85}
        y={peakY + 4}
        fontFamily={FONT.family}
        fontStyle={FONT.style}
        fontSize={FONT.size - 2}
        fill={COLORS.angle}
      >
        {isUnknown('maxHeight') ? 'H = ?' : 'max height'}
      </text>

      {/* Initial velocity arrow */}
      {direction === 'up' ? (
        <g>
          <line
            x1={axisX + 20}
            y1={launchY}
            x2={axisX + 20}
            y2={launchY - 70}
            stroke={COLORS.velocity}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <text
            x={axisX + 34}
            y={launchY - 35}
            fontFamily={FONT.family}
            fontStyle={FONT.style}
            fontSize={FONT.size - 1}
            fill={COLORS.velocity}
          >
            {isSpeedUnknown ? 'u = ?' : `u = ${initialSpeed} ms⁻¹`}
          </text>
        </g>
      ) : (
        <g>
          <line
            x1={axisX + 20}
            y1={peakY}
            x2={axisX + 20}
            y2={peakY + 70}
            stroke={COLORS.velocity}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <text
            x={axisX + 34}
            y={peakY + 35}
            fontFamily={FONT.family}
            fontStyle={FONT.style}
            fontSize={FONT.size - 1}
            fill={COLORS.velocity}
          >
            {isSpeedUnknown ? 'u = ?' : `u = ${initialSpeed} ms⁻¹`}
          </text>
        </g>
      )}

      {/* Gravity arrow */}
      <line
        x1={axisX + 60}
        y1={(launchY + peakY) / 2 - 20}
        x2={axisX + 60}
        y2={(launchY + peakY) / 2 + 20}
        stroke={COLORS.weight}
        strokeWidth={1.5}
        markerEnd={`url(#${MARKER_IDS.red})`}
      />
      <text
        x={axisX + 74}
        y={(launchY + peakY) / 2 + 4}
        fontFamily={FONT.family}
        fontStyle={FONT.style}
        fontSize={FONT.size - 2}
        fill={COLORS.weight}
      >
        g
      </text>

      {/* Time annotation */}
      {isUnknown('time') && showLabels && (
        <text
          x={axisX - 50}
          y={(launchY + peakY) / 2}
          fontFamily={FONT.family}
          fontStyle={FONT.style}
          fontSize={FONT.size - 2}
          fill={COLORS.angle}
        >
          t = ?
        </text>
      )}
    </g>
  );
};

export default VerticalMotionRenderer;
