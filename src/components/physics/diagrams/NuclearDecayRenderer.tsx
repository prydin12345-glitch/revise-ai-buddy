import type { NuclearDecayConfig } from '../types';

interface Props { config: NuclearDecayConfig; }

const C = {
  parent: 'hsl(221 83% 53%)',
  daughter: 'hsl(142 71% 45%)',
  particle: 'hsl(0 84% 60%)',
  body: 'hsl(var(--foreground))',
  dim: 'hsl(var(--muted-foreground))',
};

const nucleus = (
  x: number, y: number, symbol: string,
  mass?: number, atomic?: number, fill = C.parent,
) => (
  <g>
    <circle cx={x} cy={y} r={28} fill={fill} opacity={0.85} />
    {mass !== undefined && (
      <text x={x - 32} y={y - 8} fontSize={11} textAnchor="end" fill={C.body}>{mass}</text>
    )}
    {atomic !== undefined && (
      <text x={x - 32} y={y + 10} fontSize={11} textAnchor="end" fill={C.body}>{atomic}</text>
    )}
    <text x={x} y={y + 5} textAnchor="middle" fontSize={16}
      fontWeight={700} fill="white">{symbol}</text>
  </g>
);

export const NuclearDecayRenderer = ({ config }: Props) => {
  const W = 520, H = 260;
  const cy = H / 2;
  const {
    variant,
    parentSymbol = 'X', parentMassNumber, parentAtomicNumber,
    title,
  } = config;

  // Calculate daughter and particle by decay type
  let daughterSymbol = config.daughterSymbol ?? '?';
  let daughterMass = config.daughterMassNumber ?? parentMassNumber;
  let daughterZ = config.daughterAtomicNumber ?? parentAtomicNumber;
  let particleLabel = '';
  let particleMass = 0;
  let particleZ = 0;

  if (variant === 'alpha_decay') {
    if (parentMassNumber) daughterMass = parentMassNumber - 4;
    if (parentAtomicNumber) daughterZ = parentAtomicNumber - 2;
    particleLabel = 'α';
    particleMass = 4; particleZ = 2;
  } else if (variant === 'beta_minus_decay') {
    if (parentMassNumber) daughterMass = parentMassNumber;
    if (parentAtomicNumber) daughterZ = parentAtomicNumber + 1;
    particleLabel = 'β⁻';
    particleZ = -1;
  } else if (variant === 'beta_plus_decay') {
    if (parentMassNumber) daughterMass = parentMassNumber;
    if (parentAtomicNumber) daughterZ = parentAtomicNumber - 1;
    particleLabel = 'β⁺';
    particleZ = 1;
  } else if (variant === 'gamma_decay') {
    particleLabel = 'γ';
  }

  if (variant === 'fission') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.body}>{title}</text>}
        <circle cx={60} cy={cy} r={6} fill={C.particle} />
        <text x={60} y={cy + 22} textAnchor="middle" fontSize={10} fill={C.dim}>n</text>
        {nucleus(170, cy, parentSymbol, parentMassNumber, parentAtomicNumber)}
        <line x1={205} y1={cy} x2={290} y2={cy - 60}
          stroke={C.body} strokeWidth={1.5} markerEnd="url(#nArr)" />
        <line x1={205} y1={cy} x2={290} y2={cy + 60}
          stroke={C.body} strokeWidth={1.5} markerEnd="url(#nArr)" />
        {nucleus(330, cy - 60, 'Ba', 141, 56, C.daughter)}
        {nucleus(330, cy + 60, 'Kr', 92, 36, C.daughter)}
        {[420, 440, 460].map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={cy + (i - 1) * 30} r={5} fill={C.particle} />
            <text x={x} y={cy + (i - 1) * 30 + 18} textAnchor="middle" fontSize={9} fill={C.dim}>n</text>
          </g>
        ))}
        <defs>
          <marker id="nArr" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill={C.body} />
          </marker>
        </defs>
      </svg>
    );
  }

  if (variant === 'fusion') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.body}>{title}</text>}
        {nucleus(120, cy - 50, 'H', 2, 1)}
        {nucleus(120, cy + 50, 'H', 3, 1)}
        <line x1={160} y1={cy - 30} x2={260} y2={cy - 5}
          stroke={C.body} strokeWidth={1.5} />
        <line x1={160} y1={cy + 30} x2={260} y2={cy + 5}
          stroke={C.body} strokeWidth={1.5} />
        {nucleus(310, cy, 'He', 4, 2, C.daughter)}
        <circle cx={420} cy={cy - 20} r={6} fill={C.particle} />
        <text x={420} y={cy - 30} textAnchor="middle" fontSize={10} fill={C.dim}>n</text>
        <text x={420} y={cy + 20} textAnchor="middle" fontSize={11} fill={C.body}>+ energy</text>
      </svg>
    );
  }

  // Default: nuclear equation form
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
        fontWeight={700} fill={C.body}>{title}</text>}
      {nucleus(110, cy, parentSymbol, parentMassNumber, parentAtomicNumber)}
      <line x1={150} y1={cy} x2={230} y2={cy} stroke={C.body} strokeWidth={1.5}
        markerEnd="url(#decayArr)" />
      {nucleus(280, cy, daughterSymbol, daughterMass, daughterZ, C.daughter)}
      <text x={345} y={cy + 5} fontSize={20} fill={C.body}>+</text>
      {particleLabel && (
        <g>
          <circle cx={400} cy={cy} r={22} fill={C.particle} opacity={0.85} />
          {particleMass > 0 && (
            <text x={372} y={cy - 6} fontSize={11} textAnchor="end" fill={C.body}>{particleMass}</text>
          )}
          {particleZ !== 0 && (
            <text x={372} y={cy + 12} fontSize={11} textAnchor="end" fill={C.body}>{particleZ}</text>
          )}
          <text x={400} y={cy + 6} textAnchor="middle" fontSize={16}
            fontWeight={700} fill="white">{particleLabel}</text>
        </g>
      )}
      <defs>
        <marker id="decayArr" markerWidth={8} markerHeight={6} refX={6} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={C.body} />
        </marker>
      </defs>
    </svg>
  );
};

export default NuclearDecayRenderer;
