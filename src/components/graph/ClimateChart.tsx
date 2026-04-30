import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { DiagramModal } from '@/components/shared/DiagramModal';

export interface ClimateChartData {
  type: 'climate_chart';
  location: string;
  months: Array<{ month: string; temperature: number; precipitation: number }>;
  tempUnit?: '°C' | '°F';
  precipUnit?: 'mm' | 'inches';
  caption?: string;
  footnote?: string;
}

export const isClimateChartQuestion = (
  options: any
): options is ClimateChartData => {
  if (!options || typeof options !== 'object') return false;
  return (
    options.type === 'climate_chart' &&
    Array.isArray(options.months) &&
    options.months.length === 12 &&
    typeof options.location === 'string'
  );
};

interface Props {
  chartData: ClimateChartData;
  className?: string;
  height?: number;
}

const PADDING = { top: 32, right: 56, bottom: 48, left: 52 };
const SVG_W = 520;
const MONTH_ABBR = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const TEMP_COLOR = 'hsl(0 84% 55%)';
const PRECIP_COLOR = 'hsl(210 80% 50%)';

export const ClimateChart = ({ chartData, className = '', height = 280 }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const {
    location,
    months,
    tempUnit = '°C',
    precipUnit = 'mm',
    caption,
    footnote,
  } = chartData;

  if (!months || months.length !== 12) return null;

  const temps = months.map(m => m.temperature);
  const precips = months.map(m => m.precipitation);

  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const maxPrecip = Math.max(...precips);

  const tempPad = (maxTemp - minTemp) * 0.2 || 5;
  const niceMinTemp = Math.floor((minTemp - tempPad) / 5) * 5;
  const niceMaxTemp = Math.ceil((maxTemp + tempPad) / 5) * 5;
  const nicePrecipMax = Math.max(20, Math.ceil((maxPrecip * 1.2) / 20) * 20);

  const renderChart = (svgH: number) => {
    const plotW = SVG_W - PADDING.left - PADDING.right;
    const plotH = svgH - PADDING.top - PADDING.bottom;
    const barW = plotW / 12;

    const toTempY = (v: number) =>
      PADDING.top + plotH - ((v - niceMinTemp) / (niceMaxTemp - niceMinTemp)) * plotH;
    const toPrecipY = (v: number) =>
      PADDING.top + plotH - (v / nicePrecipMax) * plotH;

    const tempStep = (niceMaxTemp - niceMinTemp) / 4;
    const tempTicks = Array.from({ length: 5 }, (_, i) => niceMinTemp + tempStep * i);
    const precipStep = nicePrecipMax / 4;
    const precipTicks = Array.from({ length: 5 }, (_, i) => Math.round(precipStep * i));

    const tempPath = months.reduce((acc, m, i) => {
      const x = PADDING.left + (i + 0.5) * barW;
      const y = toTempY(m.temperature);
      return `${acc} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }, '');

    const yAxisBottom = PADDING.top + plotH;

    return (
      <svg viewBox={`0 0 ${SVG_W} ${svgH}`} width="100%" style={{ display: 'block' }}>
        {/* Location label */}
        <text x={SVG_W / 2} y={16} textAnchor="middle" fontSize={12} fontWeight={600} fill="hsl(var(--foreground))">
          {location}
        </text>

        {/* Grid (from temp axis) */}
        {tempTicks.map((tick, i) => (
          <line key={`tg-${i}`}
            x1={PADDING.left} y1={toTempY(tick)} x2={SVG_W - PADDING.right} y2={toTempY(tick)}
            stroke="hsl(var(--border))" strokeDasharray="2 3" strokeWidth={1} opacity={0.5} />
        ))}

        {/* 0°C reference */}
        {niceMinTemp < 0 && niceMaxTemp > 0 && (
          <line x1={PADDING.left} y1={toTempY(0)} x2={SVG_W - PADDING.right} y2={toTempY(0)}
            stroke="hsl(var(--muted-foreground))" strokeWidth={1} opacity={0.6} />
        )}

        {/* Precipitation bars */}
        {months.map((m, i) => {
          const barX = PADDING.left + i * barW + 2;
          const barH = (m.precipitation / nicePrecipMax) * plotH;
          const barY = yAxisBottom - barH;
          const isHov = hoveredMonth === i;
          return (
            <rect
              key={`pb-${i}`}
              x={barX}
              y={barY}
              width={barW - 4}
              height={barH}
              fill={PRECIP_COLOR}
              opacity={isHov ? 0.95 : 0.7}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredMonth(i)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              <title>{`${m.month}: ${m.precipitation}${precipUnit} precip, ${m.temperature}${tempUnit}`}</title>
            </rect>
          );
        })}

        {/* Temperature line */}
        <path d={tempPath} fill="none" stroke={TEMP_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* Temperature dots */}
        {months.map((m, i) => {
          const x = PADDING.left + (i + 0.5) * barW;
          const y = toTempY(m.temperature);
          const isHov = hoveredMonth === i;
          return (
            <circle
              key={`td-${i}`}
              cx={x}
              cy={y}
              r={isHov ? 5 : 3.5}
              fill={TEMP_COLOR}
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredMonth(i)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              <title>{`${m.month}: ${m.temperature}${tempUnit}, ${m.precipitation}${precipUnit}`}</title>
            </circle>
          );
        })}

        {/* Tooltip */}
        {hoveredMonth !== null && (() => {
          const x = PADDING.left + (hoveredMonth + 0.5) * barW;
          const y = toTempY(months[hoveredMonth].temperature);
          const tipW = 130;
          const tipX = Math.min(SVG_W - PADDING.right - tipW, Math.max(PADDING.left, x - tipW / 2));
          return (
            <g pointerEvents="none">
              <rect x={tipX} y={y - 34} width={tipW} height={24} rx={4}
                fill="hsl(var(--popover))" stroke="hsl(var(--border))" />
              <text x={tipX + tipW / 2} y={y - 18} textAnchor="middle" fontSize={11} fill="hsl(var(--popover-foreground))">
                {months[hoveredMonth].month}: {months[hoveredMonth].temperature}{tempUnit} · {months[hoveredMonth].precipitation}{precipUnit}
              </text>
            </g>
          );
        })()}

        {/* Axes */}
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={yAxisBottom} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
        <line x1={SVG_W - PADDING.right} y1={PADDING.top} x2={SVG_W - PADDING.right} y2={yAxisBottom} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
        <line x1={PADDING.left} y1={yAxisBottom} x2={SVG_W - PADDING.right} y2={yAxisBottom} stroke="hsl(var(--foreground))" strokeWidth={1.5} />

        {/* Left ticks (temperature) */}
        {tempTicks.map((tick, i) => (
          <text key={`tt-${i}`} x={PADDING.left - 6} y={toTempY(tick) + 4} textAnchor="end" fontSize={10} fill={TEMP_COLOR}>
            {tick}
          </text>
        ))}

        {/* Right ticks (precipitation) */}
        {precipTicks.map((tick, i) => (
          <text key={`pt-${i}`} x={SVG_W - PADDING.right + 6} y={toPrecipY(tick) + 4} textAnchor="start" fontSize={10} fill={PRECIP_COLOR}>
            {tick}
          </text>
        ))}

        {/* Left axis label */}
        <text x={14} y={PADDING.top + plotH / 2}
          fontSize={10} fill={TEMP_COLOR} textAnchor="middle"
          transform={`rotate(-90 14 ${PADDING.top + plotH / 2})`}>
          Temp ({tempUnit})
        </text>

        {/* Right axis label */}
        <text x={SVG_W - 12} y={PADDING.top + plotH / 2}
          fontSize={10} fill={PRECIP_COLOR} textAnchor="middle"
          transform={`rotate(90 ${SVG_W - 12} ${PADDING.top + plotH / 2})`}>
          Precip ({precipUnit})
        </text>

        {/* Month labels */}
        {MONTH_ABBR.map((abbr, i) => (
          <text key={`m-${i}`}
            x={PADDING.left + (i + 0.5) * barW}
            y={yAxisBottom + 16}
            textAnchor="middle"
            fontSize={11}
            fill="hsl(var(--muted-foreground))"
          >
            {abbr}
          </text>
        ))}
      </svg>
    );
  };

  return (
    <>
      <div className={className} style={{
        border: '1px solid hsl(var(--border))', borderRadius: 8,
        background: 'hsl(var(--card))', padding: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {caption ?? `Climate Graph — ${location}`}
          </span>
          <button
            onClick={() => setExpanded(true)}
            aria-label="Enlarge chart"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'hsl(var(--muted-foreground))' }}
          >
            <Maximize2 size={14} />
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {renderChart(height)}
        </div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
            <span style={{ display: 'inline-block', width: 14, height: 3, background: TEMP_COLOR, borderRadius: 2 }} />
            Temperature ({tempUnit})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
            <span style={{ display: 'inline-block', width: 14, height: 10, background: PRECIP_COLOR, opacity: 0.7, borderRadius: 2 }} />
            Precipitation ({precipUnit})
          </div>
        </div>

        {footnote && (
          <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 6, fontStyle: 'italic' }}>
            {footnote}
          </div>
        )}
      </div>

      <DiagramModal open={expanded} onClose={() => setExpanded(false)} title={caption ?? `Climate Graph — ${location}`}>
        <div style={{ width: '100%' }}>{renderChart(400)}</div>
      </DiagramModal>
    </>
  );
};
