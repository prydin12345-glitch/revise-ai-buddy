import React from 'react';
import type { BiologyDiagramConfig } from '../types';

interface Props { config: BiologyDiagramConfig; }

export const EnzymeSubstrateDiagram: React.FC<Props> = ({ config }) => {
  const model = config.model ?? 'lock_and_key';
  const hasInhibitor = config.hasInhibitor ?? false;
  const inhibitorType = config.inhibitorType ?? 'competitive';
  const isInducedFit = model === 'induced_fit';

  const svgW = hasInhibitor ? 560 : 420;
  const svgH = 280;

  const steps = hasInhibitor
    ? ['Free enzyme\n+ substrate', 'Inhibitor\nblocks', 'No product\nformed']
    : ['Enzyme\n+ substrate', 'Enzyme-substrate\ncomplex', 'Products\nreleased'];

  const stepX = [80, 230, hasInhibitor ? 420 : 370];
  const centerY = 130;
  const enzymeColor = 'hsl(221 83% 53% / 0.3)';
  const substrateColor = 'hsl(142 71% 45% / 0.3)';
  const inhibitorColor = 'hsl(0 84% 60% / 0.3)';

  const drawEnzyme = (cx: number, cy: number, open: boolean) => (
    <g>
      <path
        d={open
          ? `M ${cx - 28} ${cy - 22} Q ${cx - 36} ${cy + 10} ${cx - 28} ${cy + 22} Q ${cx} ${cy + 38} ${cx + 28} ${cy + 22} Q ${cx + 36} ${cy + 10} ${cx + 28} ${cy - 22}`
          : `M ${cx - 28} ${cy - 22} Q ${cx - 36} ${cy + 10} ${cx - 28} ${cy + 22} Q ${cx} ${cy + 32} ${cx + 28} ${cy + 22} Q ${cx + 36} ${cy + 10} ${cx + 28} ${cy - 22}`}
        fill={enzymeColor} stroke="hsl(221 83% 53%)" strokeWidth={2} />
      <text x={cx - 38} y={cy - 30} fontSize={11} fontWeight={600} fill="hsl(221 83% 53%)">Enzyme</text>
      {!open && (
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">active site</text>
      )}
    </g>
  );

  const drawSubstrate = (cx: number, cy: number, inside = false) => (
    <g>
      <ellipse cx={cx} cy={inside ? cy + 8 : cy} rx={22} ry={16}
        fill={substrateColor} stroke="hsl(142 71% 45%)" strokeWidth={1.5} />
      <text x={cx} y={(inside ? cy + 8 : cy) + 5} textAnchor="middle" fontSize={10} fill="hsl(142 71% 45%)">S</text>
      {!inside && (
        <text x={cx} y={cy - 24} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(142 71% 45%)">Substrate</text>
      )}
    </g>
  );

  const drawInhibitor = (cx: number, cy: number) => (
    <g>
      <polygon points={`${cx},${cy - 18} ${cx + 20},${cy + 10} ${cx - 20},${cy + 10}`}
        fill={inhibitorColor} stroke="hsl(0 84% 60%)" strokeWidth={1.5} />
      <text x={cx} y={cy - 28} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(0 84% 60%)">Inhibitor</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}>
      {drawEnzyme(stepX[0], centerY, true)}
      {drawSubstrate(stepX[0] + 56, centerY - 20)}

      <defs>
        <marker id="arr-enz" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" />
        </marker>
      </defs>
      <line x1={stepX[0] + 80} y1={centerY} x2={stepX[1] - 52} y2={centerY}
        stroke="hsl(var(--foreground))" strokeWidth={1.5} markerEnd="url(#arr-enz)" />

      {hasInhibitor && inhibitorType === 'competitive' ? (
        <g>{drawEnzyme(stepX[1], centerY, false)}{drawInhibitor(stepX[1], centerY - 10)}</g>
      ) : hasInhibitor ? (
        <g>{drawEnzyme(stepX[1], centerY, false)}{drawSubstrate(stepX[1], centerY + 8, true)}{drawInhibitor(stepX[1] + 48, centerY)}</g>
      ) : (
        <g>{drawEnzyme(stepX[1], centerY, false)}{drawSubstrate(stepX[1], centerY + 8, true)}</g>
      )}

      <line x1={stepX[1] + 60} y1={centerY} x2={stepX[2] - 42} y2={centerY}
        stroke="hsl(var(--foreground))" strokeWidth={1.5} markerEnd="url(#arr-enz)" />

      {hasInhibitor ? (
        <g>
          {drawEnzyme(stepX[2], centerY, true)}
          <text x={stepX[2]} y={centerY - 40} textAnchor="middle" fontSize={11} fill="hsl(0 84% 60%)">No reaction</text>
          <text x={stepX[2]} y={centerY + 50} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
            {inhibitorType === 'competitive' ? 'Active site blocked' : 'Shape changed'}
          </text>
        </g>
      ) : (
        <g>
          {drawEnzyme(stepX[2], centerY, true)}
          <ellipse cx={stepX[2] + 48} cy={centerY - 16} rx={16} ry={10}
            fill="hsl(25 95% 53% / 0.3)" stroke="hsl(25 95% 53%)" strokeWidth={1.5} />
          <text x={stepX[2] + 48} y={centerY - 13} textAnchor="middle" fontSize={9} fill="hsl(25 95% 53%)">P</text>
          <ellipse cx={stepX[2] + 50} cy={centerY + 16} rx={16} ry={10}
            fill="hsl(25 95% 53% / 0.3)" stroke="hsl(25 95% 53%)" strokeWidth={1.5} />
          <text x={stepX[2] + 50} y={centerY + 19} textAnchor="middle" fontSize={9} fill="hsl(25 95% 53%)">P</text>
          <text x={stepX[2] + 56} y={centerY - 32} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(25 95% 53%)">Products</text>
        </g>
      )}

      {steps.map((step, i) => (
        <text key={i} x={stepX[i]} y={svgH - 18} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
          {step.split('\n').map((line, li) => (
            <tspan key={li} x={stepX[i]} dy={li === 0 ? 0 : 14}>{line}</tspan>
          ))}
        </text>
      ))}

      <text x={svgW / 2} y={18} textAnchor="middle" fontSize={12} fontWeight={700} fill="hsl(var(--foreground))">
        {isInducedFit ? 'Induced Fit Model' : 'Lock and Key Model'}
      </text>

      {isInducedFit && (
        <text x={svgW / 2} y={svgH - 6} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
          Active site changes shape to fit substrate
        </text>
      )}
    </svg>
  );
};

export default EnzymeSubstrateDiagram;
