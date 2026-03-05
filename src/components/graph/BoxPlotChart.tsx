import React from 'react';

export interface BoxPlotData {
  type: 'boxplot';
  data: {
    min: number;
    q1: number;
    med: number;
    q3: number;
    max: number;
  };
  outliers?: number[];
  xLabel?: string;
  unit?: string;
  domainX?: [number, number];
}

interface BoxPlotChartProps {
  chartData: BoxPlotData;
  className?: string;
}

export const BoxPlotChart: React.FC<BoxPlotChartProps> = ({ chartData, className = '' }) => {
  const { data, outliers = [], xLabel, domainX } = chartData;

  // Compute drawing domain
  const allValues = [data.min, data.q1, data.med, data.q3, data.max, ...outliers];
  const rawMin = domainX ? domainX[0] : Math.min(...allValues);
  const rawMax = domainX ? domainX[1] : Math.max(...allValues);
  const range = rawMax - rawMin || 1;
  const padded = range * 0.08;
  const scaleMin = rawMin - padded;
  const scaleMax = rawMax + padded;
  const scaleRange = scaleMax - scaleMin;

  // SVG layout
  const svgW = 520;
  const svgH = 140;
  const plotL = 50;
  const plotR = svgW - 20;
  const plotW = plotR - plotL;
  const boxY = 35;
  const boxH = 40;
  const axisY = boxY + boxH + 25;

  const toX = (v: number) => plotL + ((v - scaleMin) / scaleRange) * plotW;

  // Tick generation
  const niceStep = (r: number) => {
    const raw = r / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    return (norm <= 1.5 ? 1 : norm <= 3.5 ? 2 : norm <= 7.5 ? 5 : 10) * mag;
  };
  const step = niceStep(scaleRange);
  const firstTick = Math.ceil(scaleMin / step) * step;
  const ticks: number[] = [];
  for (let t = firstTick; t <= scaleMax + step * 0.01; t += step) ticks.push(parseFloat(t.toFixed(10)));

  // Whisker endpoints (exclude outliers)
  const whiskerMin = outliers.length > 0 ? Math.max(data.min, ...outliers.filter(o => o < data.q1).map(() => data.q1)) : data.min;
  const actualWhiskerMin = outliers.some(o => o <= data.min) 
    ? Math.min(...allValues.filter(v => v > Math.max(...outliers.filter(o => o < data.q1)))) 
    : data.min;
  // Simpler: whiskers go to min/max of non-outlier data
  const nonOutlierMin = outliers.length > 0 ? Math.min(...allValues.filter(v => !outliers.includes(v))) : data.min;
  const nonOutlierMax = outliers.length > 0 ? Math.max(...allValues.filter(v => !outliers.includes(v))) : data.max;

  const boxMidY = boxY + boxH / 2;

  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[520px]" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {ticks.map((t, i) => (
          <line key={i} x1={toX(t)} x2={toX(t)} y1={boxY - 8} y2={axisY} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="3,3" />
        ))}

        {/* Left whisker */}
        <line x1={toX(nonOutlierMin)} x2={toX(data.q1)} y1={boxMidY} y2={boxMidY} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
        <line x1={toX(nonOutlierMin)} x2={toX(nonOutlierMin)} y1={boxY + 8} y2={boxY + boxH - 8} stroke="hsl(var(--foreground))" strokeWidth={1.5} />

        {/* Right whisker */}
        <line x1={toX(data.q3)} x2={toX(nonOutlierMax)} y1={boxMidY} y2={boxMidY} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
        <line x1={toX(nonOutlierMax)} x2={toX(nonOutlierMax)} y1={boxY + 8} y2={boxY + boxH - 8} stroke="hsl(var(--foreground))" strokeWidth={1.5} />

        {/* Box (Q1 to Q3) */}
        <rect
          x={toX(data.q1)}
          y={boxY}
          width={toX(data.q3) - toX(data.q1)}
          height={boxH}
          fill="hsl(var(--primary) / 0.15)"
          stroke="hsl(var(--foreground))"
          strokeWidth={1.5}
          rx={2}
        />

        {/* Median line */}
        <line x1={toX(data.med)} x2={toX(data.med)} y1={boxY} y2={boxY + boxH} stroke="hsl(var(--primary))" strokeWidth={2.5} />

        {/* Outliers */}
        {outliers.map((o, i) => (
          <g key={`outlier-${i}`}>
            <line x1={toX(o) - 4} x2={toX(o) + 4} y1={boxMidY - 4} y2={boxMidY + 4} stroke="hsl(var(--destructive))" strokeWidth={2} />
            <line x1={toX(o) - 4} x2={toX(o) + 4} y1={boxMidY + 4} y2={boxMidY - 4} stroke="hsl(var(--destructive))" strokeWidth={2} />
          </g>
        ))}

        {/* Axis */}
        <line x1={plotL} x2={plotR} y1={axisY} y2={axisY} stroke="hsl(var(--foreground))" strokeWidth={1} />
        {ticks.map((t, i) => (
          <g key={`tick-${i}`}>
            <line x1={toX(t)} x2={toX(t)} y1={axisY} y2={axisY + 5} stroke="hsl(var(--foreground))" strokeWidth={1} />
            <text x={toX(t)} y={axisY + 16} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="10" fontFamily="sans-serif">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Axis label */}
        {xLabel && (
          <text x={(plotL + plotR) / 2} y={svgH - 2} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontFamily="sans-serif">
            {xLabel}
          </text>
        )}
      </svg>
    </div>
  );
};

export const isBoxPlotQuestion = (options: any): options is BoxPlotData => {
  if (!options || typeof options !== 'object') return false;
  return options.type === 'boxplot' && options.data && typeof options.data.q1 === 'number';
};
