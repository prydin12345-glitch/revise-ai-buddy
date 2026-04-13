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

/* ── Tooltip width helper ── */
const getTooltipWidth = (label: string): number =>
  Math.max(100, Math.min(200, label.length * 7 + 16));

/* ── Tick step helper ── */
const niceStep = (r: number) => {
  const raw = r / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm <= 1.5 ? 1 : norm <= 3.5 ? 2 : norm <= 7.5 ? 5 : 10) * mag;
};

/* ── Label collision filter ── */
const MIN_LABEL_SPACING = 30;
interface StaticLabel { key: string; value: number; label: string }

const filterLabels = (labels: StaticLabel[], toX: (v: number) => number): StaticLabel[] =>
  labels.reduce<StaticLabel[]>((acc, curr) => {
    const prevX = acc.length > 0 ? toX(acc[acc.length - 1].value) : -Infinity;
    if (toX(curr.value) - prevX < MIN_LABEL_SPACING) return acc;
    return [...acc, curr];
  }, []);

/* ═══════════════════════════════════════════
   Single Box Plot renderer (also used inside comparison)
   ═══════════════════════════════════════════ */
interface SingleBoxProps {
  data: BoxPlotData['data'];
  outliers: number[];
  toX: (v: number) => number;
  boxY: number;
  boxH: number;
  hovered: string | null;
  showLabels?: boolean;
}

const SingleBox: React.FC<SingleBoxProps> = ({ data, outliers, toX, boxY, boxH, hovered, showLabels = true }) => {
  const boxMidY = boxY + boxH / 2;
  const iqr = data.q3 - data.q1;

  const allValues = [data.min, data.q1, data.med, data.q3, data.max, ...outliers];
  const nonOutlierMin = outliers.length > 0
    ? Math.min(...[data.min, data.q1, data.med, data.q3, data.max])
    : data.min;
  const nonOutlierMax = outliers.length > 0
    ? Math.max(...[data.min, data.q1, data.med, data.q3, data.max])
    : data.max;

  const isH = (id: string) => hovered === id;
  const active = 'hsl(var(--primary))';
  const def = 'hsl(var(--foreground))';

  const staticLabels: StaticLabel[] = [
    { key: 'min', value: nonOutlierMin, label: 'Min' },
    { key: 'q1', value: data.q1, label: 'Q₁' },
    { key: 'med', value: data.med, label: 'Med' },
    { key: 'q3', value: data.q3, label: 'Q₃' },
    { key: 'max', value: nonOutlierMax, label: 'Max' },
  ];
  const spacedLabels = filterLabels(staticLabels, toX);

  return (
    <g>
      {/* Static labels above the box */}
      {showLabels && spacedLabels.map(({ key, value, label }) => (
        <g key={key}>
          <text
            x={toX(value)} y={boxY - 8}
            textAnchor="middle" fontSize={9}
            fontWeight={key === 'med' ? 600 : 400}
            fill={key === 'med' ? active : 'hsl(var(--muted-foreground))'}
          >{label}</text>
          <line
            x1={toX(value)} y1={boxY - 4} x2={toX(value)} y2={boxY}
            stroke={key === 'med' ? active : 'hsl(var(--muted-foreground))'}
            strokeWidth={0.5} opacity={0.5}
          />
        </g>
      ))}

      {/* Left whisker */}
      <line x1={toX(nonOutlierMin)} x2={toX(data.q1)} y1={boxMidY} y2={boxMidY}
        stroke={isH('min') ? active : def} strokeWidth={isH('min') ? 3 : 1.5}
        style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }} />
      <line x1={toX(nonOutlierMin)} x2={toX(nonOutlierMin)}
        y1={boxY + 6} y2={boxY + boxH - 6}
        stroke={isH('min') ? active : def} strokeWidth={isH('min') ? 3 : 1.5}
        style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }} />

      {/* Right whisker */}
      <line x1={toX(data.q3)} x2={toX(nonOutlierMax)} y1={boxMidY} y2={boxMidY}
        stroke={isH('max') ? active : def} strokeWidth={isH('max') ? 3 : 1.5}
        style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }} />
      <line x1={toX(nonOutlierMax)} x2={toX(nonOutlierMax)}
        y1={boxY + 6} y2={boxY + boxH - 6}
        stroke={isH('max') ? active : def} strokeWidth={isH('max') ? 3 : 1.5}
        style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }} />

      {/* Box (Q1→Q3) or zero-IQR line */}
      {iqr === 0 ? (
        <line x1={toX(data.q1)} y1={boxY} x2={toX(data.q1)} y2={boxY + boxH}
          stroke={active} strokeWidth={3} strokeLinecap="round" />
      ) : (
        <>
          <rect
            x={toX(data.q1)} y={boxY}
            width={toX(data.q3) - toX(data.q1)} height={boxH}
            fill={isH('iqr') ? 'hsl(var(--primary) / 0.25)' : 'hsl(var(--primary) / 0.12)'}
            stroke={isH('q1') || isH('q3') || isH('iqr') ? active : def}
            strokeWidth={isH('iqr') ? 2 : 1}
            rx={3}
            style={{ transition: 'fill 0.15s, stroke 0.15s' }}
          />
          {/* Q1 vertical */}
          <line x1={toX(data.q1)} x2={toX(data.q1)} y1={boxY} y2={boxY + boxH}
            stroke={isH('q1') ? active : def} strokeWidth={isH('q1') ? 3 : 1.5}
            style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }} />
          {/* Q3 vertical */}
          <line x1={toX(data.q3)} x2={toX(data.q3)} y1={boxY} y2={boxY + boxH}
            stroke={isH('q3') ? active : def} strokeWidth={isH('q3') ? 3 : 1.5}
            style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }} />
        </>
      )}

      {/* Median line */}
      <line x1={toX(data.med)} x2={toX(data.med)} y1={boxY} y2={boxY + boxH}
        stroke={active} strokeWidth={isH('med') ? 4 : 2.5}
        style={{ transition: 'stroke-width 0.15s' }} />

      {/* Outliers */}
      {outliers.map((o, i) => {
        const a = isH(`outlier-${i}`);
        return (
          <g key={`outlier-${i}`}>
            <line x1={toX(o) - 4} x2={toX(o) + 4} y1={boxMidY - 4} y2={boxMidY + 4}
              stroke={a ? active : 'hsl(var(--destructive))'} strokeWidth={a ? 3 : 2}
              style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }} />
            <line x1={toX(o) - 4} x2={toX(o) + 4} y1={boxMidY + 4} y2={boxMidY - 4}
              stroke={a ? active : 'hsl(var(--destructive))'} strokeWidth={a ? 3 : 2}
              style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }} />
          </g>
        );
      })}
    </g>
  );
};

