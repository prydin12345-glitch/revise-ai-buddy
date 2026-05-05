import type { SupplyDemandConfig } from '../types';

interface Props { config: SupplyDemandConfig; }

export const SupplyDemandDiagram = ({ config }: Props) => {
  const {
    supplyShift,
    demandShift,
    good,
    currency = '£',
    showTax,
    showPriceFloor,
    showPriceCeiling,
    showExternality,
    externalityType = 'negative',
    showConsumerSurplus,
    showProducerSurplus,
    variant = 'standard',
  } = config;

  const svgW = 480;
  const svgH = 410;
  const marginL = 70;
  const marginB = 70;
  const marginT = 40;
  const marginR = 50;
  const plotW = svgW - marginL - marginR;
  const plotH = svgH - marginT - marginB;

  const ox = marginL;
  const oy = marginT + plotH;

  const eqX = ox + plotW * 0.5;
  const eqY = oy - plotH * 0.5;

  const S1x1 = ox + plotW * 0.1;
  const S1y1 = oy - plotH * 0.05;
  const S1x2 = ox + plotW * 0.9;
  const S1y2 = oy - plotH * 0.95;

  const D1x1 = ox + plotW * 0.05;
  const D1y1 = oy - plotH * 0.95;
  const D1x2 = ox + plotW * 0.95;
  const D1y2 = oy - plotH * 0.05;

  const shiftAmount = plotW * 0.2;
  const sShift = supplyShift === 'increase' ? shiftAmount : supplyShift === 'decrease' ? -shiftAmount : 0;
  const dShift = demandShift === 'increase' ? shiftAmount : demandShift === 'decrease' ? -shiftAmount : 0;
  const S2x1 = S1x1 + sShift, S2x2 = S1x2 + sShift, S2y1 = S1y1, S2y2 = S1y2;
  const D2x1 = D1x1 + dShift, D2x2 = D1x2 + dShift, D2y1 = D1y1, D2y2 = D1y2;

  const intersect = (
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number,
  ): { x: number; y: number } | null => {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  };

  const newEq = intersect(S2x1, S2y1, S2x2, S2y2, D2x1, D2y1, D2x2, D2y2) ?? { x: eqX, y: eqY };
  const hasShift = !!supplyShift || !!demandShift;

  const taxShiftY = showTax ? plotH * 0.12 : 0;
  const Stax_x1 = S1x1, Stax_y1 = S1y1 - taxShiftY, Stax_x2 = S1x2, Stax_y2 = S1y2 - taxShiftY;
  const taxEq = showTax ? intersect(Stax_x1, Stax_y1, Stax_x2, Stax_y2, D1x1, D1y1, D1x2, D1y2) : null;

  const extShiftY = showExternality ? plotH * 0.15 : 0;
  const Sext_x1 = S1x1;
  const Sext_y1 = externalityType === 'negative' ? S1y1 - extShiftY : S1y1 + extShiftY;
  const Sext_x2 = S1x2;
  const Sext_y2 = externalityType === 'negative' ? S1y2 - extShiftY : S1y2 + extShiftY;
  const extEq = showExternality
    ? intersect(Sext_x1, Sext_y1, Sext_x2, Sext_y2, D1x1, D1y1, D1x2, D1y2)
    : null;

  const floorY = showPriceFloor ? eqY - plotH * 0.12 : null;
  const ceilingY = showPriceCeiling ? eqY + plotH * 0.12 : null;

  // Price floor surplus (Qd, Qs)
  let qdX_floor: number | null = null;
  let qsX_floor: number | null = null;
  if (floorY !== null) {
    const sSlope = (S1y2 - S1y1) / (S1x2 - S1x1);
    qsX_floor = S1x1 + (floorY - S1y1) / sSlope;
    const dSlope = (D1y2 - D1y1) / (D1x2 - D1x1);
    qdX_floor = D1x1 + (floorY - D1y1) / dSlope;
  }

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}>
      <defs>
        <marker id="arr-axis-sd" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" />
        </marker>
      </defs>

      <text x={svgW / 2} y={20} textAnchor="middle" fontSize={13}
        fontWeight={700} fill="hsl(var(--foreground))">
        {variant === 'labour_market' ? 'Labour Market Diagram' : good ? `Supply and Demand — ${good}` : 'Supply and Demand Diagram'}
      </text>

      <line x1={ox} y1={oy} x2={ox} y2={marginT - 10} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-axis-sd)" />
      <line x1={ox} y1={oy} x2={ox + plotW + 20} y2={oy} stroke="hsl(var(--foreground))" strokeWidth={2} markerEnd="url(#arr-axis-sd)" />

      {/* Axis labels — safely placed */}
      <text
        x={16}
        y={marginT + plotH / 2}
        textAnchor="middle"
        fontSize={11}
        fill="hsl(var(--foreground))"
        transform={`rotate(-90, 16, ${marginT + plotH / 2})`}
      >
        {variant === 'labour_market' ? 'Wage' : `Price (${currency})`}
      </text>
      <text
        x={ox + plotW / 2}
        y={oy + 44}
        textAnchor="middle"
        fontSize={11}
        fill="hsl(var(--foreground))"
      >
        {variant === 'labour_market' ? 'Quantity of Labour' : 'Quantity'}
      </text>
      <text x={ox - 8} y={oy + 12} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">O</text>

      {showConsumerSurplus && !hasShift && (
        <polygon points={`${ox},${oy - plotH * 0.95} ${eqX},${eqY} ${ox},${eqY}`} fill="hsl(221 83% 53% / 0.15)" />
      )}
      {showProducerSurplus && !hasShift && (
        <polygon points={`${ox},${eqY} ${eqX},${eqY} ${ox + plotW * 0.1},${oy}`} fill="hsl(142 71% 45% / 0.15)" />
      )}

      {showExternality && (
        <>
          <line x1={Sext_x1} y1={Sext_y1} x2={Sext_x2} y2={Sext_y2} stroke="hsl(0 84% 60%)" strokeWidth={2} strokeDasharray="6 3" />
          <text x={Sext_x2 + 6} y={Sext_y2} fontSize={11} fill="hsl(0 84% 60%)">
            {externalityType === 'negative' ? 'MSC' : 'MSB'}
          </text>
        </>
      )}

      {showTax && (
        <>
          <line x1={Stax_x1} y1={Stax_y1} x2={Stax_x2} y2={Stax_y2} stroke="hsl(25 95% 53%)" strokeWidth={2} strokeDasharray="5 3" />
          <text x={Stax_x2 + 6} y={Stax_y2} fontSize={11} fill="hsl(25 95% 53%)">S+tax</text>
        </>
      )}

      {floorY !== null && (
        <>
          <line x1={ox} y1={floorY} x2={ox + plotW} y2={floorY} stroke="hsl(0 84% 60%)" strokeWidth={2} strokeDasharray="8 4" />
          <text x={ox + plotW + 4} y={floorY + 4} fontSize={11} fill="hsl(0 84% 60%)">Floor</text>
          <text x={ox - 8} y={floorY + 4} textAnchor="end" fontSize={10} fill="hsl(0 84% 60%)">Pmin</text>
        </>
      )}

      {ceilingY !== null && (
        <>
          <line x1={ox} y1={ceilingY} x2={ox + plotW} y2={ceilingY} stroke="hsl(221 83% 53%)" strokeWidth={2} strokeDasharray="8 4" />
          <text x={ox + plotW + 4} y={ceilingY + 4} fontSize={11} fill="hsl(221 83% 53%)">Ceiling</text>
          <text x={ox - 8} y={ceilingY + 4} textAnchor="end" fontSize={10} fill="hsl(221 83% 53%)">Pmax</text>
        </>
      )}

      <line x1={S1x1} y1={S1y1} x2={S1x2} y2={S1y2} stroke="hsl(221 83% 53%)" strokeWidth={2.5} />
      <text x={S1x2 + 5} y={S1y2 + 4} fontSize={13} fontWeight={700} fill="hsl(221 83% 53%)">
        {variant === 'labour_market' ? 'SL' : showExternality ? 'S (MPC)' : supplyShift ? 'S₁' : 'S'}
      </text>

      <line x1={D1x1} y1={D1y1} x2={D1x2} y2={D1y2} stroke="hsl(0 84% 60%)" strokeWidth={2.5} />
      <text x={D1x2 + 5} y={D1y2 + 12} fontSize={13} fontWeight={700} fill="hsl(0 84% 60%)">
        {variant === 'labour_market' ? 'DL' : demandShift ? 'D₁' : 'D'}
      </text>

      {supplyShift && (
        <>
          <line x1={S2x1} y1={S2y1} x2={S2x2} y2={S2y2} stroke="hsl(221 83% 53%)" strokeWidth={2} strokeDasharray="6 3" opacity={0.7} />
          <text x={S2x2 + 5} y={S2y2 + 4} fontSize={13} fill="hsl(221 83% 53%)" opacity={0.8}>S₂</text>
        </>
      )}
      {demandShift && (
        <>
          <line x1={D2x1} y1={D2y1} x2={D2x2} y2={D2y2} stroke="hsl(0 84% 60%)" strokeWidth={2} strokeDasharray="6 3" opacity={0.7} />
          <text x={D2x2 + 5} y={D2y2 + 12} fontSize={13} fill="hsl(0 84% 60%)" opacity={0.8}>D₂</text>
        </>
      )}

      <line x1={eqX} y1={oy} x2={eqX} y2={eqY} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" />
      <line x1={ox} y1={eqY} x2={eqX} y2={eqY} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" />

      {hasShift && (
        <>
          <line x1={newEq.x} y1={oy} x2={newEq.x} y2={newEq.y} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          <line x1={ox} y1={newEq.y} x2={newEq.x} y2={newEq.y} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
        </>
      )}

      <circle cx={eqX} cy={eqY} r={5} fill="hsl(var(--foreground))" />
      <text x={eqX + 8} y={eqY - 6} fontSize={11} fill="hsl(var(--foreground))">E₁</text>

      {hasShift && (
        <>
          <circle cx={newEq.x} cy={newEq.y} r={5} fill="hsl(var(--primary))" opacity={0.7} />
          <text x={newEq.x + 8} y={newEq.y - 6} fontSize={11} fill="hsl(var(--primary))">E₂</text>
        </>
      )}

      <text x={eqX} y={oy + 16} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">Q₁</text>
      <text x={ox - 8} y={eqY + 4} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">P₁</text>

      {hasShift && (
        <>
          <text x={newEq.x} y={oy + 16} textAnchor="middle" fontSize={10} fill="hsl(var(--primary))" opacity={0.8}>Q₂</text>
          <text x={ox - 8} y={newEq.y + 4} textAnchor="end" fontSize={10} fill="hsl(var(--primary))" opacity={0.8}>P₂</text>
        </>
      )}

      {/* Tax: new equilibrium E2, dashed lines, wedge bracket at NEW Q */}
      {showTax && taxEq && (() => {
        const sOriginalY = S1y1 + (S1y2 - S1y1) * ((taxEq.x - S1x1) / (S1x2 - S1x1));
        return (
          <>
            <circle cx={taxEq.x} cy={taxEq.y} r={5} fill="hsl(25 95% 53%)" />
            <text x={taxEq.x + 8} y={taxEq.y - 6} fontSize={11} fontWeight={600} fill="hsl(25 95% 53%)">E₂</text>
            <line x1={taxEq.x} y1={oy} x2={taxEq.x} y2={taxEq.y} stroke="hsl(25 95% 53%)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
            <line x1={ox} y1={taxEq.y} x2={taxEq.x} y2={taxEq.y} stroke="hsl(25 95% 53%)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
            <text x={taxEq.x} y={oy + 28} textAnchor="middle" fontSize={9} fill="hsl(25 95% 53%)">Q₂</text>
            <text x={ox - 8} y={taxEq.y + 4} textAnchor="end" fontSize={9} fill="hsl(25 95% 53%)">P₂</text>
            <line x1={taxEq.x - 20} y1={taxEq.y} x2={taxEq.x - 20} y2={sOriginalY} stroke="hsl(25 95% 53%)" strokeWidth={2} />
            <line x1={taxEq.x - 24} y1={taxEq.y} x2={taxEq.x - 16} y2={taxEq.y} stroke="hsl(25 95% 53%)" strokeWidth={1.5} />
            <line x1={taxEq.x - 24} y1={sOriginalY} x2={taxEq.x - 16} y2={sOriginalY} stroke="hsl(25 95% 53%)" strokeWidth={1.5} />
            <text x={taxEq.x - 26} y={(taxEq.y + sOriginalY) / 2 + 4} textAnchor="end" fontSize={10} fill="hsl(25 95% 53%)">tax</text>
          </>
        );
      })()}

      {/* Price floor surplus: Qs, Qd brackets */}
      {floorY !== null && qdX_floor !== null && qsX_floor !== null && (
        <>
          <line x1={qsX_floor} y1={floorY} x2={qsX_floor} y2={oy} stroke="hsl(0 84% 60%)" strokeWidth={1} strokeDasharray="4 3" />
          <text x={qsX_floor} y={oy + 16} textAnchor="middle" fontSize={9} fill="hsl(0 84% 60%)">Qs</text>
          <line x1={qdX_floor} y1={floorY} x2={qdX_floor} y2={oy} stroke="hsl(0 84% 60%)" strokeWidth={1} strokeDasharray="4 3" />
          <text x={qdX_floor} y={oy + 16} textAnchor="middle" fontSize={9} fill="hsl(0 84% 60%)">Qd</text>
          <line x1={qdX_floor} y1={oy + 28} x2={qsX_floor} y2={oy + 28} stroke="hsl(0 84% 60%)" strokeWidth={1.5} />
          <line x1={qdX_floor} y1={oy + 24} x2={qdX_floor} y2={oy + 32} stroke="hsl(0 84% 60%)" strokeWidth={1.5} />
          <line x1={qsX_floor} y1={oy + 24} x2={qsX_floor} y2={oy + 32} stroke="hsl(0 84% 60%)" strokeWidth={1.5} />
          <text x={(qdX_floor + qsX_floor) / 2} y={oy + 60} textAnchor="middle" fontSize={10} fontWeight={600} fill="hsl(0 84% 60%)">SURPLUS</text>
          <circle cx={qdX_floor} cy={floorY} r={4} fill="hsl(0 84% 60%)" />
          <circle cx={qsX_floor} cy={floorY} r={4} fill="hsl(0 84% 60%)" />
        </>
      )}

      {/* Externality: Q*, P*, DWL */}
      {showExternality && extEq && (() => {
        const qm = { x: eqX, y: eqY };
        // 3rd point of DWL triangle: vertical from qm to MSC at qm.x
        const mscAtQm = Sext_y1 + (Sext_y2 - Sext_y1) * ((qm.x - Sext_x1) / (Sext_x2 - Sext_x1));
        return (
          <>
            <line x1={extEq.x} y1={oy} x2={extEq.x} y2={extEq.y} stroke="hsl(0 84% 60%)" strokeWidth={1} strokeDasharray="4 3" />
            <line x1={ox} y1={extEq.y} x2={extEq.x} y2={extEq.y} stroke="hsl(0 84% 60%)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={extEq.x} y={oy + 16} textAnchor="middle" fontSize={9} fill="hsl(0 84% 60%)">Q*</text>
            <text x={ox - 8} y={extEq.y + 4} textAnchor="end" fontSize={9} fill="hsl(0 84% 60%)">P*</text>
            <circle cx={extEq.x} cy={extEq.y} r={5} fill="hsl(0 84% 60%)" />
            <text x={extEq.x + 8} y={extEq.y - 6} fontSize={10} fill="hsl(0 84% 60%)">E*</text>
            <polygon
              points={`${extEq.x},${extEq.y} ${qm.x},${qm.y} ${qm.x},${mscAtQm}`}
              fill="hsl(0 84% 60% / 0.25)"
              stroke="hsl(0 84% 60%)"
              strokeWidth={1}
            />
            <text x={(extEq.x + qm.x) / 2 + 6} y={(extEq.y + qm.y) / 2} fontSize={9} fontWeight={600} fill="hsl(0 84% 60%)">DWL</text>
            <text x={qm.x} y={oy + 28} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">Qm</text>
            <text x={ox - 8} y={qm.y + 14} textAnchor="end" fontSize={9} fill="hsl(var(--muted-foreground))">Pm</text>
          </>
        );
      })()}

      {showConsumerSurplus && !hasShift && (
        <text x={ox + 40} y={eqY - 30} fontSize={11} fill="hsl(221 83% 53%)">CS</text>
      )}
      {showProducerSurplus && !hasShift && (
        <text x={ox + 40} y={oy - 30} fontSize={11} fill="hsl(142 71% 45%)">PS</text>
      )}
    </svg>
  );
};
