import React, { useId } from 'react';
import type { BiologyDiagramConfig } from '../types';
import { biologyDiagramIssues } from '@/lib/biology-assessment-resources';

/** Saved order/links are the science. Layout never supplies feeding relationships. */
export const FoodWebDiagram: React.FC<{config: BiologyDiagramConfig}> = ({config}) => {
  const arrowId = 'food-arrow-' + useId().replace(/:/g, '');
  if (biologyDiagramIssues(config).length) return <p role="alert">This food diagram needs its saved organisms and feeding relationships.</p>;
  const organisms = config.organisms!;
  const chain = config.type === 'food_chain';
  const width = chain ? 420 : 720, rowHeight = 100;
  const height = (chain ? organisms.length : Math.ceil(organisms.length / 3)) * rowHeight + 45;
  const positions = new Map(organisms.map((name, i) => [name, {
    x: chain ? width / 2 : (i % 3) * 240 + 120,
    y: (chain ? i : Math.floor(i / 3)) * rowHeight + 42,
  }]));
  const links = chain ? organisms.slice(1).map((name, i) => ({from: organisms[i], to: name})) : config.feedingLinks!;
  const wrap = (name: string) => name.split(/\s+/).reduce<string[]>((lines, word) => {
    if (!lines.length || (lines[lines.length - 1] + ' ' + word).length > 23) lines.push(word);
    else lines[lines.length - 1] += ' ' + word;
    return lines;
  }, []);
  return <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={chain ? 'Food chain' : 'Food web'}
    style={{background: '#fff', display: 'block', margin: '0 auto', maxWidth: chain ? 440 : 720, fontFamily:'Arial, sans-serif'}}>
    <title>{(chain ? 'Food chain' : 'Food web') + ': arrows point from food to consumer.'}</title>
    <rect width={width} height={height} fill="#fff" aria-hidden="true"/>
    <defs><marker id={arrowId} markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto">
      <path d="M0 0 L8 4 L0 8 Z" fill="#334155" />
    </marker></defs>
    {links.map((link, i) => {
      const a = positions.get(link.from)!, b = positions.get(link.to)!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const edge = Math.min(dx ? 93 / Math.abs(dx) : Infinity, dy ? 27 / Math.abs(dy) : Infinity);
      return <line key={i} x1={a.x + dx * edge} y1={a.y + dy * edge}
        x2={b.x - dx * (edge + .03)} y2={b.y - dy * (edge + .03)}
        stroke="#334155" strokeWidth={2} markerEnd={`url(#${arrowId})`}>
        <title>{link.from + ' → ' + link.to}</title>
      </line>;
    })}
    {organisms.map(name => {
      const p = positions.get(name)!, lines = wrap(name);
      return <g key={name}>
        <rect x={p.x - 93} y={p.y - 27} width={186} height={54} rx={7} fill="#f8fafc" stroke="#475569" />
        <text x={p.x} textAnchor="middle" fill="#172033" fontSize={13}>
          {lines.map((line, i) => <tspan key={i} x={p.x} y={p.y - (lines.length - 1) * 7 + i * 14 + 4}>{line}</tspan>)}
        </text>
      </g>;
    })}
    <text x={width / 2} y={height - 12} textAnchor="middle" fill="#475569" fontSize={12}>Arrows point from food to consumer</text>
  </svg>;
};
export default FoodWebDiagram;
