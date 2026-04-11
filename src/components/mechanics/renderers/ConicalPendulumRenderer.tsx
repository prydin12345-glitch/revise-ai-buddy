import React from 'react';
import { ConicalPendulumConfig, COLORS, MARKER_IDS, FONT } from '../types';
import { AngleArc, ForceLabel } from '../svg-helpers';

interface Props {
  config: ConicalPendulumConfig;
}

const ConicalPendulumRenderer: React.FC<Props> = ({ config }) => {
  const { angle, mass, showTension, showWeight, showRadius, unknowns, showLabels } = config;
  const rad = (angle * Math.PI) / 180;

  const isUnknown = (field: string) => unknowns.includes(field);

  // Fixed point O at top centre
  const ox = 200;
  const oy = 30;
  const stringLen = 200;

  // Particle position
  const px = ox + stringLen * Math.sin(rad);
  const py = oy + stringLen * Math.cos(rad);

  // Point directly below O at particle height
  const bx = ox;
  const by = py;

  const arrowLen = 60;

  return (
    <g>
      {/* Fixed point */}
      <circle cx={ox} cy={oy} r={4} fill={COLORS.structural} />
      <text x={ox - 14} y={oy - 6} fontFamily={FONT.family} fontStyle={FONT.style} fontSize={FONT.size} fill={COLORS.label}>O</text>

      {/* Vertical dashed reference line */}
      <line x1={ox} y1={oy} x2={ox} y2={py + 20} stroke={COLORS.angle} strokeWidth={1} strokeDasharray="5 4" />

      {/* String */}
      <line x1={ox} y1={oy} x2={px} y2={py} stroke={COLORS.structural} strokeWidth={2} />

      {/* Angle arc between vertical and string */}
      <AngleArc
        cx={ox}
        cy={oy}
        startAngleDeg={270}
        endAngleDeg={270 + angle}
        radius={40}
        label={isUnknown('angle') ? 'θ' : `${angle}°`}
        showLabel={showLabels}
      />

      {/* Horizontal radius dashed line */}
      {showRadius && (
        <g>
          <line x1={bx} y1={by} x2={px} y2={py} stroke={COLORS.angle} strokeWidth={1} strokeDasharray="5 4" />
          <text
            x={(bx + px) / 2}
            y={by - 8}
            textAnchor="middle"
            fontFamily={FONT.family}
            fontStyle={FONT.style}
            fontSize={FONT.size - 2}
            fill={COLORS.angle}
          >
            r
          </text>
        </g>
      )}

      {/* Particle */}
      <circle cx={px} cy={py} r={8} fill={COLORS.structural} stroke={COLORS.structural} strokeWidth={1} />

      {/* Weight arrow (downward) */}
      {showWeight && (
        <g>
          <line
            x1={px}
            y1={py + 8}
            x2={px}
            y2={py + 8 + arrowLen}
            stroke={COLORS.weight}
            strokeWidth={2}
            markerEnd={`url(#${MARKER_IDS.red})`}
          />
          <ForceLabel
            x={px + 18}
            y={py + 8 + arrowLen + 14}
            text={isUnknown('weight') ? 'W' : `${mass}g`}
            show={showLabels}
            color={COLORS.weight}
          />
        </g>
      )}

      {/* Tension arrow (along string toward O) */}
      {showTension && (
        <g>
          {(() => {
            const dx = ox - px;
            const dy = oy - py;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len;
            const uy = dy / len;
            const startX = px + ux * 10;
            const startY = py + uy * 10;
            const endX = px + ux * (10 + arrowLen);
            const endY = py + uy * (10 + arrowLen);
            return (
              <>
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={COLORS.normal}
                  strokeWidth={2}
                  markerEnd={`url(#${MARKER_IDS.blue})`}
                />
                <ForceLabel
                  x={endX - 18}
                  y={endY - 8}
                  text={isUnknown('tension') ? 'T' : 'T'}
                  show={showLabels}
                  color={COLORS.normal}
                />
              </>
            );
          })()}
        </g>
      )}

      {/* Centripetal force arrow (horizontal toward vertical axis) */}
      {(() => {
        const centripetalLen = arrowLen * 0.7;
        // Direction from particle toward the vertical axis (ox)
        const dirX = ox - px; // always negative when particle is right of axis
        const mag = Math.abs(dirX);
        const ux = dirX / mag;
        return (
          <g>
            <line
              x1={px}
              y1={py}
              x2={px + ux * centripetalLen}
              y2={py}
              stroke={COLORS.velocity}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              markerEnd={`url(#${MARKER_IDS.green})`}
            />
            <text
              x={px + ux * centripetalLen + (ux < 0 ? -8 : 8)}
              y={py - 8}
              textAnchor={ux < 0 ? 'end' : 'start'}
              fontFamily={FONT.family}
              fontStyle={FONT.style}
              fontSize={FONT.size - 2}
              fill={COLORS.velocity}
            >
              F
            </text>
          </g>
        );
      })()}
    </g>
  );
};

export default ConicalPendulumRenderer;