/* ═══════════════════════════════════════════
   Main BoxPlotChart
   ═══════════════════════════════════════════ */
export const BoxPlotChart: React.FC<BoxPlotChartProps> = ({ chartData, className = '' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<HoverInfo | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Comparison mode ─── */
  if (chartData.type === 'boxplot_comparison') {
    const comp = chartData as BoxPlotComparisonData;
    const svgW = 520;
    const svgH = 240;
    const plotL = 80;
    const plotR = svgW - 20;
    const plotW = plotR - plotL;

    // Combined domain
    const allVals = comp.datasets.flatMap(d => [
      d.data.min, d.data.q1, d.data.med, d.data.q3, d.data.max,
      ...(d.outliers ?? []),
    ]);
    const rawMin = comp.domainX ? comp.domainX[0] : Math.min(...allVals);
    const rawMax = comp.domainX ? comp.domainX[1] : Math.max(...allVals);
    const range = rawMax - rawMin || 1;
    const pad = range * 0.1;
    const scaleMin = rawMin - pad;
    const scaleMax = rawMax + pad;
    const scaleRange = scaleMax - scaleMin;
    const toX = (v: number) => plotL + ((v - scaleMin) / scaleRange) * plotW;

    const step = niceStep(scaleRange);
    const firstTick = Math.ceil(scaleMin / step) * step;
    const ticks: number[] = [];
    for (let t = firstTick; t <= scaleMax + step * 0.01; t += step) ticks.push(parseFloat(t.toFixed(10)));

    const boxH = 36;
    const positions = comp.datasets.map((_, i) => 50 + i * 60);
    const axisY = positions[positions.length - 1] + boxH + 30;

    return (
      <div className={`bg-card border rounded-lg p-4 ${className}`}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full max-w-[520px] select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid */}
          {ticks.map((t, i) => (
            <line key={i} x1={toX(t)} x2={toX(t)} y1={positions[0] - 12} y2={axisY}
              stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="3,3" />
          ))}

          {/* Each dataset */}
          {comp.datasets.map((ds, i) => (
            <g key={i}>
              <text x={plotL - 6} y={positions[i] + boxH / 2 + 4}
                textAnchor="end" fontSize={10}
                fill="hsl(var(--muted-foreground))">
                {ds.label}
              </text>
              <SingleBox
                data={ds.data}
                outliers={ds.outliers ?? []}
                toX={toX}
                boxY={positions[i]}
                boxH={boxH}
                hovered={null}
                showLabels={i === 0}
              />
            </g>
          ))}

          {/* Shared axis */}
          <line x1={plotL} x2={plotR} y1={axisY} y2={axisY}
            stroke="hsl(var(--foreground))" strokeWidth={1} />
          {ticks.map((t, i) => (
            <g key={`tick-${i}`}>
              <line x1={toX(t)} x2={toX(t)} y1={axisY} y2={axisY + 6}
                stroke="hsl(var(--foreground))" strokeWidth={1.2} />
              <text x={toX(t)} y={axisY + 17} textAnchor="middle"
                fill="hsl(var(--foreground))" fontSize={10} fontFamily="sans-serif">
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}

          {comp.xLabel && (
            <text x={(plotL + plotR) / 2} y={svgH - 4} textAnchor="middle"
              fill="hsl(var(--muted-foreground))" fontSize={11} fontFamily="sans-serif">
              {comp.xLabel}
            </text>
          )}
        </svg>
      </div>
    );
  }

  /* ─── Single box plot ─── */
  const { data, outliers = [], xLabel, domainX } = chartData as BoxPlotData;

  const svgW = 520;
  const svgH = 180;
  const plotL = 50;
  const plotR = svgW - 20;
  const plotW = plotR - plotL;
  const boxY = 55;
  const boxH = 48;
  const axisY = boxY + boxH + 30;

  const allValues = [data.min, data.q1, data.med, data.q3, data.max, ...outliers];
  const rawMin = domainX ? domainX[0] : Math.min(...allValues);
  const rawMax = domainX ? domainX[1] : Math.max(...allValues);
  const range = rawMax - rawMin || 1;
  const pad = range * 0.1;
  const scaleMin = rawMin - pad;
  const scaleMax = rawMax + pad;
  const scaleRange = scaleMax - scaleMin;

  const toX = (v: number) => plotL + ((v - scaleMin) / scaleRange) * plotW;

  const step = niceStep(scaleRange);
  const firstTick = Math.ceil(scaleMin / step) * step;
  const ticks: number[] = [];
  for (let t = firstTick; t <= scaleMax + step * 0.01; t += step) ticks.push(parseFloat(t.toFixed(10)));

  const iqr = data.q3 - data.q1;
  const nonOutlierMin = Math.min(data.min, data.q1, data.med, data.q3, data.max);
  const nonOutlierMax = Math.max(data.min, data.q1, data.med, data.q3, data.max);

  const hitZones = [
    { id: 'min', label: 'Minimum', value: nonOutlierMin, xVal: nonOutlierMin },
    { id: 'q1', label: 'Lower Quartile (Q₁)', value: data.q1, xVal: data.q1 },
    { id: 'med', label: 'Median (Q₂)', value: data.med, xVal: data.med },
    { id: 'q3', label: 'Upper Quartile (Q₃)', value: data.q3, xVal: data.q3 },
    { id: 'max', label: 'Maximum', value: nonOutlierMax, xVal: nonOutlierMax },
    ...outliers.map((o, i) => ({ id: `outlier-${i}`, label: 'Outlier', value: o, xVal: o })),
  ];

  /* ── shared interaction logic ── */
  const handleSvgInteraction = useCallback((svgX: number) => {
    if (svgX < plotL || svgX > plotR) {
      setTooltip(null);
      setHovered(null);
      return;
    }

    let closest: (typeof hitZones)[0] | null = null;
    let closestDist = 14;
    for (const zone of hitZones) {
      const dist = Math.abs(svgX - toX(zone.xVal));
      if (dist < closestDist) { closestDist = dist; closest = zone; }
    }

    const q1x = toX(data.q1);
    const q3x = toX(data.q3);
    if (!closest && svgX >= q1x && svgX <= q3x) {
      setHovered('iqr');
      setTooltip({ label: 'Interquartile Range (IQR)', value: iqr, svgX: (q1x + q3x) / 2, svgY: boxY - 12 });
      return;
    }

    if (closest) {
      setHovered(closest.id);
      setTooltip({ label: closest.label, value: closest.value, svgX: toX(closest.xVal), svgY: boxY - 12 });
    } else {
      setHovered(null);
      setTooltip(null);
    }
  }, [data, outliers, iqr]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (svgW / rect.width);
    handleSvgInteraction(svgX);
  }, [handleSvgInteraction]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHovered(null);
  }, []);

  const handleTouch = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = (touch.clientX - rect.left) * (svgW / rect.width);
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    handleSvgInteraction(svgX);
  }, [handleSvgInteraction]);

  const handleTouchEnd = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltip(null);
      setHovered(null);
    }, 1500);
  }, []);

  /* ── Tooltip rendering helpers ── */
  const renderTooltip = () => {
    if (!tooltip) return null;
    const tw = getTooltipWidth(tooltip.label);
    const cx = Math.max(plotL, Math.min(tooltip.svgX - tw / 2, plotR - tw));
    return (
      <g>
        <rect x={cx} y={tooltip.svgY - 30} width={tw} height={28} rx={4}
          fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.5}
          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))" />
        <text x={cx + tw / 2} y={tooltip.svgY - 19} textAnchor="middle"
          fill="hsl(var(--popover-foreground))" fontSize={9} fontFamily="sans-serif" fontWeight={600}>
          {tooltip.label}
        </text>
        <text x={cx + tw / 2} y={tooltip.svgY - 8} textAnchor="middle"
          fill="hsl(var(--primary))" fontSize={10} fontFamily="sans-serif" fontWeight={700}>
          {tooltip.value % 1 === 0 ? tooltip.value : tooltip.value.toFixed(2)}
        </text>
      </g>
    );
  };

  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full max-w-[520px] select-none"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
      >
        {/* Grid lines */}
        {ticks.map((t, i) => (
          <line key={i} x1={toX(t)} x2={toX(t)} y1={boxY - 12} y2={axisY}
            stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="3,3" />
        ))}

        {/* The box plot */}
        <SingleBox
          data={data}
          outliers={outliers}
          toX={toX}
          boxY={boxY}
          boxH={boxH}
          hovered={hovered}
          showLabels
        />

        {/* Axis */}
        <line x1={plotL} x2={plotR} y1={axisY} y2={axisY}
          stroke="hsl(var(--foreground))" strokeWidth={1} />
        {ticks.map((t, i) => (
          <g key={`tick-${i}`}>
            <line x1={toX(t)} x2={toX(t)} y1={axisY} y2={axisY + 6}
              stroke="hsl(var(--foreground))" strokeWidth={1.2} />
            <text x={toX(t)} y={axisY + 17} textAnchor="middle"
              fill="hsl(var(--foreground))" fontSize={10} fontFamily="sans-serif">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}

        {xLabel && (
          <text x={(plotL + plotR) / 2} y={svgH - 4} textAnchor="middle"
            fill="hsl(var(--muted-foreground))" fontSize={11} fontFamily="sans-serif">
            {xLabel}
          </text>
        )}

        {/* Tooltip */}
        {renderTooltip()}
      </svg>

      {/* Interaction hints */}
      <p className="block md:hidden text-center text-[11px] text-muted-foreground mt-1">
        Tap the chart to see values
      </p>
      <p className="hidden md:block text-center text-[11px] text-muted-foreground mt-1">
        Hover over the chart to see values
      </p>
    </div>
  );
};

/* ── Detection helper ── */
export const isBoxPlotQuestion = (options: any): boolean => {
  if (!options || typeof options !== 'object') return false;
  if (options.type === 'boxplot' && options.data && typeof options.data.q1 === 'number') return true;
  if (options.type === 'boxplot_comparison' && Array.isArray(options.datasets) &&
      options.datasets.length >= 2 && options.datasets[0]?.data?.q1 !== undefined) return true;
  return false;
};
