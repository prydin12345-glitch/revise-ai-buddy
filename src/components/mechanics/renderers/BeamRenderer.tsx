import React from 'react';
import { BeamConfig, COLORS, MARKER_IDS, FONT } from '../types';
import { ForceLabel } from '../svg-helpers';

interface Props {
  config: BeamConfig;
}

const BeamRenderer: React.FC<Props> = ({ config }) => {
  const { length, loads, reactions, showLabels, endLabels, pointLabels, distributedMass } = config;

  const beamY = 150;
  const marginX = 40;
  const beamWidth = 320;
  const scale = beamWidth / length;
  const beamLeft = marginX;
  const beamRight = marginX + beamWidth;
  const arrowLen = 50;

  const posToX = (pos: number) => beamLeft + pos * scale;

  // Collect all key positions for dimension lines
  const allPositions: { pos: number; label: string }[] = [];
  if (endLabels?.left) allPositions.push({ pos: 0, label: endLabels.left });
  if (endLabels?.right) allPositions.push({ pos: length, label: endLabels.right });
  if (pointLabels) {
    pointLabels.forEach(p => allPositions.push({ pos: p.position, label: p.label }));
  }
  allPositions.sort((a, b) => a.pos - b.pos);

  // Wire hatching at reaction points
  const renderWireHatching = (x: number) => (
    <g>
      {[0, 1, 2].map(i => (
        <line
          key={i}
          x1={x - 6 + i * 6}
          y1={beamY - arrowLen - 8}
          x2={x - 10 + i * 6}
          y2={beamY - arrowLen - 18}
          stroke={COLORS.structural}
          strokeWidth={1}
        />
      ))}
      <line x1={x - 8} y1={beamY - arrowLen - 8} x2={x + 8} y2={beamY - arrowLen - 8} stroke={COLORS.structural} strokeWidth={1.5} />
    </g>
  );

  // Dimension lines
  const renderDimensionLines = () => {
    if (allPositions.length < 2) return null;
    const dimY = beamY + arrowLen + 40;
    const tickH = 5;

    return (
      <g>
        {allPositions.map((p, i) => {
          if (i === allPositions.length - 1) return null;
          const x1 = posToX(p.pos);
          const x2 = posToX(allPositions[i + 1].pos);
          const dist = (allPositions[i + 1].pos - p.pos).toFixed(1).replace(/\.0$/, '');
          const midX = (x1 + x2) / 2;
          return (
            <g key={`dim-${i}`}>
              {/* Horizontal line */}
              <line x1={x1} y1={dimY} x2={x2} y2={dimY} stroke={COLORS.angle} strokeWidth={1} />
              {/* End ticks */}
              <line x1={x1} y1={dimY - tickH} x2={x1} y2={dimY + tickH} stroke={COLORS.angle} strokeWidth={1} />
              <line x1={x2} y1={dimY - tickH} x2={x2} y2={dimY + tickH} stroke={COLORS.angle} strokeWidth={1} />
              {/* Distance label */}
              <text x={midX} y={dimY + 16} textAnchor="middle" fontFamily={FONT.family} fontSize={11} fill={COLORS.angle}>
                {dist} m
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <g>
      {/* Beam — thick horizontal line */}
      <line x1={beamLeft} y1={beamY} x2={beamRight} y2={beamY} stroke={COLORS.structural} strokeWidth={5} strokeLinecap="round" />

      {/* End ticks */}
      <line x1={beamLeft} y1={beamY - 8} x2={beamLeft} y2={beamY + 8} stroke={COLORS.structural} strokeWidth={2} />
      <line x1={beamRight} y1={beamY - 8} x2={beamRight} y2={beamY + 8} stroke={COLORS.structural} strokeWidth={2} />

      {/* End labels (A, B) */}
      {endLabels?.left && (
        <text x={beamLeft} y={beamY + 22} textAnchor="middle" fontFamily={FONT.family} fontWeight="bold" fontSize={14} fill={COLORS.label}>
          {endLabels.left}
        </text>
      )}
      {endLabels?.right && (
        <text x={beamRight} y={beamY + 22} textAnchor="middle" fontFamily={FONT.family} fontWeight="bold" fontSize={14} fill={COLORS.label}>
          {endLabels.right}
        </text>
      )}

      {/* Point labels (C, D, etc.) with ticks */}
      {pointLabels?.map((p, i) => {
        const px = posToX(p.position);
        return (
          <g key={`pt-${i}`}>
            <line x1={px} y1={beamY - 6} x2={px} y2={beamY + 6} stroke={COLORS.structural} strokeWidth={1.5} />
            <text x={px} y={beamY + 22} textAnchor="middle" fontFamily={FONT.family} fontWeight="bold" fontSize={14} fill={COLORS.label}>
              {p.label}
            </text>
          </g>
        );
      })}

      {/* Distributed mass (rod's own weight — downward red arrow at centre) */}
      {distributedMass && (
        <g>
          <line
            x1={posToX(distributedMass.position)}
            y1={beamY}
            x2={posToX(distributedMass.position)}
            y2={beamY + arrowLen}
            stroke={COLORS.weight}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.red})`}
          />
          <ForceLabel
            x={posToX(distributedMass.position) + 18}
            y={beamY + arrowLen / 2}
            text={distributedMass.label}
            show={showLabels}
            color={COLORS.weight}
          />
        </g>
      )}

      {/* Point loads (downward red arrows) */}
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
            <ForceLabel x={lx + 18} y={beamY + arrowLen / 2} text={load.label} show={showLabels} color={COLORS.weight} />
          </g>
        );
      })}

      {/* Reactions (upward blue arrows) + wire hatching */}
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
            {renderWireHatching(rx)}
            <ForceLabel
              x={rx - 18}
              y={beamY - arrowLen / 2}
              text={r.label}
              show={showLabels && !r.isUnknown}
              color={COLORS.normal}
            />
            {/* Always show symbol label for unknowns */}
            {r.isUnknown && (
              <text
                x={rx - 18}
                y={beamY - arrowLen / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={FONT.family}
                fontStyle={FONT.style}
                fontSize={FONT.size}
                fill={COLORS.normal}
              >
                {r.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Dimension lines */}
      {showLabels && renderDimensionLines()}
    </g>
  );
};

export default BeamRenderer;
