import React, { useState, useRef, useCallback } from 'react';

export interface BoxPlotData {
  type: 'boxplot';
  data: { min: number; q1: number; med: number; q3: number; max: number };
  outliers?: number[];
  xLabel?: string;
  unit?: string;
  domainX?: [number, number];
}

export interface BoxPlotComparisonData {
  type: 'boxplot_comparison';
  datasets: Array<{ label: string; data: BoxPlotData['data']; outliers?: number[] }>;
  xLabel?: string;
  domainX?: [number, number];
}

interface BoxPlotChartProps {
  chartData: BoxPlotData | BoxPlotComparisonData;
  className?: string;
}

interface HoverInfo { label: string; value: number; svgX: number; svgY: number }
interface StaticLabel { key: string; value: number; label: string }

const getTooltipWidth = (l: string) => Math.max(100, Math.min(200, l.length * 7 + 16));

const niceStep = (r: number) => {
  const raw = r / 6, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  return (n <= 1.5 ? 1 : n <= 3.5 ? 2 : n <= 7.5 ? 5 : 10) * mag;
};

const MIN_LABEL_SPACING = 30;
const filterLabels = (labels: StaticLabel[], toX: (v: number) => number) =>
  labels.reduce<StaticLabel[]>((acc, c) => {
    const prev = acc.length ? toX(acc[acc.length - 1].value) : -Infinity;
    return toX(c.value) - prev < MIN_LABEL_SPACING ? acc : [...acc, c];
  }, []);

const makeTicks = (scaleMin: number, scaleMax: number, scaleRange: number) => {
  const step = niceStep(scaleRange);
  const first = Math.ceil(scaleMin / step) * step;
  const t: number[] = [];
  for (let v = first; v <= scaleMax + step * 0.01; v += step) t.push(parseFloat(v.toFixed(10)));
  return t;
};

/* ── SingleBoxRow: renders one box + whiskers + outliers ── */
const SingleBoxRow: React.FC<{
  data: BoxPlotData['data']; outliers: number[]; toX: (v: number) => number;
  boxY: number; boxH: number; hovered: string | null; showLabels?: boolean;
}> = ({ data, outliers, toX, boxY, boxH, hovered, showLabels = true }) => {
  const mid = boxY + boxH / 2;
  const iqr = data.q3 - data.q1;
  const nMin = Math.min(data.min, data.q1, data.med, data.q3, data.max);
  const nMax = Math.max(data.min, data.q1, data.med, data.q3, data.max);
  const is = (id: string) => hovered === id;
  const ac = 'hsl(var(--primary))', df = 'hsl(var(--foreground))';
  const tr = { transition: 'stroke-width 0.15s, stroke 0.15s' } as const;

  const labels = filterLabels([
    { key: 'min', value: nMin, label: 'Min' }, { key: 'q1', value: data.q1, label: 'Q₁' },
    { key: 'med', value: data.med, label: 'Med' }, { key: 'q3', value: data.q3, label: 'Q₃' },
    { key: 'max', value: nMax, label: 'Max' },
  ], toX);

  return (
    <g>
      {showLabels && labels.map(({ key, value, label }) => (
        <g key={key}>
          <text x={toX(value)} y={boxY - 8} textAnchor="middle" fontSize={9}
            fontWeight={key === 'med' ? 600 : 400}
            fill={key === 'med' ? ac : 'hsl(var(--muted-foreground))'}>{label}</text>
          <line x1={toX(value)} y1={boxY - 4} x2={toX(value)} y2={boxY}
            stroke={key === 'med' ? ac : 'hsl(var(--muted-foreground))'} strokeWidth={0.5} opacity={0.5} />
        </g>
      ))}
      {/* whiskers */}
      <line x1={toX(nMin)} x2={toX(data.q1)} y1={mid} y2={mid} stroke={is('min') ? ac : df} strokeWidth={is('min') ? 3 : 1.5} style={tr} />
      <line x1={toX(nMin)} x2={toX(nMin)} y1={boxY + 6} y2={boxY + boxH - 6} stroke={is('min') ? ac : df} strokeWidth={is('min') ? 3 : 1.5} style={tr} />
      <line x1={toX(data.q3)} x2={toX(nMax)} y1={mid} y2={mid} stroke={is('max') ? ac : df} strokeWidth={is('max') ? 3 : 1.5} style={tr} />
      <line x1={toX(nMax)} x2={toX(nMax)} y1={boxY + 6} y2={boxY + boxH - 6} stroke={is('max') ? ac : df} strokeWidth={is('max') ? 3 : 1.5} style={tr} />
      {/* box */}
      {iqr === 0 ? (
        <line x1={toX(data.q1)} y1={boxY} x2={toX(data.q1)} y2={boxY + boxH} stroke={ac} strokeWidth={3} strokeLinecap="round" />
      ) : (
        <>
          <rect x={toX(data.q1)} y={boxY} width={toX(data.q3) - toX(data.q1)} height={boxH}
            fill={is('iqr') ? 'hsl(var(--primary) / 0.25)' : 'hsl(var(--primary) / 0.12)'}
            stroke={is('q1') || is('q3') || is('iqr') ? ac : df}
            strokeWidth={is('iqr') ? 2 : 1} rx={3} style={{ transition: 'fill 0.15s, stroke 0.15s' }} />
          <line x1={toX(data.q1)} x2={toX(data.q1)} y1={boxY} y2={boxY + boxH} stroke={is('q1') ? ac : df} strokeWidth={is('q1') ? 3 : 1.5} style={tr} />
          <line x1={toX(data.q3)} x2={toX(data.q3)} y1={boxY} y2={boxY + boxH} stroke={is('q3') ? ac : df} strokeWidth={is('q3') ? 3 : 1.5} style={tr} />
        </>
      )}
      {/* median */}
      <line x1={toX(data.med)} x2={toX(data.med)} y1={boxY} y2={boxY + boxH} stroke={ac} strokeWidth={is('med') ? 4 : 2.5} style={{ transition: 'stroke-width 0.15s' }} />
      {/* outliers */}
      {outliers.map((o, i) => {
        const a = is(`outlier-${i}`);
        return (
          <g key={`o${i}`}>
            <line x1={toX(o) - 4} x2={toX(o) + 4} y1={mid - 4} y2={mid + 4} stroke={a ? ac : 'hsl(var(--destructive))'} strokeWidth={a ? 3 : 2} style={tr} />
            <line x1={toX(o) - 4} x2={toX(o) + 4} y1={mid + 4} y2={mid - 4} stroke={a ? ac : 'hsl(var(--destructive))'} strokeWidth={a ? 3 : 2} style={tr} />
          </g>
        );
      })}
    </g>
  );
};

