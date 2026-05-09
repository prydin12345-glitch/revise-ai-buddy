import type { VennTwoConfig, VennThreeConfig } from '../types';

const valueFontSize = (val: string | number | undefined): number => {
  const len = String(val ?? '').length;
  if (len <= 2) return 18;
  if (len <= 4) return 15;
  if (len <= 6) return 12;
  return 10;
};

const vennThreeFontSize = (val: string | number | undefined): number => {
  const len = String(val ?? '').length;
  return len <= 2 ? 16 : len <= 4 ? 13 : 11;
};

export const VennTwoDiagram = ({ config }: { config: VennTwoConfig }) => {
  const {
    setA, setB, onlyA, onlyB, both, neither,
    universalSetLabel = 'ξ',
    highlightRegion, showSetNotation, title,
  } = config;

  const W = 420, H = 280;
  const cx1 = 155, cx2 = 265, cy = 140, r = 90;
  const highlightFill = 'hsl(221 83% 53% / 0.25)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      {title && (
        <text x={W / 2} y={18} textAnchor="middle" fontSize={12} fontWeight={700}
          fill="hsl(var(--foreground))">{title}</text>
      )}
      <rect x={8} y={26} width={W - 16} height={H - 34} rx={6}
        fill="hsl(var(--muted)/0.2)" stroke="hsl(var(--foreground))" strokeWidth={1.5} />
      <text x={18} y={42} fontSize={13} fontWeight={700} fill="hsl(var(--foreground))">
        {universalSetLabel}
      </text>
      <defs>
        <clipPath id="clipA"><circle cx={cx1} cy={cy} r={r} /></clipPath>
        <clipPath id="clipB"><circle cx={cx2} cy={cy} r={r} /></clipPath>
        <clipPath id="clipAnotB"><rect x={0} y={0} width={cx2} height={H} /></clipPath>
        <clipPath id="clipBnotA"><rect x={cx1 + 1} y={0} width={W} height={H} /></clipPath>
      </defs>
      {highlightRegion === 'neither' && (
        <rect x={8} y={26} width={W - 16} height={H - 34} fill={highlightFill} rx={6} />
      )}
      {highlightRegion === 'complement_A' && (
        <>
          <rect x={8} y={26} width={W - 16} height={H - 34} fill={highlightFill} rx={6} />
          <circle cx={cx1} cy={cy} r={r} fill="hsl(var(--card))" />
          <circle cx={cx2} cy={cy} r={r} fill={highlightFill} clipPath="url(#clipA)" />
        </>
      )}
      {highlightRegion === 'union' && (
        <>
          <circle cx={cx1} cy={cy} r={r} fill={highlightFill} />
          <circle cx={cx2} cy={cy} r={r} fill={highlightFill} />
        </>
      )}
      {highlightRegion === 'A_only' && (
        <circle cx={cx1} cy={cy} r={r} fill={highlightFill} clipPath="url(#clipAnotB)" />
      )}
      {highlightRegion === 'B_only' && (
        <circle cx={cx2} cy={cy} r={r} fill={highlightFill} clipPath="url(#clipBnotA)" />
      )}
      {highlightRegion === 'intersection' && (
        <circle cx={cx2} cy={cy} r={r} fill={highlightFill} clipPath="url(#clipA)" />
      )}
      <circle cx={cx1} cy={cy} r={r}
        fill="hsl(221 83% 53% / 0.08)" stroke="hsl(221 83% 53%)" strokeWidth={2} />
      <circle cx={cx2} cy={cy} r={r}
        fill="hsl(0 84% 60% / 0.08)" stroke="hsl(0 84% 60%)" strokeWidth={2} />
      <text x={cx1} y={cy - r - 8} textAnchor="middle" fontSize={14} fontWeight={700}
        fill="hsl(221 83% 53%)">{setA}</text>
      <text x={cx2} y={cy - r - 8} textAnchor="middle" fontSize={14} fontWeight={700}
        fill="hsl(0 84% 60%)">{setB}</text>
      {onlyA !== undefined && (
        <text x={108} y={cy + 5} textAnchor="middle" fontSize={valueFontSize(onlyA)} fontWeight={600}
          fill="hsl(var(--foreground))">{onlyA}</text>
      )}
      {both !== undefined && (
        <text x={(cx1 + cx2) / 2} y={cy + 5} textAnchor="middle" fontSize={valueFontSize(both)} fontWeight={600}
          fill="hsl(var(--foreground))">{both}</text>
      )}
      {onlyB !== undefined && (
        <text x={312} y={cy + 5} textAnchor="middle" fontSize={valueFontSize(onlyB)} fontWeight={600}
          fill="hsl(var(--foreground))">{onlyB}</text>
      )}
      {neither !== undefined && (
        <text x={W - 24} y={H - 28} textAnchor="end" fontSize={14}
          fill="hsl(var(--muted-foreground))">{neither}</text>
      )}
      {showSetNotation && (
        <>
          <text x={cx1 - 36} y={cy + 22} textAnchor="middle" fontSize={9}
            fill="hsl(var(--muted-foreground))">A only</text>
          <text x={(cx1 + cx2) / 2} y={cy + 22} textAnchor="middle" fontSize={9}
            fill="hsl(var(--muted-foreground))">A∩B</text>
          <text x={cx2 + 36} y={cy + 22} textAnchor="middle" fontSize={9}
            fill="hsl(var(--muted-foreground))">B only</text>
        </>
      )}
    </svg>
  );
};

