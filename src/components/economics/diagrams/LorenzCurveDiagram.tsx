import type { LorenzCurveConfig } from '../types';

interface Props { config: LorenzCurveConfig; }

export const LorenzCurveDiagram = ({ config }: Props) => {
  const {
    dataPoints = [
      { population: 0, income: 0 },
      { population: 20, income: 5 },
      { population: 40, income: 14 },
      { population: 60, income: 30 },
      { population: 80, income: 55 },
      { population: 100, income: 100 },
    ],
    showGiniCoefficient,
    giniValue,
    country,
    showComparison,
    comparisonLabel = 'Country B',
    comparisonPoints = [
      { population: 0, income: 0 },
      { population: 20, income: 10 },
      { population: 40, income: 24 },
      { population: 60, income: 44 },
      { population: 80, income: 68 },
      { population: 100, income: 100 },
    ],
  } = config;

  const svgW = 420;
  const svgH = 380;
  const marginL = 60;
  const marginB = 60;
  const marginT = 40;
  const marginR = 30;
  const plotW = svgW - marginL - marginR;
  const plotH = svgH - marginT - marginB;
  const ox = marginL;
  const oy = marginT + plotH;

  const toSVG = (pop: number, inc: number) => ({
    x: ox + (pop / 100) * plotW,
    y: oy - (inc / 100) * plotH,
  });

  const buildPath = (pts: typeof dataPoints) =>
    pts.map((p, i) => {
      const { x, y } = toSVG(p.population, p.income);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

  const lorenzPath = buildPath(dataPoints);
  const compPath = buildPath(comparisonPoints);
  const equalityPath = `M ${ox} ${oy} L ${ox + plotW} ${oy - plotH}`;

  const shadedPath = [
    `M ${ox} ${oy}`,
    ...dataPoints.map(p => {
      const { x, y } = toSVG(p.population, p.income);
      return `L ${x} ${y}`;
    }),
    `L ${ox + plotW} ${oy}`,
    'Z',
  ].join(' ');

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}>
      <defs>
        <marker id="arr-lc" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" />
        </marker>
      </defs>

      <text x={svgW / 2} y={22} textAnchor="middle" fontSize={13} fontWeight={700} fill="hsl(var(--foreground))">
        Lorenz Curve{country ? ` — ${country}` : ''}
      </text>

      <line x1={ox} y1={oy} x2={ox} y2={marginT - 10} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-lc)" />
      <line x1={ox} y1={oy} x2={ox + plotW + 20} y2={oy} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-lc)" />

      <text x={12} y={marginT + plotH / 2} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))"
        transform={`rotate(-90, 12, ${marginT + plotH / 2})`}>
        Cumulative % of Income
      </text>
      <text x={ox + plotW / 2} y={oy + 38} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
        Cumulative % of Population
      </text>

      {[0, 20, 40, 60, 80, 100].map(v => {
        const { x, y } = toSVG(v, v);
        return (
          <g key={v}>
            <line x1={x} y1={oy} x2={x} y2={oy + 4} stroke="hsl(var(--foreground))" strokeWidth={1} />
            <text x={x} y={oy + 14} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">{v}</text>
            <line x1={ox - 4} y1={y} x2={ox} y2={y} stroke="hsl(var(--foreground))" strokeWidth={1} />
            <text x={ox - 6} y={y + 4} textAnchor="end" fontSize={9} fill="hsl(var(--muted-foreground))">{v}</text>
          </g>
        );
      })}

      <path d={shadedPath} fill="hsl(0 84% 60% / 0.1)" stroke="none" />
      <polygon points={`${ox},${oy} ${ox + plotW},${oy} ${ox + plotW},${oy - plotH}`} fill="hsl(142 71% 45% / 0.05)" />

      {showComparison && (
        <>
          <path d={compPath} fill="none" stroke="hsl(25 95% 53%)" strokeWidth={2} strokeDasharray="6 3" />
          <text
            x={toSVG(comparisonPoints[2].population, comparisonPoints[2].income).x - 10}
            y={toSVG(comparisonPoints[2].population, comparisonPoints[2].income).y - 10}
            fontSize={11} fill="hsl(25 95% 53%)">{comparisonLabel}</text>
        </>
      )}

      <path d={equalityPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="8 4" />
      <text x={ox + plotW - 10} y={oy - plotH + 4} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">
        Line of equality
      </text>

      <path d={lorenzPath} fill="none" stroke="hsl(221 83% 53%)" strokeWidth={2.5} />
      <text
        x={toSVG(dataPoints[3].population, dataPoints[3].income).x + 6}
        y={toSVG(dataPoints[3].population, dataPoints[3].income).y + 4}
        fontSize={12} fontWeight={700} fill="hsl(221 83% 53%)">
        {country ?? 'Lorenz curve'}
      </text>

      {showGiniCoefficient && (
        <text x={ox + plotW * 0.3} y={oy - plotH * 0.5} textAnchor="middle" fontSize={12} fill="hsl(0 84% 60%)">
          Gini = {giniValue !== undefined ? giniValue.toFixed(2) : 'A / (A+B)'}
        </text>
      )}

      <text x={ox + plotW * 0.35} y={oy - plotH * 0.18} textAnchor="middle" fontSize={13} fontWeight={700} fill="hsl(0 84% 60%)" opacity={0.7}>A</text>
      <text x={ox + plotW * 0.7} y={oy - plotH * 0.55} textAnchor="middle" fontSize={13} fontWeight={700} fill="hsl(142 71% 45%)" opacity={0.7}>B</text>
    </svg>
  );
};