/* ── Comparison chart ── */
const ComparisonChart: React.FC<{ chartData: BoxPlotComparisonData; className: string }> = ({ chartData: comp, className }) => {
  const boxH = 36;
  const svgW = 520;
  const plotL = 80, plotR = svgW - 20, plotW = plotR - plotL;
  const positions = comp.datasets.map((_, i) => 50 + i * 60);
  const axisY = positions[positions.length - 1] + boxH + 30;
  const svgH = axisY + 40;

  const allVals = comp.datasets.flatMap(d => [d.data.min, d.data.q1, d.data.med, d.data.q3, d.data.max, ...(d.outliers ?? [])]);
  const rMin = comp.domainX?.[0] ?? Math.min(...allVals);
  const rMax = comp.domainX?.[1] ?? Math.max(...allVals);
  const rng = rMax - rMin || 1, pad = rng * 0.1;
  const sMin = rMin - pad, sMax = rMax + pad, sRng = sMax - sMin;
  const toX = (v: number) => plotL + ((v - sMin) / sRng) * plotW;
  const ticks = makeTicks(sMin, sMax, sRng);

  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[520px] select-none" preserveAspectRatio="xMidYMid meet">
        {ticks.map((t, i) => <line key={i} x1={toX(t)} x2={toX(t)} y1={positions[0] - 12} y2={axisY} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="3,3" />)}
        {comp.datasets.map((ds, i) => (
          <g key={i}>
            <text x={plotL - 6} y={positions[i] + boxH / 2 + 4} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">{ds.label}</text>
            <SingleBoxRow data={ds.data} outliers={ds.outliers ?? []} toX={toX} boxY={positions[i]} boxH={boxH} hovered={null} showLabels={i === 0} />
          </g>
        ))}
        <line x1={plotL} x2={plotR} y1={axisY} y2={axisY} stroke="hsl(var(--foreground))" strokeWidth={1} />
        {ticks.map((t, i) => (
          <g key={`t${i}`}>
            <line x1={toX(t)} x2={toX(t)} y1={axisY} y2={axisY + 6} stroke="hsl(var(--foreground))" strokeWidth={1.2} />
            <text x={toX(t)} y={axisY + 17} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={10}>{Number.isInteger(t) ? t : t.toFixed(1)}</text>
          </g>
        ))}
        {comp.xLabel && <text x={(plotL + plotR) / 2} y={svgH - 4} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11}>{comp.xLabel}</text>}
      </svg>
    </div>
  );
};

