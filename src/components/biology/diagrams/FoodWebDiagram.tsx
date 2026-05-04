import React from 'react';
import type { BiologyDiagramConfig } from '../types';

interface Props { config: BiologyDiagramConfig; }

export const FoodWebDiagram: React.FC<Props> = ({ config }) => {
  const organisms = config.organisms ?? ['grass', 'rabbit', 'fox'];

  const trophicOrder = [
    ['grass', 'plant', 'algae', 'phytoplankton', 'wheat', 'corn', 'leaves', 'producer'],
    ['rabbit', 'mouse', 'insect', 'caterpillar', 'grasshopper', 'aphid', 'deer', 'sheep', 'cow', 'zebra', 'krill', 'zooplankton'],
    ['fox', 'frog', 'snake', 'small bird', 'herring', 'cod', 'tuna'],
    ['eagle', 'hawk', 'owl', 'wolf', 'lion', 'shark', 'orca'],
    ['bacteria', 'fungi', 'decomposer'],
  ];

  const levelColors = [
    'hsl(142 71% 45% / 0.15)',
    'hsl(25 95% 53% / 0.15)',
    'hsl(221 83% 53% / 0.15)',
    'hsl(0 84% 60% / 0.15)',
    'hsl(262 83% 58% / 0.15)',
  ];
  const levelLabels = ['Producers', 'Primary\nConsumers', 'Secondary\nConsumers', 'Tertiary\nConsumers', 'Decomposers'];

  const assigned = organisms.map(org => {
    const o = org.toLowerCase();
    for (let i = 0; i < trophicOrder.length; i++) {
      if (trophicOrder[i].some(t => o.includes(t))) return { org, level: i };
    }
    return { org, level: 1 };
  });

  const byLevel: Record<number, string[]> = {};
  assigned.forEach(({ org, level }) => {
    if (!byLevel[level]) byLevel[level] = [];
    byLevel[level].push(org);
  });

  const levels = Object.keys(byLevel).map(Number).sort((a, b) => b - a);
  const svgW = 480;
  const svgH = Math.max(300, levels.length * 80 + 60);
  const rowH = (svgH - 40) / Math.max(1, levels.length);

  const positions: Record<string, { x: number; y: number }> = {};
  levels.forEach((level, li) => {
    const orgs = byLevel[level];
    const y = 30 + li * rowH + rowH / 2;
    orgs.forEach((org, oi) => {
      positions[org] = { x: (svgW / (orgs.length + 1)) * (oi + 1), y };
    });
  });

  const arrows: Array<{ from: string; to: string }> = [];
  levels.forEach((level, li) => {
    if (li >= levels.length - 1) return;
    const consumers = byLevel[level] ?? [];
    const prey = byLevel[levels[li + 1]] ?? [];
    consumers.forEach(c => prey.forEach(p => arrows.push({ from: p, to: c })));
  });

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: 520, display: 'block', margin: '0 auto' }}>
      <defs>
        <marker id="arrow-fw" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" opacity={0.6} />
        </marker>
      </defs>

      {levels.map((level, li) => (
        <rect key={level} x={0} y={li * rowH + 20} width={svgW} height={rowH}
          fill={levelColors[level] ?? levelColors[1]} opacity={0.5} />
      ))}

      {levels.map((level, li) => (
        <text key={`label-${level}`} x={svgW - 8}
          y={li * rowH + 20 + rowH / 2 + 5} textAnchor="end"
          fontSize={9} fill="hsl(var(--muted-foreground))" opacity={0.7}>
          {levelLabels[level]}
        </text>
      ))}

      {arrows.map((arrow, i) => {
        const from = positions[arrow.from];
        const to = positions[arrow.to];
        if (!from || !to) return null;
        return (
          <line key={i} x1={from.x} y1={from.y - 18} x2={to.x} y2={to.y + 18}
            stroke="hsl(var(--foreground))" strokeWidth={1.5} opacity={0.5}
            markerEnd="url(#arrow-fw)" />
        );
      })}

      {Object.entries(positions).map(([org, { x, y }]) => {
        const level = assigned.find(a => a.org === org)?.level ?? 1;
        const label = org.charAt(0).toUpperCase() + org.slice(1);
        const boxW = Math.max(60, label.length * 7.5 + 16);
        return (
          <g key={org}>
            <rect x={x - boxW / 2} y={y - 16} width={boxW} height={32} rx={6}
              fill={levelColors[level] ?? 'hsl(var(--card))'}
              stroke="hsl(var(--border))" strokeWidth={1.5} />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={11}
              fontWeight={500} fill="hsl(var(--foreground))">{label}</text>
          </g>
        );
      })}

      <text x={8} y={svgH - 8} fontSize={9} fill="hsl(var(--muted-foreground))">
        Arrows show direction of energy flow
      </text>
    </svg>
  );
};

export default FoodWebDiagram;
