import type { NuclearDecayConfig } from '../types';

interface Props { config: NuclearDecayConfig; }

export const NuclearDecayRenderer = ({ config }: Props) => {
  const {
    variant, parentSymbol, parentMassNumber, parentAtomicNumber,
    daughterSymbol, daughterMassNumber, daughterAtomicNumber,
    showPenetration, title,
  } = config;

  const W = 480, H = 300;
  const colors = {
    parent: 'hsl(221 83% 53%)',
    daughter: 'hsl(142 71% 45%)',
    alpha: 'hsl(0 84% 60%)',
    beta: 'hsl(25 95% 53%)',
    gamma: 'hsl(262 83% 58%)',
    label: 'hsl(var(--foreground))',
    dim: 'hsl(var(--muted-foreground))',
    arrow: 'hsl(var(--foreground))',
  };

  const getDecayProducts = () => {
    const pA = parentMassNumber ?? 0;
    const pZ = parentAtomicNumber ?? 0;

    if (variant === 'alpha_decay') {
      return {
        dA: pA - 4, dZ: pZ - 2,
        particleA: 4, particleZ: 2,
        particleLabel: 'α', particleColor: colors.alpha,
        particleName: 'Alpha particle (⁴₂He)',
      };
    }
    if (variant === 'beta_minus_decay') {
      return {
        dA: pA, dZ: pZ + 1,
        particleA: 0, particleZ: -1,
        particleLabel: 'β⁻', particleColor: colors.beta,
        particleName: 'Beta minus particle (electron)',
      };
    }
    if (variant === 'beta_plus_decay') {
      return {
        dA: pA, dZ: pZ - 1,
        particleA: 0, particleZ: 1,
        particleLabel: 'β⁺', particleColor: colors.beta,
        particleName: 'Beta plus particle (positron)',
      };
    }
    if (variant === 'gamma_decay') {
      return {
        dA: pA, dZ: pZ,
        particleA: 0, particleZ: 0,
        particleLabel: 'γ', particleColor: colors.gamma,
        particleName: 'Gamma ray (high energy photon)',
      };
    }
    return null;
  };

  const decay = getDecayProducts();

  const NuclearSymbol = ({
    x, y, symbol, massNumber, atomicNumber, color,
  }: {
    x: number; y: number; symbol?: string;
    massNumber?: number; atomicNumber?: number; color: string;
  }) => (
    <g>
      <rect x={x - 40} y={y - 30} width={80} height={60}
        fill={`${color}15`}
        stroke={color} strokeWidth={1.5} rx={8} />
      {massNumber !== undefined && (
        <text x={x - 18} y={y - 10} fontSize={12}
          fill={colors.dim}>{massNumber}</text>
      )}
      {atomicNumber !== undefined && (
        <text x={x - 18} y={y + 16} fontSize={12}
          fill={colors.dim}>{atomicNumber}</text>
      )}
      <text x={x + 4} y={y + 8} fontSize={22}
        fontWeight={700} fill={color}>{symbol ?? '?'}</text>
    </g>
  );

  if (showPenetration) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={22} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        <rect x={20} y={80} width={40} height={140}
          fill="hsl(var(--muted)/0.4)"
          stroke="hsl(var(--border))" strokeWidth={2} rx={4} />
        <text x={40} y={160} textAnchor="middle"
          fontSize={11} fill={colors.dim}>Source</text>

        <line x1={60} y1={100} x2={100} y2={100}
          stroke={colors.alpha} strokeWidth={3}
          markerEnd="url(#arrA)" />
        <text x={75} y={92} textAnchor="middle"
          fontSize={11} fontWeight={600} fill={colors.alpha}>α</text>
        <rect x={100} y={82} width={8} height={36}
          fill="hsl(var(--muted)/0.6)"
          stroke="hsl(var(--border))" />
        <text x={104} y={78} textAnchor="middle"
          fontSize={9} fill={colors.dim}>Paper</text>

        <line x1={60} y1={150} x2={180} y2={150}
          stroke={colors.beta} strokeWidth={2}
          markerEnd="url(#arrB)" />
        <text x={120} y={142} textAnchor="middle"
          fontSize={11} fontWeight={600} fill={colors.beta}>β</text>
        <rect x={180} y={130} width={12} height={40}
          fill="hsl(var(--muted)/0.6)"
          stroke="hsl(var(--border))" />
        <text x={186} y={126} textAnchor="middle"
          fontSize={9} fill={colors.dim}>Al</text>

        <line x1={60} y1={200} x2={320} y2={200}
          stroke={colors.gamma} strokeWidth={2}
          strokeDasharray="none" markerEnd="url(#arrG)" />
        <text x={190} y={192} textAnchor="middle"
          fontSize={11} fontWeight={600} fill={colors.gamma}>γ</text>
        <rect x={320} y={180} width={20} height={40}
          fill="hsl(var(--muted))"
          stroke="hsl(var(--border))" />
        <text x={330} y={176} textAnchor="middle"
          fontSize={9} fill={colors.dim}>Pb</text>

        <text x={420} y={100} fontSize={10}
          fill={colors.alpha}>α: ~5cm air</text>
        <text x={420} y={150} fontSize={10}
          fill={colors.beta}>β: ~3mm Al</text>
        <text x={420} y={200} fontSize={10}
          fill={colors.gamma}>γ: cm of Pb</text>

        <defs>
          {([
            ['arrA', colors.alpha],
            ['arrB', colors.beta],
            ['arrG', colors.gamma],
          ] as const).map(([id, color]) => (
            <marker key={id} id={id} markerWidth={8}
              markerHeight={6} refX={7} refY={3} orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={color} />
            </marker>
          ))}
        </defs>
      </svg>
    );
  }

  if (variant === 'fission') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={22} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        <line x1={20} y1={H/2} x2={140} y2={H/2}
          stroke={colors.dim} strokeWidth={2}
          markerEnd="url(#arrN)" />
        <text x={80} y={H/2 - 10} textAnchor="middle"
          fontSize={11} fill={colors.dim}>neutron</text>

        <circle cx={180} cy={H/2} r={40}
          fill={`${colors.parent}20`}
          stroke={colors.parent} strokeWidth={2} />
        <text x={180} y={H/2 + 6} textAnchor="middle"
          fontSize={14} fontWeight={700}
          fill={colors.parent}>{parentSymbol ?? 'U'}</text>
        <text x={180} y={H/2 - 20} textAnchor="middle"
          fontSize={10} fill={colors.dim}>
          {parentMassNumber ?? 235}
        </text>

        <text x={240} y={H/2 + 8} fontSize={24}
          fill={colors.dim}>→</text>

        <circle cx={320} cy={H/2 - 40} r={28}
          fill={`${colors.daughter}20`}
          stroke={colors.daughter} strokeWidth={2} />
        <text x={320} y={H/2 - 34} textAnchor="middle"
          fontSize={13} fontWeight={700}
          fill={colors.daughter}>Kr</text>

        <circle cx={320} cy={H/2 + 40} r={32}
          fill={`${colors.alpha}20`}
          stroke={colors.alpha} strokeWidth={2} />
        <text x={320} y={H/2 + 46} textAnchor="middle"
          fontSize={13} fontWeight={700}
          fill={colors.alpha}>Ba</text>

        {[0, 1, 2].map(i => (
          <line key={i}
            x1={360} y1={H/2 + (i-1) * 20}
            x2={420} y2={H/2 + (i-1) * 40}
            stroke={colors.dim} strokeWidth={1.5}
            markerEnd="url(#arrN)" />
        ))}
        <text x={440} y={H/2} fontSize={10}
          fill={colors.dim}>neutrons</text>

        <text x={W/2} y={H - 12} textAnchor="middle"
          fontSize={11} fontWeight={600}
          fill="hsl(25 95% 53%)">
          + Energy released (E = mc²)
        </text>

        <defs>
          <marker id="arrN" markerWidth={8} markerHeight={6}
            refX={7} refY={3} orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={colors.dim} />
          </marker>
        </defs>
      </svg>
    );
  }

  const dZ = decay?.dZ ?? (daughterAtomicNumber ?? (parentAtomicNumber ?? 0));
  const dA = decay?.dA ?? (daughterMassNumber ?? (parentMassNumber ?? 0));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>

      {title && <text x={W/2} y={28} textAnchor="middle"
        fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

      <NuclearSymbol
        x={100} y={H/2}
        symbol={parentSymbol ?? 'X'}
        massNumber={parentMassNumber}
        atomicNumber={parentAtomicNumber}
        color={colors.parent}
      />

      <line x1={150} y1={H/2} x2={220} y2={H/2}
        stroke={colors.arrow} strokeWidth={2}
        markerEnd="url(#arrDecay)" />
      <text x={185} y={H/2 - 10} textAnchor="middle"
        fontSize={20} fill={colors.dim}>→</text>

      <NuclearSymbol
        x={300} y={H/2}
        symbol={daughterSymbol ?? 'Y'}
        massNumber={dA || undefined}
        atomicNumber={dZ || undefined}
        color={colors.daughter}
      />

      {decay && (
        <>
          <text x={370} y={H/2 + 8} fontSize={20}
            fill={colors.dim}>+</text>
          <circle cx={420} cy={H/2} r={20}
            fill={`${decay.particleColor}20`}
            stroke={decay.particleColor} strokeWidth={2} />
          <text x={420} y={H/2 + 7} textAnchor="middle"
            fontSize={14} fontWeight={700}
            fill={decay.particleColor}>
            {decay.particleLabel}
          </text>
          <text x={420} y={H/2 + 36} textAnchor="middle"
            fontSize={9} fill={colors.dim}>
            {decay.particleName}
          </text>
        </>
      )}

      {decay && parentMassNumber && (
        <text x={W/2} y={H - 14} textAnchor="middle"
          fontSize={10} fill={colors.dim}>
          Mass number: {parentMassNumber} = {decay.dA} + {decay.particleA} ✓
          {'  '}Atomic number: {parentAtomicNumber} = {decay.dZ} + {decay.particleZ} ✓
        </text>
      )}

      <defs>
        <marker id="arrDecay" markerWidth={8} markerHeight={6}
          refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={colors.arrow} />
        </marker>
      </defs>
    </svg>
  );
};

export default NuclearDecayRenderer;