/* ═══════ Main BoxPlotChart ═══════ */
export const BoxPlotChart: React.FC<BoxPlotChartProps> = ({ chartData, className = '' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<HoverInfo | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // All hooks are above — safe to branch now
  if (chartData.type === 'boxplot_comparison') {
    return <ComparisonChart chartData={chartData as BoxPlotComparisonData} className={className} />;
  }

  const { data, outliers = [], xLabel, domainX } = chartData as BoxPlotData;
  const svgW = 520, svgH = 180, plotL = 50, plotR = svgW - 20, plotW = plotR - plotL;
  const boxY = 55, boxH = 48, axisY = boxY + boxH + 30;

  const allV = [data.min, data.q1, data.med, data.q3, data.max, ...outliers];
  const rMin = domainX?.[0] ?? Math.min(...allV), rMax = domainX?.[1] ?? Math.max(...allV);
  const rng = rMax - rMin || 1, pad = rng * 0.1;
  const sMin = rMin - pad, sMax = rMax + pad, sRng = sMax - sMin;
  const toX = (v: number) => plotL + ((v - sMin) / sRng) * plotW;
  const ticks = makeTicks(sMin, sMax, sRng);
  const iqr = data.q3 - data.q1;
  const nMin = Math.min(data.min, data.q1, data.med, data.q3, data.max);
  const nMax = Math.max(data.min, data.q1, data.med, data.q3, data.max);

  const hitZones = [
    { id: 'min', label: 'Minimum', value: nMin, xVal: nMin },
    { id: 'q1', label: 'Lower Quartile (Q₁)', value: data.q1, xVal: data.q1 },
    { id: 'med', label: 'Median (Q₂)', value: data.med, xVal: data.med },
    { id: 'q3', label: 'Upper Quartile (Q₃)', value: data.q3, xVal: data.q3 },
    { id: 'max', label: 'Maximum', value: nMax, xVal: nMax },
    ...outliers.map((o, i) => ({ id: `outlier-${i}`, label: 'Outlier', value: o, xVal: o })),
  ];

  const interact = (svgX: number) => {
    if (svgX < plotL || svgX > plotR) { setTooltip(null); setHovered(null); return; }
    let closest: (typeof hitZones)[0] | null = null, best = 14;
    for (const z of hitZones) { const d = Math.abs(svgX - toX(z.xVal)); if (d < best) { best = d; closest = z; } }
    if (!closest && svgX >= toX(data.q1) && svgX <= toX(data.q3)) {
      setHovered('iqr'); setTooltip({ label: 'Interquartile Range (IQR)', value: iqr, svgX: (toX(data.q1) + toX(data.q3)) / 2, svgY: boxY - 12 }); return;
    }
    if (closest) { setHovered(closest.id); setTooltip({ label: closest.label, value: closest.value, svgX: toX(closest.xVal), svgY: boxY - 12 }); }
    else { setHovered(null); setTooltip(null); }
  };

  const onMouse = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = svgRef.current?.getBoundingClientRect(); if (!r) return;
    interact((e.clientX - r.left) * (svgW / r.width));
  };
  const onTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault(); const t = e.touches[0]; if (!t) return;
    const r = svgRef.current?.getBoundingClientRect(); if (!r) return;
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    interact((t.clientX - r.left) * (svgW / r.width));
  };
  const onTouchEnd = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => { setTooltip(null); setHovered(null); }, 1500);
  };

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
          fill="hsl(var(--popover-foreground))" fontSize={9} fontWeight={600}>{tooltip.label}</text>
        <text x={cx + tw / 2} y={tooltip.svgY - 8} textAnchor="middle"
          fill="hsl(var(--primary))" fontSize={10} fontWeight={700}>
          {tooltip.value % 1 === 0 ? tooltip.value : tooltip.value.toFixed(2)}
        </text>
      </g>
    );
  };

  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[520px] select-none"
        preserveAspectRatio="xMidYMid meet" onMouseMove={onMouse} onMouseLeave={() => { setTooltip(null); setHovered(null); }}
        onTouchStart={onTouch} onTouchMove={onTouch} onTouchEnd={onTouchEnd} style={{ touchAction: 'none' }}>
        {ticks.map((t, i) => <line key={i} x1={toX(t)} x2={toX(t)} y1={boxY - 12} y2={axisY} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="3,3" />)}
        <SingleBoxRow data={data} outliers={outliers} toX={toX} boxY={boxY} boxH={boxH} hovered={hovered} showLabels />
        <line x1={plotL} x2={plotR} y1={axisY} y2={axisY} stroke="hsl(var(--foreground))" strokeWidth={1} />
        {ticks.map((t, i) => (
          <g key={`t${i}`}>
            <line x1={toX(t)} x2={toX(t)} y1={axisY} y2={axisY + 6} stroke="hsl(var(--foreground))" strokeWidth={1.2} />
            <text x={toX(t)} y={axisY + 17} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={10}>{Number.isInteger(t) ? t : t.toFixed(1)}</text>
          </g>
        ))}
        {xLabel && <text x={(plotL + plotR) / 2} y={svgH - 4} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11}>{xLabel}</text>}
        {renderTooltip()}
      </svg>
      <p className="block md:hidden text-center text-[11px] text-muted-foreground mt-1">Tap the chart to see values</p>
      <p className="hidden md:block text-center text-[11px] text-muted-foreground mt-1">Hover over the chart to see values</p>
    </div>
  );
};

export const isBoxPlotQuestion = (options: any): boolean => {
  if (!options || typeof options !== 'object') return false;
  if (options.type === 'boxplot' && options.data && typeof options.data.q1 === 'number') return true;
  if (options.type === 'boxplot_comparison' && Array.isArray(options.datasets) && options.datasets.length >= 2 && options.datasets[0]?.data?.q1 !== undefined) return true;
  return false;
};
