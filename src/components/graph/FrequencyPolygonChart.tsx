import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { DiagramModal } from '@/components/shared/DiagramModal';

export interface FrequencyPolygonClass {
  lowerBoundary: number;
  upperBoundary: number;
  frequency: number;
}

export interface FrequencyPolygonData {
  type: 'frequency_polygon';
  classes?: FrequencyPolygonClass[];
  xLabel?: string;
  yLabel?: string;
  caption?: string;
  footnote?: string;
  showHistogramBars?: boolean;
  datasets?: Array<{
    label: string;
    color?: string;
    classes: FrequencyPolygonClass[];
  }>;
}

export const isFrequencyPolygonQuestion = (
  options: any
): options is FrequencyPolygonData => {
  if (!options || typeof options !== 'object') return false;
  return (
    options.type === 'frequency_polygon' &&
    (
      (Array.isArray(options.classes) && options.classes.length >= 2) ||
      (Array.isArray(options.datasets) && options.datasets.length >= 1 &&
        options.datasets.every((d: any) => Array.isArray(d.classes) && d.classes.length >= 2))
    )
  );
};

const COLORS = [
  'hsl(221 83% 53%)',
  'hsl(0 84% 60%)',
  'hsl(142 71% 45%)',
  'hsl(25 95% 53%)',
];

interface Props {
  chartData: FrequencyPolygonData;
  className?: string;
  height?: number;
}

const PADDING = { top: 24, right: 24, bottom: 52, left: 52 };
const SVG_W = 520;

