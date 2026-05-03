import React from 'react';
import { COLORS, MARKER_IDS, FONT } from './types';

// ── Label placement registry — collision-aware label positioning ──

export interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class LabelPlacementRegistry {
  private occupied: LabelRect[] = [];
  private readonly charWidth = 7.5;
  private readonly lineHeight = 16;
  private readonly padding = 4;

  estimateSize(text: string, fontSize = 13): { w: number; h: number } {
    const chars = text.length;
    const scale = fontSize / 13;
    return {
      w: chars * this.charWidth * scale + this.padding * 2,
      h: this.lineHeight * scale,
    };
  }

  overlaps(rect: LabelRect, margin = 3): boolean {
    return this.occupied.some(occ =>
      rect.x - margin < occ.x + occ.width &&
      rect.x + rect.width + margin > occ.x &&
      rect.y - margin < occ.y + occ.height &&
      rect.y + rect.height + margin > occ.y
    );
  }

  reserve(rect: LabelRect) {
    this.occupied.push(rect);
  }

  place(
    preferredX: number,
    preferredY: number,
    text: string,
    fontSize = 13,
    anchor: 'start' | 'middle' | 'end' = 'start',
  ): { x: number; y: number } {
    const { w, h } = this.estimateSize(text, fontSize);
    const anchorOffsetX = anchor === 'middle' ? -w / 2 : anchor === 'end' ? -w : 0;

    const candidates = [
      { dx: 0, dy: 0 },
      { dx: 0, dy: -18 }, { dx: 0, dy: 18 },
      { dx: 18, dy: 0 }, { dx: -18, dy: 0 },
      { dx: 18, dy: -18 }, { dx: -18, dy: -18 },
      { dx: 18, dy: 18 }, { dx: -18, dy: 18 },
      { dx: 0, dy: -36 }, { dx: 36, dy: 0 },
    ];

    for (const { dx, dy } of candidates) {
      const cx = preferredX + dx;
      const cy = preferredY + dy;
      const rect: LabelRect = {
        x: cx + anchorOffsetX,
        y: cy - h,
        width: w,
        height: h,
      };
      if (!this.overlaps(rect)) {
        this.occupied.push(rect);
        return { x: cx, y: cy };
      }
    }

    const fallback: LabelRect = {
      x: preferredX + anchorOffsetX,
      y: preferredY - h,
      width: w,
      height: h,
    };
    this.occupied.push(fallback);
    return { x: preferredX, y: preferredY };
  }
}

/** All arrow marker definitions — include once in every MechanicsDraw SVG */
export const ArrowMarkerDefs: React.FC = () => (
  <defs>
    {([
      [MARKER_IDS.black, COLORS.structural],
      [MARKER_IDS.red, COLORS.weight],
      [MARKER_IDS.blue, COLORS.normal],
      [MARKER_IDS.orange, COLORS.friction],
      [MARKER_IDS.green, COLORS.velocity],
    ] as const).map(([id, color]) => (
      <marker
        key={id}
        id={id}
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill={color} />
      </marker>
    ))}
  </defs>
);

/** Hatched ground line — diagonal ticks beneath a baseline */
export const HatchedGround: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tickLength?: number;
  spacing?: number;
}> = ({ x1, y1, x2, y2, tickLength = 8, spacing = 15 }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const count = Math.floor(len / spacing);
  const ux = dx / len;
  const uy = dy / len;
  // perpendicular pointing "into" the ground (downward for horizontal)
  const px = uy;
  const py = -ux;

  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= count; i++) {
    const cx = x1 + ux * i * spacing;
    const cy = y1 + uy * i * spacing;
    ticks.push(
      <line
        key={i}
        x1={cx}
        y1={cy}
        x2={cx + px * tickLength + ux * (-tickLength * 0.5)}
        y2={cy + py * tickLength + uy * (-tickLength * 0.5)}
        stroke={COLORS.structural}
        strokeWidth={1}
      />
    );
  }

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.structural} strokeWidth={2} />
      {ticks}
    </g>
  );
};

/** Angle arc path */
export const AngleArc: React.FC<{
  cx: number;
  cy: number;
  startAngleDeg: number;
  endAngleDeg: number;
  radius?: number;
  label?: string;
  showLabel?: boolean;
}> = ({ cx, cy, startAngleDeg, endAngleDeg, radius = 35, label, showLabel = true }) => {
  const s = (startAngleDeg * Math.PI) / 180;
  const e = (endAngleDeg * Math.PI) / 180;
  const x1 = cx + radius * Math.cos(s);
  const y1 = cy - radius * Math.sin(s);
  const x2 = cx + radius * Math.cos(e);
  const y2 = cy - radius * Math.sin(e);
  const largeArc = Math.abs(endAngleDeg - startAngleDeg) > 180 ? 1 : 0;
  const sweep = endAngleDeg > startAngleDeg ? 0 : 1;

  const midAngle = ((startAngleDeg + endAngleDeg) / 2 * Math.PI) / 180;
  const lx = cx + (radius + 12) * Math.cos(midAngle);
  const ly = cy - (radius + 12) * Math.sin(midAngle);

  return (
    <g>
      <path
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x2} ${y2}`}
        fill="none"
        stroke={COLORS.angle}
        strokeWidth={1.5}
      />
      {showLabel && label && (
        <text
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={FONT.family}
          fontStyle={FONT.style}
          fontSize={FONT.size - 2}
          fill={COLORS.label}
        >
          {label}
        </text>
      )}
    </g>
  );
};

/** Label or placeholder box */
export const ForceLabel: React.FC<{
  x: number;
  y: number;
  text: string;
  show: boolean;
  color?: string;
}> = ({ x, y, text, show, color = COLORS.label }) => {
  if (show) {
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={FONT.family}
        fontStyle={FONT.style}
        fontSize={FONT.size}
        fill={color}
      >
        {text}
      </text>
    );
  }
  return (
    <g>
      <rect
        x={x - 10}
        y={y - 8}
        width={20}
        height={16}
        fill="white"
        stroke={COLORS.structural}
        strokeWidth={1}
        rx={2}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={FONT.family}
        fontSize={FONT.size}
        fill={COLORS.angle}
      >
        ?
      </text>
    </g>
  );
};
