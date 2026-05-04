import React from 'react';
import type { BiologyDiagramConfig } from '../types';

interface Props { config: BiologyDiagramConfig; }

export const PunnettSquareDiagram: React.FC<Props> = ({ config }) => {
  const {
    crossType = 'monohybrid',
    parent1 = 'Aa',
    parent2 = 'Aa',
    dominantTrait = 'dominant',
    recessiveTrait = 'recessive',
  } = config;

  const isDihybrid = crossType === 'dihybrid';
  const isXLinked = crossType === 'x_linked';

  const getGametes = (genotype: string): string[] => {
    if (isDihybrid) {
      const alleles = genotype.match(/[A-Za-z]/g) ?? ['A', 'a', 'B', 'b'];
      const [A1 = 'A', A2 = 'a', B1 = 'B', B2 = 'b'] = alleles;
      return [`${A1}${B1}`, `${A1}${B2}`, `${A2}${B1}`, `${A2}${B2}`];
    }
    if (isXLinked) {
      const allele = genotype.replace(/[XY]/g, '').charAt(0) || 'A';
      if (genotype.includes('Y')) return ['X', 'Y'];
      return [`X${allele}`, `X${allele.toLowerCase()}`];
    }
    return [genotype.charAt(0), genotype.charAt(1) || genotype.charAt(0).toLowerCase()];
  };

  const topGametes = getGametes(parent1);
  const sideGametes = getGametes(parent2);

  const gridSize = isDihybrid ? 4 : 2;
  const cellSize = isDihybrid ? 68 : 90;
  const marginX = 80;
  const marginY = 80;
  const svgW = marginX + (gridSize + 1) * cellSize + 60;
  const svgH = marginY + (gridSize + 1) * cellSize + 120;

  const offspring = sideGametes.map(sg =>
    topGametes.map(tg =>
      (tg + sg).split('').sort((a, b) => {
        if (a.toUpperCase() === b.toUpperCase()) return a === a.toUpperCase() ? -1 : 1;
        return a.toUpperCase().localeCompare(b.toUpperCase());
      }).join('')
    )
  );

  const isDominant = (genotype: string): boolean => /[A-Z]/.test(genotype.replace(/[XY]/g, ''));

  const flat = offspring.flat();
  const dominantCount = flat.filter(g => isDominant(g)).length;
  const recessiveCount = flat.length - dominantCount;
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const g = Math.max(1, gcd(dominantCount, recessiveCount));
  const ratioStr = recessiveCount === 0 ? 'All dominant'
    : dominantCount === 0 ? 'All recessive'
    : `${dominantCount / g} dominant : ${recessiveCount / g} recessive`;

  const genotypeCounts = isDihybrid ? {} : flat.reduce((acc, gt) => {
    acc[gt] = (acc[gt] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: isDihybrid ? 560 : 380, display: 'block', margin: '0 auto' }}>
      <text x={marginX + cellSize * 1.5} y={30} textAnchor="middle" fontSize={14} fontWeight={600}
        fill="hsl(var(--foreground))">{parent1}</text>
      <text x={40} y={marginY + cellSize * 1.5} textAnchor="middle" fontSize={14} fontWeight={600}
        fill="hsl(var(--foreground))"
        transform={`rotate(-90, 40, ${marginY + cellSize * 1.5})`}>{parent2}</text>

      {topGametes.map((gm, i) => (
        <text key={`top-${i}`} x={marginX + cellSize * (i + 1) + cellSize / 2}
          y={marginY - 10} textAnchor="middle" fontSize={13} fontWeight={500}
          fill="hsl(var(--primary))">{gm}</text>
      ))}
      {sideGametes.map((gm, i) => (
        <text key={`side-${i}`} x={marginX - 10}
          y={marginY + cellSize * (i + 1) + cellSize / 2 + 5}
          textAnchor="end" fontSize={13} fontWeight={500}
          fill="hsl(var(--primary))">{gm}</text>
      ))}

      {offspring.map((row, ri) =>
        row.map((genotype, ci) => {
          const cellX = marginX + cellSize * (ci + 1);
          const cellY = marginY + cellSize * ri;
          const dominant = isDominant(genotype);
          return (
            <g key={`${ri}-${ci}`}>
              <rect x={cellX} y={cellY} width={cellSize} height={cellSize}
                fill={dominant ? 'hsl(var(--primary)/0.08)' : 'hsl(var(--muted)/0.4)'}
                stroke="hsl(var(--border))" strokeWidth={1.5} />
              <text x={cellX + cellSize / 2} y={cellY + cellSize / 2 + 5}
                textAnchor="middle" fontSize={isDihybrid ? 11 : 14}
                fontWeight={dominant ? 600 : 400} fill="hsl(var(--foreground))">
                {genotype}
              </text>
            </g>
          );
        })
      )}

      <rect x={marginX + cellSize} y={marginY}
        width={cellSize * gridSize} height={cellSize * gridSize}
        fill="none" stroke="hsl(var(--foreground))" strokeWidth={2} />

      <text x={svgW / 2} y={marginY + cellSize * gridSize + 32}
        textAnchor="middle" fontSize={12} fontWeight={600} fill="hsl(var(--foreground))">
        Phenotype ratio: {ratioStr}
      </text>

      {!isDihybrid && (
        <text x={svgW / 2} y={marginY + cellSize * gridSize + 52}
          textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
          Genotypes: {Object.entries(genotypeCounts).map(([gt, c]) => `${c} ${gt}`).join(' : ')}
        </text>
      )}

      <rect x={marginX + cellSize} y={marginY + cellSize * gridSize + 68}
        width={14} height={14} rx={2}
        fill="hsl(var(--primary)/0.08)" stroke="hsl(var(--border))" strokeWidth={1} />
      <text x={marginX + cellSize + 20} y={marginY + cellSize * gridSize + 80}
        fontSize={11} fill="hsl(var(--muted-foreground))">
        {dominantTrait} (dominant)
      </text>
      <rect x={marginX + cellSize + 140} y={marginY + cellSize * gridSize + 68}
        width={14} height={14} rx={2}
        fill="hsl(var(--muted)/0.4)" stroke="hsl(var(--border))" strokeWidth={1} />
      <text x={marginX + cellSize + 160} y={marginY + cellSize * gridSize + 80}
        fontSize={11} fill="hsl(var(--muted-foreground))">
        {recessiveTrait} (recessive)
      </text>
    </svg>
  );
};

export default PunnettSquareDiagram;
