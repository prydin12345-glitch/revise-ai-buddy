import type { PPFConfig } from '../types';

interface Props { config: PPFConfig; }

export const PPFDiagram = ({ config }: Props) => {
  const {
    good1 = 'Capital Goods',
    good2 = 'Consumer Goods',
    showShift,
    shiftDirection = 'outward',
    showOpportunityCost,
    showAttainablePoint,
    showUnattainablePoint,
    showInefficientPoint,
    shape = 'concave',
  } = config;

  const svgW = 460;
  const svgH = 380;
  const marginL = 70;
  const marginB = 60;
  const marginT = 40;
  const marginR = 60;
  const plotW = svgW - marginL - marginR;
  const plotH = svgH - marginT - marginB;
  const ox = marginL;
  const oy = marginT + plotH;

  const ppfPoints = (scale = 1): string => {
    const pts: string[] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = plotH * t * scale;
      const x = shape === 'concave'
        ? plotW * Math.sqrt(1 - t * t) * scale
        : plotW * (1 - t) * scale;
      pts.push(`${ox + x},${oy - y}`);
    }
    return pts.join(' ');
  };

  // Cap shift scale so PPF2 stays inside viewBox
  const shiftScale = shiftDirection === 'outward' ? 1.15 : 0.78;

  const inefficientX = ox + plotW * 0.3;
  const inefficientY = oy - plotH * 0.25;
  const unattainableX = ox + plotW * 0.75;
  const unattainableY = oy - plotH * 0.65;

  // Point ON the frontier
  const onCurveT = 0.5;
  const onCurveX = ox + (shape === 'concave' ? plotW * Math.sqrt(1 - onCurveT * onCurveT) : plotW * (1 - onCurveT));
  const onCurveY = oy - plotH * onCurveT;

  // Opportunity cost — two points on curve
  const tA = 0.7, tB = 0.35;
  const axA = ox + (shape === 'concave' ? plotW * Math.sqrt(1 - tA * tA) : plotW * (1 - tA));
  const ayA = oy - plotH * tA;
  const axB = ox + (shape === 'concave' ? plotW * Math.sqrt(1 - tB * tB) : plotW * (1 - tB));
  const ayB = oy - plotH * tB;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}>
      <defs>
        <marker id="arr-ppf" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" />
        </marker>
        <marker id="arr-oc2" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" />
        </marker>
      </defs>

      <text x={svgW / 2} y={22} textAnchor="middle" fontSize={13} fontWeight={700} fill="hsl(var(--foreground))">
        Production Possibility Frontier
      </text>

      <line x1={ox} y1={oy} x2={ox} y2={marginT - 10} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-ppf)" />
      <line x1={ox} y1={oy} x2={ox + plotW + 20} y2={oy} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-ppf)" />

      <text x={16} y={marginT + plotH / 2} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))"
        transform={`rotate(-90, 16, ${marginT + plotH / 2})`}>
        {good1}
      </text>
      <text x={ox + plotW / 2} y={oy + 28} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
        {good2}
      </text>
      <text x={ox - 8} y={oy + 14} textAnchor="middle" fontSize={10} fill="hsl(var(--foreground))">O</text>

      <polyline points={`${ox},${oy} ${ppfPoints()} ${ox},${oy}`} fill="hsl(142 71% 45% / 0.08)" stroke="none" />

      {showShift && (
        <>
          <polyline
            points={ppfPoints(shiftScale)}
            fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" />
          <text
            x={ox + plotW * shiftScale - 4}
            y={oy - plotH * 0.08}
            textAnchor="end" fontSize={12} fontWeight={700} fill="hsl(var(--primary))">PPF₂</text>
        </>
      )}

      <polyline points={ppfPoints()} fill="none" stroke="hsl(221 83% 53%)" strokeWidth={2.5} />
      <text x={ox + plotW - 10} y={oy - plotH * 0.05} textAnchor="end" fontSize={12} fontWeight={700} fill="hsl(221 83% 53%)">
        {showShift ? 'PPF₁' : 'PPF'}
      </text>

      {showInefficientPoint && (
        <>
          <circle cx={inefficientX} cy={inefficientY} r={5} fill="hsl(0 84% 60%)" />
          <text x={inefficientX + 10} y={inefficientY - 6} fontSize={11} fill="hsl(0 84% 60%)">Inefficient (A)</text>
          <text x={inefficientX + 10} y={inefficientY + 8} fontSize={9} fill="hsl(var(--muted-foreground))">unemployed resources</text>
        </>
      )}

      {/* Always show point ON the frontier when other points shown */}
      {(showAttainablePoint || showInefficientPoint || showUnattainablePoint) && (
        <>
          <circle cx={onCurveX} cy={onCurveY} r={5} fill="hsl(142 71% 45%)" />
          <text x={onCurveX + 10} y={onCurveY - 4} fontSize={11} fill="hsl(142 71% 45%)">Efficient (on frontier)</text>
        </>
      )}

      {showUnattainablePoint && (
        <>
          <circle cx={unattainableX} cy={unattainableY} r={5} fill="hsl(0 84% 60%)" />
          <text x={unattainableX + 8} y={unattainableY - 4} fontSize={11} fill="hsl(0 84% 60%)">Unattainable (C)</text>
        </>
      )}

      {showOpportunityCost && (
        <>
          <circle cx={axA} cy={ayA} r={5} fill="hsl(221 83% 53%)" />
          <text x={axA - 14} y={ayA - 6} fontSize={11} fill="hsl(221 83% 53%)">A</text>
          <circle cx={axB} cy={ayB} r={5} fill="hsl(25 95% 53%)" />
          <text x={axB + 8} y={ayB - 4} fontSize={11} fill="hsl(25 95% 53%)">B</text>
          <line x1={axA} y1={ayA} x2={axA} y2={oy} stroke="hsl(221 83% 53%)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          <line x1={axA} y1={ayA} x2={ox} y2={ayA} stroke="hsl(221 83% 53%)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          <line x1={axB} y1={ayB} x2={axB} y2={oy} stroke="hsl(25 95% 53%)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          <line x1={axB} y1={ayB} x2={ox} y2={ayB} stroke="hsl(25 95% 53%)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          <path
            d={`M ${axA} ${ayA} Q ${(axA + axB) / 2 + 18} ${(ayA + ayB) / 2 - 18} ${axB} ${ayB}`}
            fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.5}
            strokeDasharray="5 3" markerEnd="url(#arr-oc2)" />
          <text x={(axA + axB) / 2 + 28} y={(ayA + ayB) / 2 - 10} fontSize={10} fill="hsl(var(--foreground))">A→B:</text>
          <text x={(axA + axB) / 2 + 28} y={(ayA + ayB) / 2 + 2} fontSize={9} fill="hsl(var(--muted-foreground))">+ {good2.toLowerCase()}</text>
          <text x={(axA + axB) / 2 + 28} y={(ayA + ayB) / 2 + 14} fontSize={9} fill="hsl(var(--muted-foreground))">− {good1.toLowerCase()}</text>
        </>
      )}
    </svg>
  );
};
