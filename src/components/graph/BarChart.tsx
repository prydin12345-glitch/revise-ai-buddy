import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { DiagramModal } from '@/components/shared/DiagramModal';

export interface BarChartBar {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartGroup {
  groupLabel: string;
  bars: BarChartBar[];
}

export interface BarChartData {
  type: 'bar_chart';
  bars?: BarChartBar[];
  grouped?: BarChartGroup[];
  xLabel?: string;
  yLabel?: string;
  caption?: string;
  footnote?: string;
  orientation?: 'vertical' | 'horizontal';
}

export const isBarChartQuestion = (options: any): options is BarChartData => {
  if (!options || typeof options !== 'object') return false;
  return (
    options.type === 'bar_chart' &&
    (
      (Array.isArray(options.bars) && options.bars.length > 0) ||
      (Array.isArray(options.grouped) && options.grouped.length > 0)
    )
  );
};

const DEFAULT_COLORS = [
  'hsl(221 83% 53%)',
  'hsl(262 83% 58%)',
  'hsl(142 71% 45%)',
  'hsl(25 95% 53%)',
  'hsl(0 84% 60%)',
  'hsl(196 80% 45%)',
  'hsl(340 75% 55%)',
  'hsl(45 93% 47%)',
];

interface BarChartProps {
  chartData: BarChartData;
  className?: string;
  height?: number;
}

const niceMaxFor = (maxValue: number) => {
  if (maxValue <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const normalized = maxValue / magnitude;
  const nice =
    normalized <= 1 ? 1 :
    normalized <= 2 ? 2 :
    normalized <= 5 ? 5 : 10;
  return nice * magnitude * 1.1;
};

const fmt = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1));

