import type { EMSpectrumConfig } from '../types';

interface Props { config: EMSpectrumConfig; }

const REGIONS = [
  { id: 'radio', label: 'Radio', wl: '> 0.1 m', color: '#7C3AED' },
  { id: 'microwave', label: 'Micro', wl: '10⁻³ m', color: '#5B21B6' },
  { id: 'infrared', label: 'IR', wl: '10⁻⁵ m', color: '#DC2626' },
  { id: 'visible', label: 'Visible', wl: '10⁻⁷ m', color: 'linear' },
  { id: 'ultraviolet', label: 'UV', wl: '10⁻⁸ m', color: '#7C3AED' },
  { id: 'xray', label: 'X-ray', wl: '10⁻¹⁰ m', color: '#0891B2' },
  { id: 'gamma', label: 'Gamma', wl: '< 10⁻¹² m', color: '#0E7490' },
];

export const EMSpectrumRenderer = ({ config }: Props) => {
  const W = 560, H = 220;
  const padX = 40;
  const bandW = (W - padX * 2) / REGIONS.length;
  const bandY = 60, bandH = 60;
  const C = {
    body: 'hsl(var(--foreground))',
    dim: 'hsl(var(--muted-foreground))',
  };
  const { highlightRegion, title } = config;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      {title && <text x={W/2} y={22} textAnchor="middle" fontSize={12}
        fontWeight={700} fill={C.body}>{title}</text>}
      <defs>
        <linearGradient id="visGrad" x1="0" x2="1">
          <stop offset="0%" stopColor="#FF0000" />
          <stop offset="20%" stopColor="#FF7700" />
          <stop offset="40%" stopColor="#FFFF00" />
          <stop offset="60%" stopColor="#00CC00" />
          <stop offset="80%" stopColor="#0000FF" />
          <stop offset="100%" stopColor="#7700AA" />
        </linearGradient>
      </defs>
      {REGIONS.map((r, i) => {
        const x = padX + i * bandW;
        const isHighlight = highlightRegion === r.id;
        const fill = r.color === 'linear' ? 'url(#visGrad)' : r.color;
        return (
          <g key={r.id}>
            <rect x={x} y={bandY} width={bandW - 2} height={bandH}
              fill={fill}
              opacity={isHighlight ? 1 : 0.85}
              stroke={isHighlight ? C.body : 'none'}
              strokeWidth={isHighlight ? 2 : 0} />
            <text x={x + bandW/2} y={bandY + bandH + 16}
              textAnchor="middle" fontSize={10}
              fontWeight={isHighlight ? 700 : 400}
              fill={C.body}>{r.label}</text>
            {config.showWavelength && (
              <text x={x + bandW/2} y={bandY + bandH + 30}
                textAnchor="middle" fontSize={8} fill={C.dim}>{r.wl}</text>
            )}
          </g>
        );
      })}
      <text x={padX} y={H - 30} fontSize={10} fill={C.dim}>← longer wavelength</text>
      <text x={W - padX} y={H - 30} textAnchor="end" fontSize={10} fill={C.dim}>shorter wavelength →</text>
      <text x={padX} y={H - 14} fontSize={10} fill={C.dim}>← lower frequency</text>
      <text x={W - padX} y={H - 14} textAnchor="end" fontSize={10} fill={C.dim}>higher frequency →</text>
    </svg>
  );
};

export default EMSpectrumRenderer;