export const VennThreeDiagram = ({ config }: { config: VennThreeConfig }) => {
  const {
    setA, setB, setC, onlyA, onlyB, onlyC,
    AB_only, AC_only, BC_only, all_three,
    neither, universalSetLabel = 'ξ', title,
  } = config;

  const W = 440, H = 340;
  const r = 100;
  const cxA = 175, cyA = 125;
  const cxB = 265, cyB = 125;
  const cxC = 220, cyC = 220;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      {title && (
        <text x={W / 2} y={18} textAnchor="middle" fontSize={12} fontWeight={700}
          fill="hsl(var(--foreground))">{title}</text>
      )}
      <rect x={8} y={24} width={W - 16} height={H - 32} rx={6}
        fill="hsl(var(--muted)/0.15)" stroke="hsl(var(--foreground))" strokeWidth={1.5} />
      <text x={18} y={40} fontSize={13} fontWeight={700} fill="hsl(var(--foreground))">
        {universalSetLabel}
      </text>
      <circle cx={cxA} cy={cyA} r={r}
        fill="hsl(221 83% 53% / 0.1)" stroke="hsl(221 83% 53%)" strokeWidth={2} />
      <circle cx={cxB} cy={cyB} r={r}
        fill="hsl(0 84% 60% / 0.1)" stroke="hsl(0 84% 60%)" strokeWidth={2} />
      <circle cx={cxC} cy={cyC} r={r}
        fill="hsl(142 71% 45% / 0.1)" stroke="hsl(142 71% 45%)" strokeWidth={2} />
      <text x={cxA - 60} y={cyA - 70} fontSize={13} fontWeight={700}
        fill="hsl(221 83% 53%)">{setA}</text>
      <text x={cxB + 60} y={cyB - 70} textAnchor="end" fontSize={13} fontWeight={700}
        fill="hsl(0 84% 60%)">{setB}</text>
      <text x={cxC} y={cyC + r + 18} textAnchor="middle" fontSize={13} fontWeight={700}
        fill="hsl(142 71% 45%)">{setC}</text>
      {onlyA !== undefined && (
        <text x={cxA - 36} y={cyA - 10} textAnchor="middle" fontSize={vennThreeFontSize(onlyA)} fontWeight={600}
          fill="hsl(var(--foreground))">{onlyA}</text>
      )}
      {onlyB !== undefined && (
        <text x={cxB + 36} y={cyB - 10} textAnchor="middle" fontSize={vennThreeFontSize(onlyB)} fontWeight={600}
          fill="hsl(var(--foreground))">{onlyB}</text>
      )}
      {onlyC !== undefined && (
        <text x={cxC} y={cyC + 44} textAnchor="middle" fontSize={vennThreeFontSize(onlyC)} fontWeight={600}
          fill="hsl(var(--foreground))">{onlyC}</text>
      )}
      {AB_only !== undefined && (
        <text x={(cxA + cxB) / 2} y={cyA - 16} textAnchor="middle" fontSize={vennThreeFontSize(AB_only)} fontWeight={600}
          fill="hsl(var(--foreground))">{AB_only}</text>
      )}
      {AC_only !== undefined && (
        <text x={(cxA + cxC) / 2 - 20} y={(cyA + cyC) / 2 + 14} textAnchor="middle"
          fontSize={vennThreeFontSize(AC_only)} fontWeight={600} fill="hsl(var(--foreground))">{AC_only}</text>
      )}
      {BC_only !== undefined && (
        <text x={(cxB + cxC) / 2 + 20} y={(cyB + cyC) / 2 + 14} textAnchor="middle"
          fontSize={vennThreeFontSize(BC_only)} fontWeight={600} fill="hsl(var(--foreground))">{BC_only}</text>
      )}
      {all_three !== undefined && (
        <text x={(cxA + cxB + cxC) / 3} y={(cyA + cyB + cyC) / 3 + 5} textAnchor="middle"
          fontSize={vennThreeFontSize(all_three) + 1} fontWeight={700} fill="hsl(var(--foreground))">{all_three}</text>
      )}
      {neither !== undefined && (
        <text x={W - 24} y={H - 36} textAnchor="end" fontSize={12}
          fill="hsl(var(--muted-foreground))">{neither}</text>
      )}
    </svg>
  );
};
