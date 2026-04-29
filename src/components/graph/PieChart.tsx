import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { DiagramModal } from '@/components/shared/DiagramModal';

export interface PieChartSegment {
  label: string;
  value: number;
  color?: string;
}

export interface PieChartData {
  type: 'pie_chart';
  segments: PieChartSegment[];
  caption?: string;
  footnote?: string;
  showPercentages?: boolean;
  showValues?: boolean;
  isDoughnut?: boolean;
}

export const isPieChartQuestion = (options: any): options is PieChartData => {
  if (!options || typeof options !== 'object') return false;
  return (
    options.type === 'pie_chart' &&
    Array.isArray(options.segments) &&
    options.segments.length > 0
  );
};

const DEFAULT_COLORS = [
  'hsl(221 83% 53%)',
  'hsl(142 71% 45%)',
  'hsl(25 95% 53%)',
  'hsl(0 84% 60%)',
  'hsl(262 83% 58%)',
  'hsl(196 80% 45%)',
  'hsl(340 75% 55%)',
  'hsl(45 93% 47%)',
];

interface PieChartProps {
  chartData: PieChartData;
  className?: string;
  size?: number;
}

interface Slice {
  label: string;
  value: number;
  color: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  percentage: number;
}

const buildSlices = (segments: PieChartSegment[], total: number): Slice[] => {
  const out: Slice[] = [];
  let cursor = -Math.PI / 2;
  segments.forEach((seg, i) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const startAngle = cursor;
    const endAngle = cursor + sweep;
    out.push({
      label: seg.label,
      value: seg.value,
      color: seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      startAngle,
      endAngle,
      midAngle: startAngle + sweep / 2,
      percentage: Math.round((seg.value / total) * 100),
    });
    cursor = endAngle;
  });
  return out;
};

const fmt = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1));

export const PieChart = ({ chartData, className = '', size = 220 }: PieChartProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const {
    segments,
    caption,
    footnote,
    showPercentages = true,
    showValues = false,
    isDoughnut = false,
  } = chartData;

  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return null;

  const slices = buildSlices(segments, total);

  const renderPie = (displaySize: number) => {
    const cx = displaySize / 2;
    const cy = displaySize / 2;
    const r = displaySize * 0.42;
    const ir = isDoughnut ? r * 0.55 : 0;

    const ptc = (rad: number, angle: number) => ({
      x: cx + rad * Math.cos(angle),
      y: cy + rad * Math.sin(angle),
    });

    const describe = (slice: Slice, hov: boolean) => {
      const offsetR = hov ? 4 : 0;
      const offX = offsetR * Math.cos(slice.midAngle);
      const offY = offsetR * Math.sin(slice.midAngle);
      const start = ptc(r, slice.startAngle);
      const end = ptc(r, slice.endAngle);
      const innerStart = ptc(ir, slice.startAngle);
      const innerEnd = ptc(ir, slice.endAngle);
      const largeArc = slice.endAngle - slice.startAngle > Math.PI ? 1 : 0;
      const ox = (p: { x: number; y: number }) => `${p.x + offX} ${p.y + offY}`;
      if (ir === 0) {
        return `M ${cx + offX} ${cy + offY} L ${ox(start)} A ${r} ${r} 0 ${largeArc} 1 ${ox(end)} Z`;
      }
      return `M ${ox(innerStart)} L ${ox(start)} A ${r} ${r} 0 ${largeArc} 1 ${ox(end)} L ${ox(innerEnd)} A ${ir} ${ir} 0 ${largeArc} 0 ${ox(innerStart)} Z`;
    };

    return (
      <svg
        viewBox={`0 0 ${displaySize} ${displaySize}`}
        width={displaySize}
        height={displaySize}
        style={{ display: 'block', maxWidth: '100%' }}
        role="img"
        aria-label={caption ?? 'Pie chart'}
      >
        {slices.map((slice, i) => {
          const hov = hoveredIndex === i;
          const labelR = ir === 0 ? r * 0.62 : (r + ir) / 2;
          const lp = ptc(labelR, slice.midAngle);
          const offX = (hov ? 4 : 0) * Math.cos(slice.midAngle);
          const offY = (hov ? 4 : 0) * Math.sin(slice.midAngle);
          return (
            <g key={i}>
              <path
                d={describe(slice, hov)}
                fill={slice.color}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                opacity={hoveredIndex !== null && !hov ? 0.55 : 1}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s, d 0.15s' }}
              />
              {showPercentages && slice.percentage >= 8 && (
                <text
                  x={lp.x + offX}
                  y={lp.y + offY + 4}
                  textAnchor="middle"
                  fontSize={Math.max(10, displaySize / 22)}
                  fontWeight={700}
                  fill="white"
                  pointerEvents="none"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
                >
                  {slice.percentage}%
                </text>
              )}
            </g>
          );
        })}
        {isDoughnut && (
          <text
            x={cx}
            y={cy + 5}
            textAnchor="middle"
            fontSize={Math.max(14, displaySize / 14)}
            fontWeight={700}
            fill="hsl(var(--foreground))"
          >
            {fmt(total)}
          </text>
        )}
      </svg>
    );
  };

  const renderLegend = (compact = false) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: compact ? 120 : 160,
      }}
    >
      {slices.map((slice, i) => (
        <div
          key={i}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            cursor: 'pointer',
            opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: slice.color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              color: 'hsl(var(--foreground))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {slice.label}
          </span>
          <span
            style={{
              color: 'hsl(var(--muted-foreground))',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {slice.percentage}%
            {showValues && ` (${fmt(slice.value)})`}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <figure className={`w-full my-4 ${className}`}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <figcaption
          className="text-sm font-medium text-foreground"
          style={{ flex: 1, textAlign: 'center' }}
        >
          {caption ?? 'Pie Chart'}
        </figcaption>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Enlarge chart"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <div className="w-full rounded-lg border border-border bg-card p-3">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <div style={{ flexShrink: 0 }}>{renderPie(size)}</div>
          {renderLegend()}
        </div>
      </div>

      {footnote && (
        <p className="text-xs text-muted-foreground mt-2 italic">{footnote}</p>
      )}

      <DiagramModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title={caption ?? 'Pie Chart'}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderPie(340)}
          {renderLegend()}
        </div>
      </DiagramModal>
    </figure>
  );
};

export default PieChart;
