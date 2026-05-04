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

  const svgW = 420;
  const svgH = 380;
  const marginL = 60;
  const marginB = 60;
  const marginT = 40;
  const marginR = 40;
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

  const attainableX = ox + plotW * 0.45;
  const attainableY = oy - plotH * 0.35;
  const inefficientX = ox + plotW * 0.3;
  const inefficientY = oy - plotH * 0.25;
  const unattainableX = ox + plotW * 0.75;
  const unattainableY = oy - plotH * 0.65;

  const ocAX = ox + plotW * 0.5;
  const ocAY = oy - plotH * 0.6;
  const ocBX = ox + plotW * 0.7;
  const ocBY = oy - plotH * 0.3;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}>
      <defs>
        <marker id="arr-ppf" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" />
        </marker>
        <marker id="arr-oc" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(25 95% 53%)" />
        </marker>
      </defs>

      <text x={svgW / 2} y={22} textAnchor="middle" fontSize={13} fontWeight={700} fill="hsl(var(--foreground))">
        Production Possibility Frontier
      </text>

      <line x1={ox} y1={oy} x2={ox} y2={marginT - 10} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-ppf)" />
      <line x1={ox} y1={oy} x2={ox + plotW + 20} y2={oy} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-ppf)" />

      <text x={ox - 12} y={marginT + plotH / 2} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))"
        transform={`rotate(-90, ${ox - 12}, ${marginT + plotH / 2})`}>
        {good1}
      </text>
      <text x={ox + plotW / 2} y={oy + 22} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
        {good2}
      </text>
      <text x={ox - 8} y={oy + 14} textAnchor="middle" fontSize={10} fill="hsl(var(--foreground))">O</text>

      <polyline points={`${ox},${oy} ${ppfPoints()} ${ox},${oy}`} fill="hsl(142 71% 45% / 0.08)" stroke="none" />

      {showShift && (
        <>
          <polyline
            points={ppfPoints(shiftDirection === 'outward' ? 1.2 : 0.75)}
            fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" />
          <text x={ox + plotW * (shiftDirection === 'outward' ? 1.2 : 0.75) - 10} y={oy - plotH * 0.05}
            textAnchor="end" fontSize={11} fill="hsl(var(--primary))">PPF₂</text>
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
      {showAttainablePoint && (
        <>
          <circle cx={attainableX} cy={attainableY} r={5} fill="hsl(142 71% 45%)" />
          <text x={attainableX + 10} y={attainableY - 4} fontSize={11} fill="hsl(142 71% 45%)">Attainable (B)</text>
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
          <line x1={ocAX} y1={ocAY} x2={ocBX} y2={ocBY} stroke="hsl(25 95% 53%)" strokeWidth={1.5} strokeDasharray="5 3" markerEnd="url(#arr-oc)" />
          <text x={(ocAX + ocBX) / 2 + 12} y={(ocAY + ocBY) / 2} fontSize={10} fill="hsl(25 95% 53%)">Opp. cost</text>
        </>
      )}
    </svg>
  );
};
