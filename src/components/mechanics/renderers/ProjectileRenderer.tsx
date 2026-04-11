import React from 'react';
import { ProjectileConfig, COLORS, MARKER_IDS, FONT } from '../types';
import { HatchedGround, AngleArc, ForceLabel } from '../svg-helpers';

interface Props {
  config: ProjectileConfig;
}

/** Format a numeric or symbolic value with a unit */
const fmtVal = (v: number | string | undefined, unit: string): string => {
  if (v === undefined || v === null) return '?';
  if (typeof v === 'string') return v;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}`;
};

const ProjectileRenderer: React.FC<Props> = ({ config }) => {
  const {
    speed, angle, launchHeight = 0, showComponents, showLabels,
    landingX, timeToMax, unknowns = [],
  } = config;

  const isSpeedUnknown = unknowns.includes('U') || unknowns.includes('speed') || typeof speed === 'string';
  const isAngleUnknown = unknowns.includes('α') || unknowns.includes('angle') || typeof angle === 'string';
  const isMaxHeightUnknown = unknowns.includes('maxHeight');

  const drawAngle = typeof angle === 'number' ? angle : 40;
  const rad = (drawAngle * Math.PI) / 180;

  // ── Labels derived from config ──
  const sLabel = typeof speed === 'string' ? speed : fmtVal(speed, 'm/s');
  const aLabel = typeof angle === 'string' ? String(angle) : `${angle}°`;
  const sRaw = typeof speed === 'string' ? speed : String(speed);
  const aRaw = typeof angle === 'string' ? String(angle) : `${angle}°`;
  const vertLabel = `${sRaw}sin${aRaw}`;
  const horizLabel = `${sRaw}cos${aRaw}`;

  // ── Expanded layout constants (was 50/360/250) ──
  const groundY = 270;
  const originX = 60;
  const endX = 430;
  const rangeW = endX - originX; // 370
  const midX = originX + rangeW / 2; // 245
  const originY = groundY - (launchHeight > 0 ? 20 : 0);

  const topPad = 30;
  const usableH = groundY - topPad; // 240
  const peakPixelH = usableH * 0.55; // 132
  const peakY = groundY - peakPixelH;

  // ── Parabolic trajectory ──
  const steps = 60;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(
      `${(originX + t * rangeW).toFixed(1)},${(groundY - 4 * peakPixelH * t * (1 - t)).toFixed(1)}`
    );
  }

  const arrowLen = 65; // was 55
  const arcRadius = 24; // was 30 — tighter arc to reduce clutter

  // ── Velocity arrow tip ──
  const velTipX = originX + arrowLen * Math.cos(rad);
  const velTipY = originY - arrowLen * Math.sin(rad);

  // ── Suppress unknown values ──
  const isRangeUnknown = unknowns.includes('range') || unknowns.includes('landingX');
  const rangeLabel = (landingX !== undefined && !isRangeUnknown)
    ? fmtVal(landingX, 'm') : null;

  const isTimeUnknown = unknowns.includes('time') || unknowns.includes('timeToMax');
  const timeText = (timeToMax !== undefined && !isTimeUnknown)
    ? (typeof timeToMax === 'number' ? `t = ${timeToMax} s` : String(timeToMax))
    : null;

  const heightLabel = isMaxHeightUnknown ? 'H' : null;

  // ── Angle arc label — show symbol when components are visible ──
  const arcLabel = showComponents && !isAngleUnknown
    ? 'θ'
    : isAngleUnknown ? 'θ' : aLabel;

  // ── Range dimension ──
  const rangeArrowY = groundY + 32; // was +22
  const rangeLabelY = rangeArrowY + 16;

  // ── Height dimension ──
  const heightArrowX = endX + 30;
  const heightLabelX = heightArrowX + 12;

  // ── Peak time label ──
  const timeLabelX = midX + 12;
  const timeLabelY = peakY - 16;

  return (
    <g>
      {/* Ground */}
      <HatchedGround x1={originX - 20} y1={groundY} x2={endX + 20} y2={groundY} />

      {/* Trajectory */}
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={COLORS.angle}
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />

      {/* Launch point O — label left-aligned */}
      <circle cx={originX} cy={originY} r={4} fill={COLORS.structural} />
      <text
        x={originX - 10} y={groundY + 16}
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12}
        fill={COLORS.label} textAnchor="end"
      >O</text>

      {/* Landing point R — label right-aligned */}
      <circle cx={endX} cy={groundY} r={4} fill={COLORS.structural} />
      <text
        x={endX + 10} y={groundY + 16}
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={12}
        fill={COLORS.label} textAnchor="start"
      >R</text>

      {/* Velocity arrow */}
      <line
        x1={originX} y1={originY}
        x2={velTipX} y2={velTipY}
        stroke={COLORS.velocity} strokeWidth={2}
        markerEnd={`url(#${MARKER_IDS.green})`}
      />
      <ForceLabel
        x={velTipX + 16} y={velTipY - 10}
        text={sLabel} show={showLabels !== false}
        color={COLORS.velocity}
      />

      {/* Angle arc */}
      <AngleArc
        cx={originX} cy={originY}
        startAngleDeg={0} endAngleDeg={drawAngle}
        radius={arcRadius} label={arcLabel} showLabel={showLabels !== false}
      />

      {/* Component arrows (when enabled) */}
      {showComponents && (
        <g>
          {/* Horizontal component */}
          <line
            x1={originX} y1={originY}
            x2={velTipX} y2={originY}
            stroke={COLORS.velocity} strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <text
            x={originX + (velTipX - originX) / 2}
            y={originY + 16}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={11}
            fill={COLORS.velocity} textAnchor="middle"
          >{horizLabel}</text>

          {/* Vertical component */}
          <line
            x1={velTipX} y1={originY}
            x2={velTipX} y2={velTipY}
            stroke={COLORS.velocity} strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <text
            x={velTipX + 18} y={(originY + velTipY) / 2}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={11}
            fill={COLORS.velocity} textAnchor="start"
          >{vertLabel}</text>
        </g>
      )}

      {/* Peak dotted lines */}
      <line x1={midX} y1={peakY} x2={midX} y2={groundY}
        stroke={COLORS.angle} strokeWidth={1} strokeDasharray="3 3" />
      <line x1={originX} y1={peakY} x2={midX} y2={peakY}
        stroke={COLORS.angle} strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={midX} cy={peakY} r={3} fill={COLORS.structural} />

      {/* Time label at peak */}
      {timeText && (
        <g>
          <rect
            x={timeLabelX - 2} y={timeLabelY - 10}
            width={timeText.length * 6.5 + 6} height={14}
            fill="white" opacity={0.85} rx={2}
          />
          <text
            x={timeLabelX} y={timeLabelY}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={11}
            fill={COLORS.label} textAnchor="start"
          >{timeText}</text>
        </g>
      )}

      {/* Height dimension arrow */}
      {heightLabel && (
        <g>
          <line x1={heightArrowX} y1={peakY} x2={heightArrowX} y2={groundY}
            stroke={COLORS.structural} strokeWidth={1} />
          <line x1={heightArrowX - 5} y1={peakY} x2={heightArrowX + 5} y2={peakY}
            stroke={COLORS.structural} strokeWidth={1} />
          <line x1={heightArrowX - 5} y1={groundY} x2={heightArrowX + 5} y2={groundY}
            stroke={COLORS.structural} strokeWidth={1} />
          <polygon points={`${heightArrowX},${peakY} ${heightArrowX - 3},${peakY + 6} ${heightArrowX + 3},${peakY + 6}`}
            fill={COLORS.structural} />
          <polygon points={`${heightArrowX},${groundY} ${heightArrowX - 3},${groundY - 6} ${heightArrowX + 3},${groundY - 6}`}
            fill={COLORS.structural} />
          <text
            x={heightLabelX} y={(peakY + groundY) / 2 + 4}
            fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size}
            fill={COLORS.label} textAnchor="start"
          >{heightLabel}</text>
        </g>
      )}

      {/* Range dimension arrow */}
      {rangeLabel && (
        <g>
          <line x1={originX} y1={rangeArrowY} x2={endX} y2={rangeArrowY}
            stroke={COLORS.structural} strokeWidth={1} />
          <line x1={originX} y1={rangeArrowY - 5} x2={originX} y2={rangeArrowY + 5}
            stroke={COLORS.structural} strokeWidth={1} />
          <line x1={endX} y1={rangeArrowY - 5} x2={endX} y2={rangeArrowY + 5}
            stroke={COLORS.structural} strokeWidth={1} />
          <polygon points={`${originX},${rangeArrowY} ${originX + 6},${rangeArrowY - 3} ${originX + 6},${rangeArrowY + 3}`}
            fill={COLORS.structural} />
          <polygon points={`${endX},${rangeArrowY} ${endX - 6},${rangeArrowY - 3} ${endX - 6},${rangeArrowY + 3}`}
            fill={COLORS.structural} />
          <text
            x={(originX + endX) / 2} y={rangeLabelY}
            fontFamily={FONT.family} fontSize={FONT.size}
            fill={COLORS.label} textAnchor="middle"
          >{rangeLabel}</text>
        </g>
      )}

      {/* Gravity indicator */}
      <line
        x1={midX + 70} y1={peakY + 30}
        x2={midX + 70} y2={peakY + 58}
        stroke={COLORS.weight} strokeWidth={1.5}
        markerEnd={`url(#${MARKER_IDS.red})`}
      />
      <text
        x={midX + 82} y={peakY + 50}
        fontFamily={FONT.family} fontStyle={FONT.style} fontSize={11}
        fill={COLORS.weight} textAnchor="start"
      >g</text>
    </g>
  );
};

export default ProjectileRenderer;
