import type { BreakEvenConfig } from '../types';

interface Props { config: BreakEvenConfig; }

export const BreakEvenDiagram = ({ config }: Props) => {
  const {
    fixedCosts = 50000,
    sellingPrice = 20,
    variableUnitCost = 10,
    breakEvenQuantity,
    showMarginOfSafety,
    currentOutput,
    currency = '£',
    outputLabel = 'Output (units)',
  } = config;

  const beQ = breakEvenQuantity ??
    (sellingPrice > variableUnitCost ? fixedCosts / (sellingPrice - variableUnitCost) : 0);

  const svgW = 480;
  const svgH = showMarginOfSafety ? 440 : 380;
  const marginL = 75;
  const marginB = showMarginOfSafety ? 110 : 60;
  const marginT = 40;
  const marginR = 50;
  const plotW = svgW - marginL - marginR;
  const plotH = svgH - marginT - marginB;
  const ox = marginL;
  const oy = marginT + plotH;

  const maxQ = showMarginOfSafety && currentOutput
    ? Math.max(beQ * 1.5, currentOutput * 1.2)
    : Math.max(beQ * 1.8, 1);
  const maxRev = maxQ * sellingPrice;
  const maxCost = fixedCosts + maxQ * variableUnitCost;
  const maxY = Math.max(maxRev, maxCost) * 1.1;

  const toX = (q: number) => ox + (q / maxQ) * plotW;
  const toY = (v: number) => oy - (v / maxY) * plotH;

  const fcY = toY(fixedCosts);
  const beX = toX(beQ);
  const beRevY = toY(beQ * sellingPrice);
  const curX = currentOutput !== undefined ? toX(currentOutput) : null;

  const revY1 = oy;
  const revY2 = toY(maxRev);
  const tcY1 = fcY;
  const tcY2 = toY(maxCost);

  const profitPath = [
    `M ${beX} ${beRevY}`,
    `L ${toX(maxQ)} ${revY2}`,
    `L ${toX(maxQ)} ${tcY2}`,
    'Z',
  ].join(' ');

  const lossPath = [
    `M ${ox} ${revY1}`,
    `L ${beX} ${beRevY}`,
    `L ${ox} ${fcY}`,
    'Z',
  ].join(' ');

  const formatVal = (v: number): string => {
    if (v >= 1000000) return `${currency}${(v / 1000000).toFixed(1)}m`;
    if (v >= 1000) return `${currency}${(v / 1000).toFixed(0)}k`;
    return `${currency}${v.toFixed(0)}`;
  };

  const formatQ = (q: number): string => {
    if (q >= 1000) return `${(q / 1000).toFixed(q >= 10000 ? 0 : 1)}k`;
    return q.toFixed(0);
  };

  const xTickCount = 6;
  const yTickCount = 5;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}>
      <defs>
        <marker id="arr-be" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" />
        </marker>
      </defs>

      <text x={svgW / 2} y={22} textAnchor="middle" fontSize={13} fontWeight={700} fill="hsl(var(--foreground))">
        Break-Even Chart
      </text>

      <line x1={ox} y1={oy} x2={ox} y2={marginT - 10} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-be)" />
      <line x1={ox} y1={oy} x2={ox + plotW + 20} y2={oy} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-be)" />

      <text x={16} y={marginT + plotH / 2} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))"
        transform={`rotate(-90, 16, ${marginT + plotH / 2})`}>
        Revenue / Cost ({currency})
      </text>
      <text x={ox + plotW / 2} y={oy + 44} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
        {outputLabel}
      </text>

      {/* X-axis ticks */}
      {Array.from({ length: xTickCount + 1 }, (_, i) => {
        const q = (maxQ / xTickCount) * i;
        const x = toX(q);
        return (
          <g key={`xt-${i}`}>
            <line x1={x} y1={oy} x2={x} y2={oy + 5} stroke="hsl(var(--foreground))" strokeWidth={1} />
            <text x={x} y={oy + 18} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
              {formatQ(q)}
            </text>
          </g>
        );
      })}

      {/* Y-axis ticks */}
      {Array.from({ length: yTickCount + 1 }, (_, i) => {
        const v = (maxY / yTickCount) * i;
        const y = toY(v);
        return (
          <g key={`yt-${i}`}>
            <line x1={ox - 4} y1={y} x2={ox} y2={y} stroke="hsl(var(--foreground))" strokeWidth={1} />
            <text x={ox - 6} y={y + 4} textAnchor="end" fontSize={9} fill="hsl(var(--muted-foreground))">
              {formatVal(v)}
            </text>
          </g>
        );
      })}

      <path d={lossPath} fill="hsl(0 84% 60% / 0.1)" stroke="none" />
      <path d={profitPath} fill="hsl(142 71% 45% / 0.1)" stroke="none" />

      <line x1={ox} y1={fcY} x2={ox + plotW} y2={fcY} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="6 3" />
      <text x={ox + plotW + 4} y={fcY + 4} fontSize={11} fill="hsl(var(--muted-foreground))">FC</text>

      <line x1={ox} y1={tcY1} x2={ox + plotW} y2={tcY2} stroke="hsl(0 84% 60%)" strokeWidth={2.5} />
      <text x={ox + plotW + 4} y={tcY2 + 4} fontSize={12} fontWeight={700} fill="hsl(0 84% 60%)">TC</text>

      <line x1={ox} y1={revY1} x2={ox + plotW} y2={revY2} stroke="hsl(142 71% 45%)" strokeWidth={2.5} />
      <text x={ox + plotW + 4} y={revY2 + 4} fontSize={12} fontWeight={700} fill="hsl(142 71% 45%)">TR</text>

      <circle cx={beX} cy={beRevY} r={6} fill="hsl(var(--foreground))" />
      <text x={beX + 8} y={beRevY - 8} fontSize={11} fontWeight={600} fill="hsl(var(--foreground))">
        Break-even point
      </text>

      <line x1={beX} y1={oy} x2={beX} y2={beRevY} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" />
      <line x1={ox} y1={beRevY} x2={beX} y2={beRevY} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" />

      {showMarginOfSafety && curX !== null && currentOutput !== undefined && (
        <>
          <rect x={beX} y={marginT} width={curX - beX} height={plotH} fill="hsl(25 95% 53% / 0.06)" />
          <line x1={curX} y1={marginT} x2={curX} y2={oy} stroke="hsl(25 95% 53%)" strokeWidth={2} strokeDasharray="6 3" />
          <text x={curX} y={marginT - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill="hsl(25 95% 53%)">
            Current output
          </text>
          <line x1={beX} y1={oy + 56} x2={curX} y2={oy + 56} stroke="hsl(25 95% 53%)" strokeWidth={2} />
          <line x1={beX} y1={oy + 50} x2={beX} y2={oy + 62} stroke="hsl(25 95% 53%)" strokeWidth={2} />
          <line x1={curX} y1={oy + 50} x2={curX} y2={oy + 62} stroke="hsl(25 95% 53%)" strokeWidth={2} />
          <text x={(beX + curX) / 2} y={oy + 76} textAnchor="middle" fontSize={11} fontWeight={700} fill="hsl(25 95% 53%)">
            Margin of Safety
          </text>
          <text x={(beX + curX) / 2} y={oy + 90} textAnchor="middle" fontSize={9} fill="hsl(25 95% 53%)">
            {formatQ(currentOutput - Math.round(beQ))} units
          </text>
        </>
      )}

      <text x={ox + beX * 0.4} y={oy - plotH * 0.15} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(0 84% 60%)" opacity={0.8}>LOSS</text>
      <text x={beX + plotW * 0.2} y={oy - plotH * 0.2} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(142 71% 45%)" opacity={0.8}>PROFIT</text>
    </svg>
  );
};
