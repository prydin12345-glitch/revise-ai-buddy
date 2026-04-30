import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { DiagramModal } from '@/components/shared/DiagramModal';

export interface CumulativeFrequencyData {
  type: 'cumulative_frequency';
  points: Array<{ upperBoundary: number; cumulativeFrequency: number }>;
  totalFrequency?: number;
  xLabel?: string;
  yLabel?: string;
  caption?: string;
  footnote?: string;
  showMedianLine?: boolean;
  showQuartileLines?: boolean;
}

export const isCumulativeFrequencyQuestion = (
  options: any
): options is CumulativeFrequencyData => {
  if (!options || typeof options !== 'object') return false;
  return (
    options.type === 'cumulative_frequency' &&
    Array.isArray(options.points) &&
    options.points.length >= 2
  );
};

interface Props {
  chartData: CumulativeFrequencyData;
  className?: string;
  height?: number;
}

const PADDING = { top: 24, right: 24, bottom: 52, left: 56 };
const SVG_W = 520;

export const CumulativeFrequencyChart = ({ chartData, className = '', height = 280 }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const {
    points,
    xLabel = 'Value',
    yLabel = 'Cumulative Frequency',
    caption,
    footnote,
    showMedianLine = true,
    showQuartileLines = true,
  } = chartData;

  if (!points || points.length < 2) return null;

  const totalFreq = chartData.totalFrequency ?? points[points.length - 1].cumulativeFrequency;
  const maxX = points[points.length - 1].upperBoundary;
  const minX = 0;

  const allPoints = [{ x: minX, y: 0 }, ...points.map(p => ({ x: p.upperBoundary, y: p.cumulativeFrequency }))];

  const interpolateX = (targetY: number): number => {
    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];
      if (targetY >= p1.y && targetY <= p2.y) {
        const t = p2.y === p1.y ? 0 : (targetY - p1.y) / (p2.y - p1.y);
        return p1.x + t * (p2.x - p1.x);
      }
    }
    return maxX;
  };

  const lqX = interpolateX(totalFreq / 4);
  const medianX = interpolateX(totalFreq / 2);
  const uqX = interpolateX((totalFreq * 3) / 4);

  const renderChart = (svgH: number) => {
    const plotW = SVG_W - PADDING.left - PADDING.right;
    const plotH = svgH - PADDING.top - PADDING.bottom;

    const toX = (v: number) => PADDING.left + ((v - minX) / (maxX - minX)) * plotW;
    const toY = (v: number) => PADDING.top + plotH - (v / totalFreq) * plotH;

    const yTicks = Array.from({ length: 6 }, (_, i) => Math.round((totalFreq / 5) * i));

    const pathD = allPoints.reduce((acc, point, i) => {
      const px = toX(point.x);
      const py = toY(point.y);
      if (i === 0) return `M ${px} ${py}`;
      const prev = allPoints[i - 1];
      const ppx = toX(prev.x);
      const ppy = toY(prev.y);
      const cpx = (ppx + px) / 2;
      return `${acc} C ${cpx} ${ppy} ${cpx} ${py} ${px} ${py}`;
    }, '');

    const areaD = `${pathD} L ${toX(maxX)} ${toY(0)} L ${toX(minX)} ${toY(0)} Z`;

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
        {points.map((p, i) => (
          <g key={`xt-${i}`}>
            <line x1={toX(p.upperBoundary)} y1={toY(0)} x2={toX(p.upperBoundary)} y2={toY(0) + 4}
              stroke="hsl(var(--foreground))" strokeWidth={1} />
            <text x={toX(p.upperBoundary)} y={toY(0) + 16} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">{p.upperBoundary}</text>
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

        {/* Area + curve */}
        <path d={areaD} fill="hsl(221 83% 53%)" opacity={0.12} />
        <path d={pathD} fill="none" stroke="hsl(221 83% 53%)" strokeWidth={2.5} strokeLinejoin="round" />

        {/* Lower quartile */}
        {showQuartileLines && (
          <g>
            <line x1={toX(lqX)} y1={toY(totalFreq / 4)} x2={toX(lqX)} y2={toY(0)}
              stroke="hsl(25 95% 53%)" strokeDasharray="4 3" strokeWidth={1.25} />
            <line x1={PADDING.left} y1={toY(totalFreq / 4)} x2={toX(lqX)} y2={toY(totalFreq / 4)}
              stroke="hsl(25 95% 53%)" strokeDasharray="4 3" strokeWidth={1.25} />
            <text x={toX(lqX) + 4} y={toY(0) - 4} fontSize={10} fill="hsl(25 95% 53%)">Q₁={lqX.toFixed(1)}</text>
          </g>
        )}

        {/* Median */}
        {showMedianLine && (
          <g>
            <line x1={toX(medianX)} y1={toY(totalFreq / 2)} x2={toX(medianX)} y2={toY(0)}
              stroke="hsl(var(--primary))" strokeDasharray="4 3" strokeWidth={1.5} />
            <line x1={PADDING.left} y1={toY(totalFreq / 2)} x2={toX(medianX)} y2={toY(totalFreq / 2)}
              stroke="hsl(var(--primary))" strokeDasharray="4 3" strokeWidth={1.5} />
            <text x={toX(medianX) + 4} y={toY(totalFreq / 2) - 4} fontSize={10} fill="hsl(var(--primary))" fontWeight={600}>
              Med={medianX.toFixed(1)}
            </text>
          </g>
        )}

        {/* Upper quartile */}
        {showQuartileLines && (
          <g>
            <line x1={toX(uqX)} y1={toY((totalFreq * 3) / 4)} x2={toX(uqX)} y2={toY(0)}
              stroke="hsl(25 95% 53%)" strokeDasharray="4 3" strokeWidth={1.25} />
            <line x1={PADDING.left} y1={toY((totalFreq * 3) / 4)} x2={toX(uqX)} y2={toY((totalFreq * 3) / 4)}
              stroke="hsl(25 95% 53%)" strokeDasharray="4 3" strokeWidth={1.25} />
            <text x={toX(uqX) + 4} y={toY((totalFreq * 3) / 4) - 4} fontSize={10} fill="hsl(25 95% 53%)">Q₃={uqX.toFixed(1)}</text>
          </g>
        )}

        {/* Data points */}
        {allPoints.slice(1).map((point, i) => (
          <circle
            key={`pt-${i}`}
            cx={toX(point.x)}
            cy={toY(point.y)}
            r={hoveredPoint === i ? 5 : 3.5}
            fill="hsl(221 83% 53%)"
            stroke="hsl(var(--background))"
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredPoint(i)}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <title>{`x = ${point.x}, cf = ${point.y}`}</title>
          </circle>
        ))}

        {/* Tooltip */}
        {hoveredPoint !== null && (
          <g>
            <rect
              x={toX(allPoints[hoveredPoint + 1].x) - 40}
              y={toY(allPoints[hoveredPoint + 1].y) - 30}
              width={80} height={20} rx={4}
              fill="hsl(var(--popover))"
              stroke="hsl(var(--border))"
            />
            <text
              x={toX(allPoints[hoveredPoint + 1].x)}
              y={toY(allPoints[hoveredPoint + 1].y) - 16}
              textAnchor="middle"
              fontSize={11}
              fill="hsl(var(--popover-foreground))"
            >
              cf = {allPoints[hoveredPoint + 1].y}
            </text>
          </g>
        )}
      </svg>
    );
  };

  const summaryStats = [
    { label: 'LQ (Q₁)', value: lqX.toFixed(1), color: 'hsl(25 95% 53%)' },
    { label: 'Median', value: medianX.toFixed(1), color: 'hsl(var(--primary))' },
    { label: 'UQ (Q₃)', value: uqX.toFixed(1), color: 'hsl(25 95% 53%)' },
  ];

  return (
    <>
      <div className={className} style={{
        border: '1px solid hsl(var(--border))', borderRadius: 8,
        background: 'hsl(var(--card))', padding: 12, position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {caption ?? 'Cumulative Frequency Curve'}
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

        {(showMedianLine || showQuartileLines) && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            {summaryStats.map((stat, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {footnote && (
          <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 6, fontStyle: 'italic' }}>
            {footnote}
          </div>
        )}
      </div>

      <DiagramModal open={expanded} onClose={() => setExpanded(false)} title={caption ?? 'Cumulative Frequency Curve'}>
        <div style={{ width: '100%' }}>{renderChart(400)}</div>
      </DiagramModal>
    </>
  );
};
