import React from 'react';
import type { BiologyDiagramConfig } from '../types';
import { monohybridCross } from '@/lib/biology-assessment-resources';

interface Props { config: BiologyDiagramConfig; mode?: 'assessment' | 'solution'; }

/** Saved data cannot opt a student into seeing a worked solution. */
export const PunnettSquareDiagram: React.FC<Props> = ({ config, mode = 'assessment' }) => {
  const cross = (!config.crossType || config.crossType === 'monohybrid') && monohybridCross(config.parent1, config.parent2);
  if (!cross) return <p role="alert">This genetic diagram needs valid parent genotypes.</p>;
  const solved = mode === 'solution';
  const showGametes = solved || config.showGametes === true;
  const left = 125, top = 115, cell = 85;
  return (
    <svg viewBox={`0 0 360 ${solved ? 375 : 315}`} width="100%" role="img"
      aria-label={solved ? 'Worked monohybrid cross' : 'Blank Punnett square'}
      style={{maxWidth: 440, display: 'block', margin: '0 auto', background: '#fff', color: '#172033', fontFamily:'Arial, sans-serif'}}>
      <title>{solved ? 'Worked monohybrid cross' : 'Punnett square response scaffold'}</title>
      <rect width={360} height={solved ? 375 : 315} fill="#fff" aria-hidden="true"/>
      <text x={210} y={35} textAnchor="middle" fontSize={15} fill="#172033">Parent 1: {config.parent1}</text>
      <text x={25} y={75} fontSize={15} fill="#172033">Parent 2: {config.parent2}</text>
      {cross.top.map((gamete, i) => <text key={`top-${i}`} x={left + cell * (i + .5)} y={95}
        textAnchor="middle" fontSize={17} fill="#172033">{showGametes ? gamete : '____'}</text>)}
      {cross.side.map((gamete, i) => <text key={`side-${i}`} x={95} y={top + cell * (i + .5) + 6}
        textAnchor="middle" fontSize={17} fill="#172033">{showGametes ? gamete : '____'}</text>)}
      {cross.offspring.map((row, ri) => row.map((genotype, ci) => (
        <g key={`${ri}-${ci}`}>
          <rect x={left + cell * ci} y={top + cell * ri} width={cell} height={cell}
            fill="#fff" stroke="#475569" strokeWidth={1.5} />
          {solved && <text x={left + cell * (ci + .5)} y={top + cell * (ri + .5) + 6}
            textAnchor="middle" fontSize={18} fill="#172033">{genotype}</text>}
        </g>
      )))}
      {solved && <>
        <text x={180} y={317} textAnchor="middle" fontSize={13} fill="#172033">
          Dominant : recessive = {cross.ratio}
        </text>
        <text x={180} y={342} textAnchor="middle" fontSize={13} fill="#172033">
          {cross.dominantPercent}% dominant; {cross.recessivePercent}% recessive
        </text>
      </>}
    </svg>
  );
};

export default PunnettSquareDiagram;
