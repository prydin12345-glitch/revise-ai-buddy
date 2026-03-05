import React from 'react';

export interface HistogramBin {
  lower: number;
  upper: number;
  frequency: number;
}

export interface HistogramData {
  type: 'histogram';
  bins: HistogramBin[];
  xLabel?: string;
  yLabel?: string;
  domainX?: [number, number];
}

interface HistogramChartProps {
  chartData: HistogramData;
  className?: string;
}

export function isHistogramQuestion(options: any): options is HistogramData {
  return options && typeof options === 'object' && options.type === 'histogram' && Array.isArray(options.bins);
}

export const HistogramChart: React.FC<HistogramChartProps> = ({ chartData, className = '' }) => {
  const { bins, xLabel, yLabel, domainX } = chartData;

  if (!bins.length) return null;

  // Calculate frequency density for each bin
  const densityBins = bins.map(b => {
    const width = b.upper - b.lower;
    return { ...b, width, density: width > 0 ? b.frequency / width : 0 };
  });

  const allLowers = densityBins.map(b => b.lower);
  const allUppers = densityBins.map(b => b.upper);
  const dataMin = domainX ? domainX[0] : Math.min(...allLowers);
  const dataMax = domainX ? domainX[1] : Math.max(...allUppers);
  const maxDensity = Math.max(...densityBins.map(b => b.density), 1);

  // SVG layout
  const svgW = 520;
  const svgH = 260;
  const marginL = 60;
  const marginR = 20;
  const marginT = 20;
  const marginB = 50;
  const plotW = svgW - marginL - marginR;
  const plotH = svgH - marginT - marginB;

  const toX = (v: number) => marginL + ((v - dataMin) / (dataMax - dataMin || 1)) * plotW;
  const toY = (d: number) => marginT + plotH - (d / (maxDensity * 1.1)) * plotH;

  // Tick generation for x-axis
  const xTicks: number[] = [];
  const uniqueEdges = [...new Set([...allLowers, ...allUppers])].sort((a, b) => a - b);
  uniqueEdges.forEach(v => xTicks.push(v));

  // Y-axis ticks
  const yTickCount = 5;
  const yMax = maxDensity * 1.1;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => (yMax / yTickCount) * i);

  return (
    <div className={`w-full ${className}`}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[520px] mx-auto" role="img" aria-label="Histogram">
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line key={`yg-${i}`} x1={marginL} x2={svgW - marginR} y1={toY(t)} y2={toY(t)}
            stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="3 3" />
        ))}

        {/* Bars */}
        {densityBins.map((b, i) => {
          const x = toX(b.lower);
          const w = toX(b.upper) - toX(b.lower);
          const y = toY(b.density);
          const h = toY(0) - y;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h}
                fill="hsl(var(--primary) / 0.3)" stroke="hsl(var(--primary))" strokeWidth={1.5} />
              {/* Frequency label */}
              <text x={x + w / 2} y={y - 4} textAnchor="middle"
                className="text-[10px] fill-muted-foreground">{b.frequency}</text>
            </g>
          );
        })}

        {/* X-axis */}
        <line x1={marginL} x2={svgW - marginR} y1={toY(0)} y2={toY(0)}
          stroke="hsl(var(--foreground))" strokeWidth={1} />
        {xTicks.map((t, i) => (
          <g key={`xt-${i}`}>
            <line x1={toX(t)} x2={toX(t)} y1={toY(0)} y2={toY(0) + 5}
              stroke="hsl(var(--foreground))" strokeWidth={1} />
            <text x={toX(t)} y={toY(0) + 16} textAnchor="middle"
              className="text-[10px] fill-muted-foreground">{t}</text>
          </g>
        ))}
        {xLabel && (
          <text x={marginL + plotW / 2} y={svgH - 6} textAnchor="middle"
            className="text-[11px] fill-foreground font-medium">{xLabel}</text>
        )}

        {/* Y-axis */}
        <line x1={marginL} x2={marginL} y1={marginT} y2={toY(0)}
          stroke="hsl(var(--foreground))" strokeWidth={1} />
        {yTicks.map((t, i) => (
          <g key={`yt-${i}`}>
            <line x1={marginL - 5} x2={marginL} y1={toY(t)} y2={toY(t)}
              stroke="hsl(var(--foreground))" strokeWidth={1} />
            <text x={marginL - 8} y={toY(t) + 3} textAnchor="end"
              className="text-[10px] fill-muted-foreground">{t.toFixed(1)}</text>
          </g>
        ))}
        <text x={14} y={marginT + plotH / 2} textAnchor="middle"
          transform={`rotate(-90, 14, ${marginT + plotH / 2})`}
          className="text-[11px] fill-foreground font-medium">{yLabel || 'Frequency Density'}</text>
      </svg>
    </div>
  );
};
