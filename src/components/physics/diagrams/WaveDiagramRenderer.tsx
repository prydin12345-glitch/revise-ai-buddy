import type { WaveDiagramConfig } from '../types';

interface Props { config: WaveDiagramConfig; }

const C = {
  axis: 'hsl(var(--muted-foreground))',
  wave1: 'hsl(221 83% 53%)',
  wave2: 'hsl(0 84% 60%)',
  result: 'hsl(262 83% 58%)',
  label: 'hsl(var(--foreground))',
  dim: 'hsl(var(--muted-foreground))',
};

const sinePath = (
  amp: number, wl: number, w: number, h: number,
  cx: number, cy: number, phase = 0,
): string => {
  const pts: string[] = [];
  const n = 200;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const k = (2 * Math.PI) / wl;
    const y = cy - amp * Math.sin(k * (x - cx) + phase);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(' ');
  void h;
};

export const WaveDiagramRenderer = ({ config }: Props) => {
  const W = 520, H = 280;
  const cx = 40, cy = H / 2;
  const w = W - 80;
  const amp = 60;
  const wl = w / 2.5;
  const { variant, harmonicNumber = 1, phaseShift = 0, title } = config;

  if (variant === 'longitudinal') {
    const dots: { x: number; y: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const compression = 1 + 0.7 * Math.sin(2 * Math.PI * 3 * t);
      const x = 40 + t * w + compression * 4;
      dots.push({ x, y: cy });
    }
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.label}>{title}</text>}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={3} fill={C.wave1} />
        ))}
        <text x={120} y={cy + 50} fontSize={10} fill={C.dim}>Compression</text>
        <text x={300} y={cy + 50} fontSize={10} fill={C.dim}>Rarefaction</text>
      </svg>
    );
  }

  if (variant === 'standing_wave') {
    const n = harmonicNumber;
    const len = w;
    const path: string[] = [];
    const pts = 200;
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * len;
      const env = Math.sin((n * Math.PI * x) / len);
      path.push(`${i === 0 ? 'M' : 'L'} ${cx + x} ${cy - amp * env}`);
    }
    const pathNeg: string[] = [];
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * len;
      const env = Math.sin((n * Math.PI * x) / len);
      pathNeg.push(`${i === 0 ? 'M' : 'L'} ${cx + x} ${cy + amp * env}`);
    }
    const nodes: number[] = [];
    for (let k = 0; k <= n; k++) nodes.push(cx + (k * len) / n);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.label}>{title}</text>}
        <line x1={cx} y1={cy} x2={cx + len} y2={cy} stroke={C.axis} strokeDasharray="4 3" />
        <path d={path.join(' ')} stroke={C.wave1} strokeWidth={2} fill="none" />
        <path d={pathNeg.join(' ')} stroke={C.wave1} strokeWidth={2} fill="none"
          strokeDasharray="4 3" opacity={0.6} />
        {nodes.map((nx, i) => (
          <g key={i}>
            <circle cx={nx} cy={cy} r={4} fill={C.wave2} />
            {config.showNodeLabels && <text x={nx} y={cy + 22} textAnchor="middle"
              fontSize={10} fill={C.dim}>N</text>}
          </g>
        ))}
      </svg>
    );
  }

  if (variant === 'superposition') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.label}>{title}</text>}
        <line x1={cx} y1={cy} x2={cx + w} y2={cy} stroke={C.axis} strokeDasharray="4 3" />
        <path d={sinePath(amp * 0.5, wl, w, H, cx, cy)}
          stroke={C.wave1} strokeWidth={1.5} fill="none" />
        <path d={sinePath(amp * 0.5, wl, w, H, cx, cy, phaseShift)}
          stroke={C.wave2} strokeWidth={1.5} fill="none" />
        {(() => {
          const pts: string[] = [];
          const n = 200;
          for (let i = 0; i <= n; i++) {
            const x = (i / n) * w;
            const k = (2 * Math.PI) / wl;
            const y = cy - amp * 0.5 * Math.sin(k * x) - amp * 0.5 * Math.sin(k * x + phaseShift);
            pts.push(`${i === 0 ? 'M' : 'L'} ${cx + x} ${y}`);
          }
          return <path d={pts.join(' ')} stroke={C.result} strokeWidth={2.5} fill="none" />;
        })()}
        <text x={W - 90} y={40} fontSize={10} fill={C.wave1}>Wave 1</text>
        <text x={W - 90} y={54} fontSize={10} fill={C.wave2}>Wave 2</text>
        <text x={W - 90} y={68} fontSize={10} fill={C.result}>Resultant</text>
      </svg>
    );
  }

  if (variant === 'diffraction') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.label}>{title}</text>}
        {[0,1,2,3,4].map(i => (
          <line key={i} x1={60 + i * 30} y1={50} x2={60 + i * 30} y2={H - 40}
            stroke={C.wave1} strokeWidth={1.5} />
        ))}
        <line x1={W/2 - 60} y1={cy - 40} x2={W/2 - 60} y2={cy - 5}
          stroke={C.label} strokeWidth={3} />
        <line x1={W/2 - 60} y1={cy + 5} x2={W/2 - 60} y2={cy + 40}
          stroke={C.label} strokeWidth={3} />
        {[0,1,2,3,4,5].map(i => (
          <path key={i}
            d={`M ${W/2 - 60} ${cy} a ${30 + i * 25} ${30 + i * 25} 0 0 1 ${(30 + i * 25) * 2} 0`}
            stroke={C.wave2} strokeWidth={1.5} fill="none" />
        ))}
        <text x={cx} y={H - 10} fontSize={10} fill={C.dim}>Plane wavefronts</text>
        <text x={W - 130} y={H - 10} fontSize={10} fill={C.dim}>Circular wavefronts</text>
      </svg>
    );
  }

  if (variant === 'doppler') {
    const sx = W / 2;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.label}>{title}</text>}
        <circle cx={sx} cy={cy} r={6} fill={C.label} />
        {[1,2,3,4].map(i => (
          <ellipse key={i} cx={sx + i * 8} cy={cy} rx={i * 25} ry={i * 25}
            stroke={C.wave1} fill="none" strokeWidth={1.5} />
        ))}
        <text x={40} y={cy + 100} fontSize={10} fill={C.dim}>Lower frequency</text>
        <text x={W - 130} y={cy + 100} fontSize={10} fill={C.dim}>Higher frequency</text>
      </svg>
    );
  }

  // Default transverse / interference
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
        fontWeight={700} fill={C.label}>{title}</text>}
      <line x1={cx} y1={cy} x2={cx + w} y2={cy} stroke={C.axis} strokeDasharray="4 3" />
      <path d={sinePath(amp, wl, w, H, cx, cy)}
        stroke={C.wave1} strokeWidth={2.5} fill="none" />
      {config.showAmplitudeLabel && (
        <>
          <line x1={cx + wl/4} y1={cy} x2={cx + wl/4} y2={cy - amp}
            stroke={C.dim} strokeDasharray="3 2" />
          <text x={cx + wl/4 + 6} y={cy - amp/2}
            fontSize={10} fill={C.dim}>amplitude</text>
        </>
      )}
      {config.showWavelengthLabel && (
        <>
          <line x1={cx} y1={cy + amp + 20} x2={cx + wl} y2={cy + amp + 20}
            stroke={C.dim} markerStart="url(#wL)" markerEnd="url(#wR)" />
          <text x={cx + wl/2} y={cy + amp + 36}
            textAnchor="middle" fontSize={10} fill={C.dim}>wavelength λ</text>
          <defs>
            <marker id="wL" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
              <polygon points="6 0, 0 3, 6 6" fill={C.dim} />
            </marker>
            <marker id="wR" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill={C.dim} />
            </marker>
          </defs>
        </>
      )}
    </svg>
  );
};

export default WaveDiagramRenderer;
