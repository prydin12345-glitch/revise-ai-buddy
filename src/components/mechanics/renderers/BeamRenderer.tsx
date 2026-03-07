import React from 'react';
import { BeamConfig, COLORS, MARKER_IDS } from '../types';
import { ForceLabel } from '../svg-helpers';

interface Props {
  config: BeamConfig;
}

const BeamRenderer: React.FC<Props> = ({ config }) => {
  const { length, pivot, loads, reactions, showLabels } = config;

  const beamY = 160;
  const marginX = 50;
  const beamWidth = 300;
  const scale = beamWidth / length;
  const beamLeft = marginX;
  const beamRight = marginX + beamWidth;
  const arrowLen = 55;

  const posToX = (pos: number) => beamLeft + pos * scale;

  const renderPivot = () => {
    const px = posToX(pivot.position);
    if (pivot.type === 'support') {
      // Triangle
      const triH = 20;
      const triW = 14;
      return (
        <g>
          <polygon
            points={`${px},${beamY} ${px - triW},${beamY + triH} ${px + triW},${beamY + triH}`}
            fill="white"
            stroke={COLORS.structural}
            strokeWidth={2}
          />
          {/* Ground ticks under pivot */}
          <line x1={px - triW - 5} y1={beamY + triH} x2={px + triW + 5} y2={beamY + triH} stroke={COLORS.structural} strokeWidth={2} />
        </g>
      );
    }
    if (pivot.type === 'hinge') {
      return <circle cx={px} cy={beamY} r={6} fill="white" stroke={COLORS.structural} strokeWidth={2} />;
    }
    // Wall — left side bracket
    return (
      <g>
        <rect x={beamLeft - 10} y={beamY - 30} width={10} height={60} fill="white" stroke={COLORS.structural} strokeWidth={2} />
        {/* Hatching */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={i}
            x1={beamLeft - 10}
            y1={beamY - 30 + i * 15}
            x2={beamLeft - 2}
            y2={beamY - 22 + i * 15}
            stroke={COLORS.structural}
            strokeWidth={1}
          />
        ))}
      </g>
    );
  };

  return (
    <g>
      {/* Beam */}
      <line x1={beamLeft} y1={beamY} x2={beamRight} y2={beamY} stroke={COLORS.structural} strokeWidth={4} strokeLinecap="round" />

      {/* End ticks */}
      <line x1={beamLeft} y1={beamY - 6} x2={beamLeft} y2={beamY + 6} stroke={COLORS.structural} strokeWidth={2} />
      <line x1={beamRight} y1={beamY - 6} x2={beamRight} y2={beamY + 6} stroke={COLORS.structural} strokeWidth={2} />

      {/* Pivot */}
      {renderPivot()}

      {/* Loads (downward arrows) */}
      {loads.map((load, i) => {
        const lx = posToX(load.position);
        return (
          <g key={`load-${i}`}>
            <line
              x1={lx}
              y1={beamY}
              x2={lx}
              y2={beamY + arrowLen}
              stroke={COLORS.weight}
              strokeWidth={2}
              markerEnd={`url(#${MARKER_IDS.red})`}
            />
            <ForceLabel x={lx + 14} y={beamY + arrowLen / 2} text={load.label} show={showLabels} color={COLORS.weight} />
          </g>
        );
      })}

      {/* Reactions (upward arrows) */}
      {reactions.map((r, i) => {
        const rx = posToX(r.position);
        return (
          <g key={`reaction-${i}`}>
            <line
              x1={rx}
              y1={beamY}
              x2={rx}
              y2={beamY - arrowLen}
              stroke={COLORS.normal}
              strokeWidth={2}
              markerEnd={`url(#${MARKER_IDS.blue})`}
            />
            <ForceLabel x={rx - 14} y={beamY - arrowLen / 2} text={r.label} show={showLabels} color={COLORS.normal} />
          </g>
        );
      })}

      {/* Distance labels along beam */}
      {showLabels && (
        <g>
          {/* Total length */}
          <text x={(beamLeft + beamRight) / 2} y={beamY + arrowLen + 30} textAnchor="middle" fontFamily="serif" fontStyle="italic" fontSize={13} fill={COLORS.label}>
            {length} m
          </text>
          {/* Position markers */}
          {[...loads.map(l => l.position), pivot.position, ...reactions.map(r => r.position)]
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort((a, b) => a - b)
            .map((pos, i) => (
              <text key={i} x={posToX(pos)} y={beamY + 18} textAnchor="middle" fontFamily="serif" fontSize={10} fill={COLORS.angle}>
                {pos}
              </text>
            ))}
        </g>
      )}
    </g>
  );
};

export default BeamRenderer;
