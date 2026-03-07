import React from 'react';
import { ProjectileConfig, COLORS, MARKER_IDS, FONT } from '../types';
import { HatchedGround, AngleArc, ForceLabel } from '../svg-helpers';

interface Props {
  config: ProjectileConfig;
}

const ProjectileRenderer: React.FC<Props> = ({ config }) => {
  const {
    speed, angle, launchHeight, showComponents, showLabels,
    landingX, timeToMax, unknowns = [], speedLabel, angleLabel,
  } = config;

  const isSpeedUnknown = unknowns.includes('U') || unknowns.includes('speed') || typeof speed === 'string';
  const isAngleUnknown = unknowns.includes('α') || unknowns.includes('angle') || typeof angle === 'string';
  const isMaxHeightUnknown = unknowns.includes('maxHeight');

  // Use a default angle for drawing geometry when angle is symbolic
  const numericAngle = typeof angle === 'number' ? angle : 40;
  const rad = (numericAngle * Math.PI) / 180;

  // Layout constants
  const launchX = 60;
  const groundY = 240;
  const rangeWidth = 300; // horizontal pixel range for trajectory
  const peakY = 80; // peak height in pixels from ground

  // Build parabolic arc from O to landing point
  const landingXpx = launchX + rangeWidth;
  const midX = launchX + rangeWidth / 2;
  const launchY = groundY - (launchHeight || 0);

  // Generate parabolic points
  const steps = 50;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = launchX + t * rangeWidth;
    // Parabola: y = groundY - 4 * peakHeight * t * (1 - t)
    const actualPeakH = groundY - peakY - launchY;
    const py = launchY - 4 * actualPeakH * t * (1 - t);
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }

  const arrowLen = 55;

  // Labels
  const sLabel = speedLabel || (isSpeedUnknown ? (typeof speed === 'string' ? speed : 'U') : `${speed} m/s`);
  const aLabel = angleLabel || (isAngleUnknown ? (typeof angle === 'string' ? String(angle) : 'α') : `${angle}°`);

  // Range label
  const rangeLabel = landingX !== undefined
    ? (typeof landingX === 'number' ? `${landingX} m` : String(landingX))
    : null;

  // Time-to-max label
  const timeLabel = timeToMax !== undefined
    ? (typeof timeToMax === 'number' ? `t = ${timeToMax} s` : String(timeToMax))
    : null;

  // Max height label
  const heightLabel = isMaxHeightUnknown ? 'H' : null;

  return (
    <g>
      {/* Ground */}
      <HatchedGround x1={30} y1={groundY} x2={landingXpx + 30} y2={groundY} />

      {/* Trajectory path (parabolic dashed curve) */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={COLORS.angle}
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />

      {/* Launch point O */}
      <circle cx={launchX} cy={launchY} r={4} fill={COLORS.structural} />
      <text
        x={launchX - 12} y={launchY + 18}
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size}
        fill={COLORS.label} textAnchor="middle"
      >O</text>

      {/* Landing point */}
      <circle cx={landingXpx} cy={groundY} r={4} fill={COLORS.structural} />
      <text
        x={landingXpx + 10} y={groundY + 18}
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size}
        fill={COLORS.label} textAnchor="middle"
      >R</text>

      {/* Initial velocity arrow */}
      <line
        x1={launchX} y1={launchY}
        x2={launchX + arrowLen * Math.cos(rad)}
        y2={launchY - arrowLen * Math.sin(rad)}
        stroke={COLORS.velocity} strokeWidth={2}
        markerEnd={`url(#${MARKER_IDS.green})`}
      />
      <ForceLabel
        x={launchX + arrowLen * Math.cos(rad) + 12}
        y={launchY - arrowLen * Math.sin(rad) - 8}
        text={sLabel}
        show={showLabels}
        color={COLORS.velocity}
      />

      {/* Angle arc */}
      <AngleArc
        cx={launchX} cy={launchY}
        startAngleDeg={0} endAngleDeg={numericAngle}
        radius={30} label={aLabel} showLabel={showLabels}
      />

      {/* Velocity component dashed lines */}
      {showComponents && (
        <g>
          {/* Horizontal component */}
          <line
            x1={launchX} y1={launchY}
            x2={launchX + arrowLen * Math.cos(rad)} y2={launchY}
            stroke={COLORS.velocity} strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <text
            x={launchX + (arrowLen * Math.cos(rad)) / 2}
            y={launchY + 18}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12}
            fill={COLORS.velocity} textAnchor="middle"
          >
            {isSpeedUnknown
              ? `${typeof speed === 'string' ? speed : 'U'}cos${isAngleUnknown ? (typeof angle === 'string' ? angle : 'α') : `${angle}°`}`
              : `${speed}cos${angle}°`}
          </text>

          {/* Vertical component */}
          <line
            x1={launchX + arrowLen * Math.cos(rad)} y1={launchY}
            x2={launchX + arrowLen * Math.cos(rad)}
            y2={launchY - arrowLen * Math.sin(rad)}
            stroke={COLORS.velocity} strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <text
            x={launchX + arrowLen * Math.cos(rad) + 8}
            y={launchY - (arrowLen * Math.sin(rad)) / 2}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12}
            fill={COLORS.velocity} textAnchor="start"
          >
            {isSpeedUnknown
              ? `${typeof speed === 'string' ? speed : 'U'}sin${isAngleUnknown ? (typeof angle === 'string' ? angle : 'α') : `${angle}°`}`
              : `${speed}sin${angle}°`}
          </text>
        </g>
      )}

      {/* Peak - dotted vertical line */}
      <line
        x1={midX} y1={peakY} x2={midX} y2={groundY}
        stroke={COLORS.angle} strokeWidth={1} strokeDasharray="3 3"
      />
      {/* Peak - dotted horizontal line from O */}
      <line
        x1={launchX} y1={peakY} x2={midX} y2={peakY}
        stroke={COLORS.angle} strokeWidth={1} strokeDasharray="3 3"
      />
      {/* Peak dot */}
      <circle cx={midX} cy={peakY} r={3} fill={COLORS.structural} />

      {/* Time-to-max label at peak */}
      {timeLabel && (
        <text
          x={midX + 8} y={peakY - 8}
          fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12}
          fill={COLORS.label} textAnchor="start"
        >{timeLabel}</text>
      )}

      {/* Max height dimension arrow (right side) */}
      {heightLabel && (
        <g>
          {/* Vertical double-headed dimension line */}
          <line
            x1={landingXpx + 20} y1={peakY}
            x2={landingXpx + 20} y2={groundY}
            stroke={COLORS.structural} strokeWidth={1}
          />
          {/* Top tick */}
          <line x1={landingXpx + 15} y1={peakY} x2={landingXpx + 25} y2={peakY} stroke={COLORS.structural} strokeWidth={1} />
          {/* Bottom tick */}
          <line x1={landingXpx + 15} y1={groundY} x2={landingXpx + 25} y2={groundY} stroke={COLORS.structural} strokeWidth={1} />
          {/* Upward arrowhead */}
          <polygon points={`${landingXpx + 20},${peakY} ${landingXpx + 17},${peakY + 6} ${landingXpx + 23},${peakY + 6}`} fill={COLORS.structural} />
          {/* Downward arrowhead */}
          <polygon points={`${landingXpx + 20},${groundY} ${landingXpx + 17},${groundY - 6} ${landingXpx + 23},${groundY - 6}`} fill={COLORS.structural} />
          <text
            x={landingXpx + 30} y={(peakY + groundY) / 2 + 4}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size}
            fill={COLORS.label} textAnchor="start"
          >{heightLabel}</text>
        </g>
      )}

      {/* Range dimension arrow (below ground) */}
      {rangeLabel && (
        <g>
          <line
            x1={launchX} y1={groundY + 22}
            x2={landingXpx} y2={groundY + 22}
            stroke={COLORS.structural} strokeWidth={1}
          />
          {/* Left tick */}
          <line x1={launchX} y1={groundY + 17} x2={launchX} y2={groundY + 27} stroke={COLORS.structural} strokeWidth={1} />
          {/* Right tick */}
          <line x1={landingXpx} y1={groundY + 17} x2={landingXpx} y2={groundY + 27} stroke={COLORS.structural} strokeWidth={1} />
          {/* Left arrow */}
          <polygon points={`${launchX},${groundY + 22} ${launchX + 6},${groundY + 19} ${launchX + 6},${groundY + 25}`} fill={COLORS.structural} />
          {/* Right arrow */}
          <polygon points={`${landingXpx},${groundY + 22} ${landingXpx - 6},${groundY + 19} ${landingXpx - 6},${groundY + 25}`} fill={COLORS.structural} />
          <text
            x={(launchX + landingXpx) / 2} y={groundY + 38}
            fontFamily={FONT.family} fontSize={FONT.size}
            fill={COLORS.label} textAnchor="middle"
          >{rangeLabel}</text>
        </g>
      )}

      {/* Gravity indicator */}
      <line
        x1={midX + 60} y1={peakY + 30}
        x2={midX + 60} y2={peakY + 58}
        stroke={COLORS.weight} strokeWidth={1.5}
        markerEnd={`url(#${MARKER_IDS.red})`}
      />
      <text
        x={midX + 72} y={peakY + 50}
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={11}
        fill={COLORS.weight} textAnchor="start"
      >g</text>
    </g>
  );
};

export default ProjectileRenderer;