export const FrequencyPolygonChart = ({ chartData, className = '', height = 260 }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [hoveredDataset, setHoveredDataset] = useState<number | null>(null);

  const {
    classes,
    xLabel = 'Value',
    yLabel = 'Frequency',
    caption,
    footnote,
    showHistogramBars = false,
    datasets,
  } = chartData;

  const isMultiple = !!(datasets && datasets.length > 0);

  const allClasses = isMultiple
    ? datasets!.flatMap(d => d.classes)
    : (classes ?? []);

  if (allClasses.length < 2) return null;

  const minX = Math.min(...allClasses.map(c => c.lowerBoundary));
  const maxX = Math.max(...allClasses.map(c => c.upperBoundary));
  const maxFreq = Math.max(...allClasses.map(c => c.frequency));
  const niceMax = Math.max(1, Math.ceil(maxFreq * 1.1));

  const renderChart = (svgH: number) => {
    const plotW = SVG_W - PADDING.left - PADDING.right;
    const plotH = svgH - PADDING.top - PADDING.bottom;

    const toX = (v: number) => PADDING.left + ((v - minX) / (maxX - minX)) * plotW;
    const toY = (v: number) => PADDING.top + plotH - (v / niceMax) * plotH;

    const yTicks = Array.from({ length: 6 }, (_, i) => Math.round((niceMax / 5) * i));
    const xTicks = [...new Set(allClasses.flatMap(c => [c.lowerBoundary, c.upperBoundary]))].sort((a, b) => a - b);

    const renderDataset = (
      dataClasses: FrequencyPolygonClass[],
      color: string,
      datasetIndex: number,
    ) => {
      const midpoints = dataClasses.map(c => ({
        x: (c.lowerBoundary + c.upperBoundary) / 2,
        y: c.frequency,
      }));

      const classWidth = dataClasses[0].upperBoundary - dataClasses[0].lowerBoundary;
      const extendedPoints = [
        { x: midpoints[0].x - classWidth, y: 0 },
        ...midpoints,
        { x: midpoints[midpoints.length - 1].x + classWidth, y: 0 },
      ];

      const polygonPath = extendedPoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`)
        .join(' ');

      const isActive = hoveredDataset === null || hoveredDataset === datasetIndex;
      const fadedOpacity = hoveredDataset !== null && hoveredDataset !== datasetIndex ? 0.25 : 1;

      return (
        <g key={`ds-${datasetIndex}`} opacity={fadedOpacity}>
          {showHistogramBars && dataClasses.map((c, i) => {
            const barX = toX(c.lowerBoundary);
            const barW = toX(c.upperBoundary) - toX(c.lowerBoundary) - 1;
            const barH = (c.frequency / niceMax) * plotH;
            return (
              <rect
                key={`bar-${i}`}
                x={barX}
                y={toY(c.frequency)}
                width={Math.max(0, barW)}
                height={barH}
                fill={color}
                opacity={0.15}
              />
            );
          })}

          <path d={polygonPath} fill={color} opacity={0.12} />
          <path d={polygonPath} fill="none" stroke={color} strokeWidth={isActive ? 2.25 : 1.5} strokeLinejoin="round" />

          {midpoints.map((p, i) => (
            <circle
              key={`mp-${i}`}
              cx={toX(p.x)}
              cy={toY(p.y)}
              r={3.5}
              fill={color}
              stroke="hsl(var(--background))"
              strokeWidth={1.25}
            >
              <title>{`x = ${p.x}, frequency = ${p.y}`}</title>
            </circle>
          ))}
        </g>
      );
    };

    return (
      <svg viewBox={`0 0 ${SVG_W} ${svgH}`} width="100%" style={{ display: 'block' }}>
        {/* Grid + Y ticks */}
        {yTicks.map((tick, i) => (
          <g key={`yt-${i}`}>
            <line x1={PADDING.left} y1={toY(tick)} x2={SVG_W - PADDING.right} y2={toY(tick)}
              stroke="hsl(var(--border))" strokeDasharray="2 3" strokeWidth={1} opacity={0.6} />
            <text x={PADDING.left - 8} y={toY(tick) + 4} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">{tick}</text>
          </g>
        ))}

        {/* X ticks */}
        {xTicks.map((tick, i) => (
          <g key={`xt-${i}`}>
            <line x1={toX(tick)} y1={toY(0)} x2={toX(tick)} y2={toY(0) + 4}
              stroke="hsl(var(--foreground))" strokeWidth={1} />
            <text x={toX(tick)} y={toY(0) + 16} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{tick}</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={toY(0)} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
        <line x1={PADDING.left} y1={toY(0)} x2={SVG_W - PADDING.right} y2={toY(0)} stroke="hsl(var(--foreground))" strokeWidth={1.5} />

        {/* Axis labels */}
        <text x={14} y={PADDING.top + (svgH - PADDING.top - PADDING.bottom) / 2}
          fontSize={11} fill="hsl(var(--muted-foreground))" textAnchor="middle"
          transform={`rotate(-90 14 ${PADDING.top + (svgH - PADDING.top - PADDING.bottom) / 2})`}>
          {yLabel}
        </text>
        <text x={PADDING.left + (SVG_W - PADDING.left - PADDING.right) / 2} y={svgH - 10}
          fontSize={11} fill="hsl(var(--muted-foreground))" textAnchor="middle">{xLabel}</text>

        {/* Datasets */}
        {isMultiple
          ? datasets!.map((ds, i) => renderDataset(ds.classes, ds.color ?? COLORS[i % COLORS.length], i))
          : renderDataset(classes ?? [], COLORS[0], 0)}
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
            {caption ?? 'Frequency Polygon'}
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

        {isMultiple && (
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            {datasets!.map((ds, i) => {
              const color = ds.color ?? COLORS[i % COLORS.length];
              return (
                <div
                  key={`leg-${i}`}
                  onMouseEnter={() => setHoveredDataset(i)}
                  onMouseLeave={() => setHoveredDataset(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, cursor: 'pointer',
                    color: 'hsl(var(--muted-foreground))',
                    opacity: hoveredDataset !== null && hoveredDataset !== i ? 0.4 : 1,
                  }}
                >
                  <span style={{ display: 'inline-block', width: 14, height: 3, background: color, borderRadius: 2 }} />
                  {ds.label}
                </div>
              );
            })}
          </div>
        )}

        {footnote && (
          <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 6, fontStyle: 'italic' }}>
            {footnote}
          </div>
        )}
      </div>

      <DiagramModal open={expanded} onClose={() => setExpanded(false)} title={caption ?? 'Frequency Polygon'}>
        <div style={{ width: '100%' }}>{renderChart(380)}</div>
      </DiagramModal>
    </>
  );
};
