import React, { useState, useRef, useCallback } from 'react';

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

export interface BoxPlotComparisonData {
  type: 'boxplot_comparison';
  datasets: Array<{
    label: string;
    data: BoxPlotData['data'];
    outliers?: number[];
  }>;
  xLabel?: string;
  domainX?: [number, number];
}

interface BoxPlotChartProps {
  chartData: BoxPlotData | BoxPlotComparisonData;
  className?: string;
}

interface HoverInfo {
  label: string;
  value: number;
  svgX: number;
  svgY: number;
}

export const BoxPlotChart: React.FC<BoxPlotChartProps> = ({ chartData, className = '' }) => {
  const { data, outliers = [], xLabel, domainX } = chartData;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<HoverInfo | null>(null);

  // Compute drawing domain
  const allValues = [data.min, data.q1, data.med, data.q3, data.max, ...outliers];
  const rawMin = domainX ? domainX[0] : Math.min(...allValues);
  const rawMax = domainX ? domainX[1] : Math.max(...allValues);
  const range = rawMax - rawMin || 1;
  const padded = range * 0.1;
  const scaleMin = rawMin - padded;
  const scaleMax = rawMax + padded;
  const scaleRange = scaleMax - scaleMin;

  // SVG layout
  const svgW = 520;
  const svgH = 150;
  const plotL = 50;
  const plotR = svgW - 20;
  const plotW = plotR - plotL;
  const boxY = 35;
  const boxH = 44;
  const axisY = boxY + boxH + 28;

  const toX = (v: number) => plotL + ((v - scaleMin) / scaleRange) * plotW;
  const fromX = (px: number) => scaleMin + ((px - plotL) / plotW) * scaleRange;

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

  // Non-outlier whisker endpoints
  const nonOutlierMin = outliers.length > 0 ? Math.min(...allValues.filter(v => !outliers.includes(v))) : data.min;
  const nonOutlierMax = outliers.length > 0 ? Math.max(...allValues.filter(v => !outliers.includes(v))) : data.max;

  const boxMidY = boxY + boxH / 2;
  const iqr = data.q3 - data.q1;

  // Hit zones for hover detection
  const hitZones: Array<{ id: string; label: string; value: number; xVal: number }> = [
    { id: 'min', label: 'Minimum', value: nonOutlierMin, xVal: nonOutlierMin },
    { id: 'q1', label: 'Lower Quartile (Q₁)', value: data.q1, xVal: data.q1 },
    { id: 'med', label: 'Median (Q₂)', value: data.med, xVal: data.med },
    { id: 'q3', label: 'Upper Quartile (Q₃)', value: data.q3, xVal: data.q3 },
    { id: 'max', label: 'Maximum', value: nonOutlierMax, xVal: nonOutlierMax },
    ...outliers.map((o, i) => ({ id: `outlier-${i}`, label: 'Outlier', value: o, xVal: o })),
  ];

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleFactorX = svgW / rect.width;
    const svgX = (e.clientX - rect.left) * scaleFactorX;
    const svgY = (e.clientY - rect.top) * (svgH / rect.height);

    if (svgX < plotL || svgX > plotR) {
      setMouseX(null);
      setTooltip(null);
      setHovered(null);
      return;
    }

    setMouseX(svgX);

    // Find closest hit zone (within 12px)
    let closest: (typeof hitZones)[0] | null = null;
    let closestDist = 12;
    for (const zone of hitZones) {
      const zx = toX(zone.xVal);
      const dist = Math.abs(svgX - zx);
      if (dist < closestDist) {
        closestDist = dist;
        closest = zone;
      }
    }

    // Also check IQR region (between Q1 and Q3 box area)
    const q1x = toX(data.q1);
    const q3x = toX(data.q3);
    if (!closest && svgX >= q1x && svgX <= q3x && svgY >= boxY && svgY <= boxY + boxH) {
      setHovered('iqr');
      setTooltip({ label: 'Interquartile Range (IQR)', value: iqr, svgX: (q1x + q3x) / 2, svgY: boxY - 8 });
      return;
    }

    if (closest) {
      setHovered(closest.id);
      setTooltip({ label: closest.label, value: closest.value, svgX: toX(closest.xVal), svgY: boxY - 8 });
    } else {
      setHovered(null);
      setTooltip(null);
    }
  }, [data, outliers, iqr]);

  const handleMouseLeave = useCallback(() => {
    setMouseX(null);
    setTooltip(null);
    setHovered(null);
  }, []);

  const isHovered = (id: string) => hovered === id;
  const activeStroke = 'hsl(var(--primary))';
  const defaultStroke = 'hsl(var(--foreground))';
  const hoverWidth = 3;
  const defaultWidth = 1.5;

  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full max-w-[520px] select-none"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        {ticks.map((t, i) => (
          <line key={i} x1={toX(t)} x2={toX(t)} y1={boxY - 8} y2={axisY}
            stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="3,3" />
        ))}

        {/* Vertical guide line following cursor */}
        {mouseX !== null && (
          <g>
            <line x1={mouseX} x2={mouseX} y1={boxY - 10} y2={axisY + 4}
              stroke="hsl(var(--primary) / 0.3)" strokeWidth={1} strokeDasharray="4,3" />
            <text x={mouseX} y={axisY + 26} textAnchor="middle"
              fill="hsl(var(--primary))" fontSize="9" fontFamily="sans-serif" fontWeight="500">
              {fromX(mouseX).toFixed(1)}
            </text>
          </g>
        )}

        {/* Left whisker */}
        <line
          x1={toX(nonOutlierMin)} x2={toX(data.q1)} y1={boxMidY} y2={boxMidY}
          stroke={isHovered('min') ? activeStroke : defaultStroke}
          strokeWidth={isHovered('min') ? hoverWidth : defaultWidth}
          style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
        />
        <line
          x1={toX(nonOutlierMin)} x2={toX(nonOutlierMin)}
          y1={boxY + 6} y2={boxY + boxH - 6}
          stroke={isHovered('min') ? activeStroke : defaultStroke}
          strokeWidth={isHovered('min') ? hoverWidth : defaultWidth}
          style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
        />

        {/* Right whisker */}
        <line
          x1={toX(data.q3)} x2={toX(nonOutlierMax)} y1={boxMidY} y2={boxMidY}
          stroke={isHovered('max') ? activeStroke : defaultStroke}
          strokeWidth={isHovered('max') ? hoverWidth : defaultWidth}
          style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
        />
        <line
          x1={toX(nonOutlierMax)} x2={toX(nonOutlierMax)}
          y1={boxY + 6} y2={boxY + boxH - 6}
          stroke={isHovered('max') ? activeStroke : defaultStroke}
          strokeWidth={isHovered('max') ? hoverWidth : defaultWidth}
          style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
        />

        {/* Box (Q1 to Q3) */}
        <rect
          x={toX(data.q1)} y={boxY}
          width={toX(data.q3) - toX(data.q1)} height={boxH}
          fill={isHovered('iqr') ? 'hsl(var(--primary) / 0.25)' : 'hsl(var(--primary) / 0.12)'}
          stroke={isHovered('q1') || isHovered('q3') || isHovered('iqr') ? activeStroke : defaultStroke}
          strokeWidth={isHovered('iqr') ? hoverWidth : defaultWidth}
          rx={3}
          style={{ transition: 'fill 0.15s, stroke 0.15s' }}
        />

        {/* Q1 line */}
        <line
          x1={toX(data.q1)} x2={toX(data.q1)} y1={boxY} y2={boxY + boxH}
          stroke={isHovered('q1') ? activeStroke : defaultStroke}
          strokeWidth={isHovered('q1') ? hoverWidth : defaultWidth}
          style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
        />

        {/* Q3 line */}
        <line
          x1={toX(data.q3)} x2={toX(data.q3)} y1={boxY} y2={boxY + boxH}
          stroke={isHovered('q3') ? activeStroke : defaultStroke}
          strokeWidth={isHovered('q3') ? hoverWidth : defaultWidth}
          style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
        />

        {/* Median line */}
        <line
          x1={toX(data.med)} x2={toX(data.med)} y1={boxY} y2={boxY + boxH}
          stroke={isHovered('med') ? activeStroke : 'hsl(var(--primary))'}
          strokeWidth={isHovered('med') ? 4 : 2.5}
          style={{ transition: 'stroke-width 0.15s' }}
        />

        {/* Outliers */}
        {outliers.map((o, i) => {
          const active = isHovered(`outlier-${i}`);
          return (
            <g key={`outlier-${i}`}>
              <line x1={toX(o) - 4} x2={toX(o) + 4} y1={boxMidY - 4} y2={boxMidY + 4}
                stroke={active ? activeStroke : 'hsl(var(--destructive))'}
                strokeWidth={active ? 3 : 2}
                style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
              />
              <line x1={toX(o) - 4} x2={toX(o) + 4} y1={boxMidY + 4} y2={boxMidY - 4}
                stroke={active ? activeStroke : 'hsl(var(--destructive))'}
                strokeWidth={active ? 3 : 2}
                style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
              />
            </g>
          );
        })}

        {/* Axis */}
        <line x1={plotL} x2={plotR} y1={axisY} y2={axisY}
          stroke="hsl(var(--foreground))" strokeWidth={1} />
        {ticks.map((t, i) => (
          <g key={`tick-${i}`}>
            <line x1={toX(t)} x2={toX(t)} y1={axisY} y2={axisY + 6}
              stroke="hsl(var(--foreground))" strokeWidth={1.2} />
            <text x={toX(t)} y={axisY + 17} textAnchor="middle"
              fill="hsl(var(--foreground))" fontSize="10" fontFamily="sans-serif">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Axis label */}
        {xLabel && (
          <text x={(plotL + plotR) / 2} y={svgH - 2} textAnchor="middle"
            fill="hsl(var(--muted-foreground))" fontSize="11" fontFamily="sans-serif">
            {xLabel}
          </text>
        )}

        {/* Tooltip */}
        {tooltip && (
          <g>
            {/* Background pill */}
            <rect
              x={Math.max(plotL, Math.min(tooltip.svgX - 60, plotR - 120))}
              y={tooltip.svgY - 28}
              width={120} height={26} rx={6}
              fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={1}
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
            />
            <text
              x={Math.max(plotL + 60, Math.min(tooltip.svgX, plotR - 60))}
              y={tooltip.svgY - 18}
              textAnchor="middle" fill="hsl(var(--popover-foreground))"
              fontSize="10" fontFamily="sans-serif" fontWeight="600"
            >
              {tooltip.label}
            </text>
            <text
              x={Math.max(plotL + 60, Math.min(tooltip.svgX, plotR - 60))}
              y={tooltip.svgY - 8}
              textAnchor="middle" fill="hsl(var(--primary))"
              fontSize="11" fontFamily="sans-serif" fontWeight="700"
            >
              {tooltip.value % 1 === 0 ? tooltip.value : tooltip.value.toFixed(2)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export const isBoxPlotQuestion = (options: any): options is BoxPlotData => {
  if (!options || typeof options !== 'object') return false;
  return options.type === 'boxplot' && options.data && typeof options.data.q1 === 'number';
};
