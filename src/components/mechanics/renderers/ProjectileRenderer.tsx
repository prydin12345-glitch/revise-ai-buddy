import React from 'react';
import { ProjectileConfig, COLORS, MARKER_IDS, FONT } from '../types';
import { HatchedGround, AngleArc, ForceLabel } from '../svg-helpers';

interface Props {
  config: ProjectileConfig;
}

const ProjectileRenderer: React.FC<Props> = ({ config }) => {
  const {
    speed, angle, launchHeight = 0, showComponents, showLabels,
    landingX, timeToMax, unknowns = [],
  } = config;

  const isSpeedUnknown = unknowns.includes('U') || unknowns.includes('speed') || typeof speed === 'string';
  const isAngleUnknown = unknowns.includes('α') || unknowns.includes('angle') || typeof angle === 'string';
  const isMaxHeightUnknown = unknowns.includes('maxHeight');

  // Use a default angle for drawing geometry when angle is symbolic
  const drawAngle = typeof angle === 'number' ? angle : 40;
  const rad = (drawAngle * Math.PI) / 180;

  // ── Derive labels from config values, never hardcode ──
  const sLabel = typeof speed === 'string' ? speed : `${speed} m/s`;
  const aLabel = typeof angle === 'string' ? String(angle) : `${angle}°`;
  const sRaw = typeof speed === 'string' ? speed : String(speed);
  const aRaw = typeof angle === 'string' ? String(angle) : `${angle}°`;
  const vertLabel = `${sRaw}sin${aRaw}`;
  const horizLabel = `${sRaw}cos${aRaw}`;

  // ── Layout constants ──
  const svgW = 400;
  const svgH = 300;
  const topPad = 30;
  const groundY = 250;
  const originX = 50;
  const endX = 360; // landing point X
  const rangeW = endX - originX;
  const midX = originX + rangeW / 2; // peak X (symmetric)
  const originY = groundY - (launchHeight > 0 ? 20 : 0);

  // ── Compute peak height to fill ~60% of usable space ──
  const usableH = groundY - topPad;
  const peakPixelH = usableH * 0.6;
  const peakY = groundY - peakPixelH;

  // ── Generate correct parabolic trajectory (O → peak → R) ──
  // Parametric: t goes 0→1, parabola y = 4·h·t·(1−t)
  const steps = 60;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = originX + t * rangeW;
    const py = groundY - 4 * peakPixelH * t * (1 - t);
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }

  const arrowLen = 55;

  // Range label — suppress when range is the unknown
  const isRangeUnknown = unknowns.includes('range') || unknowns.includes('landingX');
  const rangeLabel = (landingX !== undefined && !isRangeUnknown)
    ? (typeof landingX === 'number' ? `${landingX} m` : String(landingX))
    : null;

  // Time-to-max label — suppress when time is the unknown
  const isTimeUnknown = unknowns.includes('time') || unknowns.includes('timeToMax');
  const timeLabel = (timeToMax !== undefined && !isTimeUnknown)
    ? (typeof timeToMax === 'number' ? `t = ${timeToMax} s` : String(timeToMax))
    : null;

  // Max height label
  const heightLabel = isMaxHeightUnknown ? 'H' : null;

  return (
    <g>
      {/* Ground — extends 20px beyond O and R */}
      <HatchedGround x1={originX - 20} y1={groundY} x2={endX + 20} y2={groundY} />

      {/* Trajectory path (parabolic dashed curve) */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={COLORS.angle}
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />

      {/* Launch point O */}
      <circle cx={originX} cy={originY} r={4} fill={COLORS.structural} />
      <text
        x={originX} y={groundY + 18}
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size}
        fill={COLORS.label} textAnchor="middle"
      >O</text>

      {/* Landing point R */}
      <circle cx={endX} cy={groundY} r={4} fill={COLORS.structural} />
      <text
        x={endX} y={groundY + 18}
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size}
        fill={COLORS.label} textAnchor="middle"
      >R</text>

      {/* Initial velocity arrow */}
      <line
        x1={originX} y1={originY}
        x2={originX + arrowLen * Math.cos(rad)}
        y2={originY - arrowLen * Math.sin(rad)}
        stroke={COLORS.velocity} strokeWidth={2}
        markerEnd={`url(#${MARKER_IDS.green})`}
      />
      <ForceLabel
        x={originX + arrowLen * Math.cos(rad) + 12}
        y={originY - arrowLen * Math.sin(rad) - 8}
        text={sLabel}
        show={showLabels}
        color={COLORS.velocity}
      />

      {/* Angle arc */}
      <AngleArc
        cx={originX} cy={originY}
        startAngleDeg={0} endAngleDeg={drawAngle}
        radius={30} label={aLabel} showLabel={showLabels}
      />

      {/* Velocity component dashed lines */}
      {showComponents && (
        <g>
          {/* Horizontal component */}
          <line
            x1={originX} y1={originY}
            x2={originX + arrowLen * Math.cos(rad)} y2={originY}
            stroke={COLORS.velocity} strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <text
            x={originX + (arrowLen * Math.cos(rad)) / 2}
            y={originY + 18}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12}
            fill={COLORS.velocity} textAnchor="middle"
          >{horizLabel}</text>

          {/* Vertical component */}
          <line
            x1={originX + arrowLen * Math.cos(rad)} y1={originY}
            x2={originX + arrowLen * Math.cos(rad)}
            y2={originY - arrowLen * Math.sin(rad)}
            stroke={COLORS.velocity} strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <text
            x={originX + arrowLen * Math.cos(rad) + 8}
            y={originY - (arrowLen * Math.sin(rad)) / 2}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12}
            fill={COLORS.velocity} textAnchor="start"
          >{vertLabel}</text>
        </g>
      )}

      {/* Peak - dotted vertical line from peak to ground */}
      <line
        x1={midX} y1={peakY} x2={midX} y2={groundY}
        stroke={COLORS.angle} strokeWidth={1} strokeDasharray="3 3"
      />
      {/* Peak - dotted horizontal line from O to below peak */}
      <line
        x1={originX} y1={peakY} x2={midX} y2={peakY}
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
          <line
            x1={endX + 25} y1={peakY}
            x2={endX + 25} y2={groundY}
            stroke={COLORS.structural} strokeWidth={1}
          />
          <line x1={endX + 20} y1={peakY} x2={endX + 30} y2={peakY} stroke={COLORS.structural} strokeWidth={1} />
          <line x1={endX + 20} y1={groundY} x2={endX + 30} y2={groundY} stroke={COLORS.structural} strokeWidth={1} />
          <polygon points={`${endX + 25},${peakY} ${endX + 22},${peakY + 6} ${endX + 28},${peakY + 6}`} fill={COLORS.structural} />
          <polygon points={`${endX + 25},${groundY} ${endX + 22},${groundY - 6} ${endX + 28},${groundY - 6}`} fill={COLORS.structural} />
          <text
            x={endX + 35} y={(peakY + groundY) / 2 + 4}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size}
            fill={COLORS.label} textAnchor="start"
          >{heightLabel}</text>
        </g>
      )}

      {/* Range dimension arrow (below ground) */}
      {rangeLabel && (
        <g>
          <line
            x1={originX} y1={groundY + 22}
            x2={endX} y2={groundY + 22}
            stroke={COLORS.structural} strokeWidth={1}
          />
          <line x1={originX} y1={groundY + 17} x2={originX} y2={groundY + 27} stroke={COLORS.structural} strokeWidth={1} />
          <line x1={endX} y1={groundY + 17} x2={endX} y2={groundY + 27} stroke={COLORS.structural} strokeWidth={1} />
          <polygon points={`${originX},${groundY + 22} ${originX + 6},${groundY + 19} ${originX + 6},${groundY + 25}`} fill={COLORS.structural} />
          <polygon points={`${endX},${groundY + 22} ${endX - 6},${groundY + 19} ${endX - 6},${groundY + 25}`} fill={COLORS.structural} />
          <text
            x={(originX + endX) / 2} y={groundY + 38}
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
