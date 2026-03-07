import React from 'react';
import { ProjectileConfig, COLORS, MARKER_IDS } from '../types';
import { HatchedGround, AngleArc, ForceLabel } from '../svg-helpers';

interface Props {
  config: ProjectileConfig;
}

const ProjectileRenderer: React.FC<Props> = ({ config }) => {
  const { speed, angle, launchHeight, showComponents, showLabels } = config;

  const rad = (angle * Math.PI) / 180;
  const g = 9.8;

  // Launch point in SVG space
  const launchX = 60;
  const groundY = 260;
  const launchY = groundY - (launchHeight / speed) * 150; // scale launch height

  // Compute trajectory points (parametric)
  const vx = speed * Math.cos(rad);
  const vy = speed * Math.sin(rad);
  const tTotal = (vy + Math.sqrt(vy * vy + 2 * g * launchHeight)) / g;

  const steps = 40;
  const scaleX = 280 / (vx * tTotal || 1);
  const scaleY = scaleX; // uniform scaling

  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * tTotal;
    const px = launchX + vx * t * scaleX;
    const py = launchY - (vy * t - 0.5 * g * t * t) * scaleY;
    // Clamp to ground
    if (py > groundY) break;
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }

  const arrowLen = 50;
  const compLen = arrowLen;

  return (
    <g>
      {/* Ground */}
      <HatchedGround x1={30} y1={groundY} x2={370} y2={groundY} />

      {/* Launch platform if elevated */}
      {launchHeight > 0 && (
        <rect x={launchX - 15} y={launchY} width={15} height={groundY - launchY} fill="white" stroke={COLORS.structural} strokeWidth={1.5} />
      )}

      {/* Trajectory path */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={COLORS.angle}
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />

      {/* Launch point */}
      <circle cx={launchX} cy={launchY} r={4} fill={COLORS.structural} />

      {/* Initial velocity vector */}
      <line
        x1={launchX}
        y1={launchY}
        x2={launchX + arrowLen * Math.cos(rad)}
        y2={launchY - arrowLen * Math.sin(rad)}
        stroke={COLORS.velocity}
        strokeWidth={2}
        markerEnd={`url(#${MARKER_IDS.green})`}
      />
      <ForceLabel
        x={launchX + arrowLen * Math.cos(rad) + 14}
        y={launchY - arrowLen * Math.sin(rad) - 6}
        text={`${speed} m/s`}
        show={showLabels}
        color={COLORS.velocity}
      />

      {/* Angle arc */}
      <AngleArc cx={launchX} cy={launchY} startAngleDeg={0} endAngleDeg={angle} radius={30} label={`${angle}°`} showLabel={showLabels} />

      {/* Velocity components */}
      {showComponents && (
        <g>
          {/* Horizontal component */}
          <line
            x1={launchX}
            y1={launchY}
            x2={launchX + compLen * Math.cos(rad)}
            y2={launchY}
            stroke={COLORS.velocity}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <ForceLabel
            x={launchX + compLen * Math.cos(rad) / 2}
            y={launchY + 16}
            text={`${speed}cos${angle}°`}
            show={showLabels}
            color={COLORS.velocity}
          />

          {/* Vertical component */}
          <line
            x1={launchX + compLen * Math.cos(rad)}
            y1={launchY}
            x2={launchX + compLen * Math.cos(rad)}
            y2={launchY - compLen * Math.sin(rad)}
            stroke={COLORS.velocity}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd={`url(#${MARKER_IDS.green})`}
          />
          <ForceLabel
            x={launchX + compLen * Math.cos(rad) + 22}
            y={launchY - compLen * Math.sin(rad) / 2}
            text={`${speed}sin${angle}°`}
            show={showLabels}
            color={COLORS.velocity}
          />
        </g>
      )}
    </g>
  );
};

export default ProjectileRenderer;