export const BarChart = ({ chartData, className = '', height = 240 }: BarChartProps) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const {
    bars,
    grouped,
    xLabel,
    yLabel,
    caption,
    footnote,
    orientation = 'vertical',
  } = chartData;

  const isGrouped = !!(grouped && grouped.length > 0);
  const allValues = isGrouped
    ? grouped!.flatMap(g => g.bars.map(b => b.value))
    : (bars ?? []).map(b => b.value);
  const maxValue = Math.max(0, ...allValues);
  const niceMax = niceMaxFor(maxValue);

  const tickCount = 5;
  const tickStep = niceMax / tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round(tickStep * i * 100) / 100
  );

  const SVG_WIDTH = 540;
  const PADDING = { top: 20, right: 16, bottom: 56, left: 56 };

  const renderVertical = (svgHeight: number) => {
    const plotW = SVG_WIDTH - PADDING.left - PADDING.right;
    const plotH = svgHeight - PADDING.top - PADDING.bottom;
    const toY = (v: number) => PADDING.top + plotH - (v / niceMax) * plotH;

    const items: BarChartGroup[] = isGrouped
      ? grouped!
      : (bars ?? []).map(b => ({ groupLabel: b.label, bars: [b] }));

    const groupW = plotW / Math.max(items.length, 1);
    const barsPerGroup = isGrouped ? (items[0]?.bars.length ?? 1) : 1;
    const barW = isGrouped
      ? (groupW * 0.78) / barsPerGroup
      : groupW * 0.6;
    const groupInnerPad = (groupW - barW * barsPerGroup) / 2;

    return (
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        width="100%"
        height={svgHeight}
        style={{ display: 'block', maxWidth: '100%' }}
        role="img"
        aria-label={caption ?? 'Bar chart'}
      >
        {/* Gridlines + Y ticks */}
        {ticks.map((t, i) => (
          <g key={`yt-${i}`}>
            <line
              x1={PADDING.left}
              x2={SVG_WIDTH - PADDING.right}
              y1={toY(t)}
              y2={toY(t)}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              strokeDasharray={i === 0 ? '0' : '2 3'}
            />
            <text
              x={PADDING.left - 6}
              y={toY(t) + 4}
              textAnchor="end"
              fontSize={10}
              fill="hsl(var(--muted-foreground))"
            >
              {fmt(t)}
            </text>
          </g>
        ))}

        {/* Y axis label */}
        {yLabel && (
          <text
            transform={`rotate(-90 14 ${PADDING.top + plotH / 2})`}
            x={14}
            y={PADDING.top + plotH / 2}
            textAnchor="middle"
            fontSize={11}
            fill="hsl(var(--muted-foreground))"
          >
            {yLabel}
          </text>
        )}

        {/* Bars */}
        {items.map((item, gi) => {
          const groupX = PADDING.left + gi * groupW + groupInnerPad;
          return (
            <g key={`g-${gi}`}>
              {item.bars.map((bar, bi) => {
                const x = groupX + bi * barW;
                const barH = (Math.max(0, bar.value) / niceMax) * plotH;
                const y = toY(bar.value);
                const color =
                  bar.color ??
                  DEFAULT_COLORS[(isGrouped ? bi : gi) % DEFAULT_COLORS.length];
                const key = `${gi}-${bi}`;
                const hov = hoveredKey === key;
                return (
                  <g key={key}>
                    <rect
                      x={x + 1}
                      y={y}
                      width={Math.max(1, barW - 2)}
                      height={Math.max(0, barH)}
                      fill={color}
                      opacity={hoveredKey && !hov ? 0.55 : 1}
                      rx={2}
                      onMouseEnter={() => setHoveredKey(key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                    />
                    {barH > 18 && (
                      <text
                        x={x + barW / 2}
                        y={y - 4}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill="hsl(var(--foreground))"
                      >
                        {fmt(bar.value)}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* X axis label */}
              <text
                x={PADDING.left + gi * groupW + groupW / 2}
                y={PADDING.top + plotH + 16}
                textAnchor="middle"
                fontSize={10}
                fill="hsl(var(--muted-foreground))"
              >
                {item.groupLabel.length > 14
                  ? item.groupLabel.slice(0, 13) + '…'
                  : item.groupLabel}
              </text>
            </g>
          );
        })}

        {/* X axis line */}
        <line
          x1={PADDING.left}
          x2={SVG_WIDTH - PADDING.right}
          y1={PADDING.top + plotH}
          y2={PADDING.top + plotH}
          stroke="hsl(var(--border))"
          strokeWidth={1.5}
        />

        {xLabel && (
          <text
            x={PADDING.left + plotW / 2}
            y={svgHeight - 8}
            textAnchor="middle"
            fontSize={11}
            fill="hsl(var(--muted-foreground))"
          >
            {xLabel}
          </text>
        )}
      </svg>
    );
  };

  const renderHorizontal = (svgHeight?: number) => {
    const itemBars = bars ?? [];
    const rowH = 28;
    const totalH = svgHeight ?? Math.max(height, PADDING.top + itemBars.length * rowH + PADDING.bottom);
    const labelW = 90;
    const plotX = PADDING.left + labelW;
    const plotW = SVG_WIDTH - plotX - PADDING.right - 30;
    return (
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${totalH}`}
        width="100%"
        height={totalH}
        style={{ display: 'block', maxWidth: '100%' }}
      >
        {itemBars.map((bar, i) => {
          const y = PADDING.top + i * rowH;
          const barW = (Math.max(0, bar.value) / niceMax) * plotW;
          const color = bar.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          const key = `h-${i}`;
          const hov = hoveredKey === key;
          return (
            <g key={key}>
              <text
                x={plotX - 6}
                y={y + rowH / 2 + 3}
                textAnchor="end"
                fontSize={11}
                fill="hsl(var(--foreground))"
              >
                {bar.label.length > 16 ? bar.label.slice(0, 15) + '…' : bar.label}
              </text>
              <rect
                x={plotX}
                y={y + 4}
                width={plotW}
                height={rowH - 8}
                fill="hsl(var(--muted))"
                opacity={0.4}
                rx={2}
              />
              <rect
                x={plotX}
                y={y + 4}
                width={Math.max(0, barW)}
                height={rowH - 8}
                fill={color}
                opacity={hoveredKey && !hov ? 0.55 : 1}
                rx={2}
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              />
              <text
                x={plotX + barW + 4}
                y={y + rowH / 2 + 3}
                fontSize={10}
                fontWeight={600}
                fill="hsl(var(--foreground))"
              >
                {fmt(bar.value)}
              </text>
            </g>
          );
        })}
        {xLabel && (
          <text
            x={plotX + plotW / 2}
            y={totalH - 6}
            textAnchor="middle"
            fontSize={11}
            fill="hsl(var(--muted-foreground))"
          >
            {xLabel}
          </text>
        )}
      </svg>
    );
  };

  const renderLegend = () => {
    if (!isGrouped || !grouped?.[0]?.bars) return null;
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          marginTop: 6,
        }}
      >
        {grouped[0].bars.map((bar, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: bar.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                display: 'inline-block',
              }}
            />
            <span style={{ color: 'hsl(var(--foreground))' }}>{bar.label}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderChart = (h: number) =>
    orientation === 'horizontal' ? renderHorizontal(h) : renderVertical(h);

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
          {caption ?? 'Bar Chart'}
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

      <div className="w-full overflow-x-auto rounded-lg border border-border bg-card p-3">
        {renderChart(height)}
        {renderLegend()}
      </div>

      {footnote && (
        <p className="text-xs text-muted-foreground mt-2 italic">{footnote}</p>
      )}

      <DiagramModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title={caption ?? 'Bar Chart'}
      >
        <div style={{ width: '100%' }}>
          {renderChart(Math.round(height * 1.6))}
          {renderLegend()}
        </div>
      </DiagramModal>
    </figure>
  );
};

export default BarChart;
