import type { WaveDiagramConfig } from '../types';

interface Props { config: WaveDiagramConfig; }

export const WaveDiagramRenderer = ({ config }: Props) => {
  const {
    variant, amplitude = 1,
    amplitude2, phaseShift = 0, harmonicNumber = 1,
    showAmplitudeLabel, showWavelengthLabel, showNodeLabels,
    title,
  } = config;

  const W = 480, H = 280;
  const MARGIN = { top: 40, bottom: 40, left: 48, right: 24 };
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;
  const axisY = MARGIN.top + plotH / 2;

  const A = (amplitude / 1.5) * (plotH / 2 - 16);
  const A2 = amplitude2 ? (amplitude2 / 1.5) * (plotH / 2 - 16) : A;
  const cycles = 2;
  const pts = 200;

  const wavePath = (
    ampPx: number,
    phaseOffset = 0,
    startX = MARGIN.left,
    endX = MARGIN.left + plotW,
  ): string => {
    const points: string[] = [];
    for (let i = 0; i <= pts; i++) {
      const x = startX + (endX - startX) * (i / pts);
      const t = (i / pts) * cycles * 2 * Math.PI + phaseOffset;
      const y = axisY - ampPx * Math.sin(t);
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return points.join(' ');
  };

  const colors = {
    axis: 'hsl(var(--muted-foreground))',
    wave1: 'hsl(221 83% 53%)',
    wave2: 'hsl(0 84% 60%)',
    resultant: 'hsl(142 71% 45%)',
    label: 'hsl(var(--foreground))',
    dim: 'hsl(var(--muted-foreground))',
    node: 'hsl(25 95% 53%)',
  };

  if (variant === 'longitudinal') {
    const numParticles = 20;
    const baseSpacing = plotW / numParticles;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={22} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        <line x1={MARGIN.left} y1={axisY - A - 28}
          x2={MARGIN.left + plotW * 0.4} y2={axisY - A - 28}
          stroke={colors.dim} strokeWidth={1.5}
          markerEnd="url(#arrDir)" />
        <text x={MARGIN.left + plotW * 0.2} y={axisY - A - 34}
          textAnchor="middle" fontSize={10}
          fill={colors.dim}>Wave direction →</text>

        {Array.from({ length: numParticles }, (_, i) => {
          const baseX = MARGIN.left + i * baseSpacing + baseSpacing / 2;
          const phase = (i / numParticles) * cycles * 2 * Math.PI;
          const displacement = Math.sin(phase) * baseSpacing * 0.4;
          const particleX = baseX + displacement;
          const isCompression = displacement < -baseSpacing * 0.15;
          const isRarefaction = displacement > baseSpacing * 0.15;

          return (
            <circle key={i}
              cx={particleX} cy={axisY} r={5}
              fill={isCompression ? colors.wave1
                : isRarefaction ? colors.wave2
                : colors.dim}
              opacity={0.8}
            />
          );
        })}

        <text x={MARGIN.left + plotW * 0.18} y={axisY + 30}
          textAnchor="middle" fontSize={10}
          fill={colors.wave1}>Compression</text>
        <text x={MARGIN.left + plotW * 0.55} y={axisY + 30}
          textAnchor="middle" fontSize={10}
          fill={colors.wave2}>Rarefaction</text>

        {showWavelengthLabel && (
          <>
            <line x1={MARGIN.left + 10} y1={axisY + 50}
              x2={MARGIN.left + plotW / 2} y2={axisY + 50}
              stroke={colors.dim} strokeWidth={1.5} />
            <text x={MARGIN.left + plotW / 4} y={axisY + 64}
              textAnchor="middle" fontSize={11}
              fill={colors.dim}>λ (one wavelength)</text>
          </>
        )}

        <defs>
          <marker id="arrDir" markerWidth={8} markerHeight={6}
            refX={7} refY={3} orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={colors.dim} />
          </marker>
        </defs>
      </svg>
    );
  }

  if (variant === 'standing_wave') {
    const nodePositions: number[] = [];
    const antinodePositions: number[] = [];

    for (let i = 0; i <= harmonicNumber; i++) {
      nodePositions.push(MARGIN.left + (i / harmonicNumber) * plotW);
    }
    for (let i = 0; i < harmonicNumber; i++) {
      antinodePositions.push(
        MARGIN.left + ((i + 0.5) / harmonicNumber) * plotW
      );
    }

    const upperPath = wavePath(A, 0, MARGIN.left, MARGIN.left + plotW);
    const lowerPath = wavePath(-A, 0, MARGIN.left, MARGIN.left + plotW);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={22} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        <line x1={MARGIN.left} y1={axisY}
          x2={MARGIN.left + plotW} y2={axisY}
          stroke={colors.axis} strokeWidth={1} strokeDasharray="4 3" />

        <line x1={MARGIN.left} y1={axisY - A - 16}
          x2={MARGIN.left} y2={axisY + A + 16}
          stroke={colors.dim} strokeWidth={3} />
        <line x1={MARGIN.left + plotW} y1={axisY - A - 16}
          x2={MARGIN.left + plotW} y2={axisY + A + 16}
          stroke={colors.dim} strokeWidth={3} />

        <path d={upperPath} fill="none"
          stroke={colors.wave1} strokeWidth={2}
          strokeDasharray="8 4" />
        <path d={lowerPath} fill="none"
          stroke={colors.wave1} strokeWidth={2}
          strokeDasharray="8 4" />

        <path
          d={`${upperPath} L ${MARGIN.left + plotW} ${axisY} ${lowerPath
            .replace('M', 'L').split(' ').reverse().join(' ')}`}
          fill={colors.wave1}
          opacity={0.08}
        />

        {nodePositions.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={axisY} r={5}
              fill={colors.node} />
            {showNodeLabels && (
              <text x={x} y={axisY + 20} textAnchor="middle"
                fontSize={10} fontWeight={600}
                fill={colors.node}>N</text>
            )}
          </g>
        ))}

        {antinodePositions.map((x, i) => (
          <g key={i}>
            <line x1={x} y1={axisY - A} x2={x} y2={axisY + A}
              stroke={colors.wave2} strokeWidth={1}
              strokeDasharray="3 2" />
            {showNodeLabels && (
              <text x={x} y={axisY - A - 8} textAnchor="middle"
                fontSize={10} fontWeight={600}
                fill={colors.wave2}>A</text>
            )}
          </g>
        ))}

        <text x={W/2} y={H - 10} textAnchor="middle"
          fontSize={11} fill={colors.dim}>
          {harmonicNumber === 1 ? 'Fundamental (1st harmonic)'
            : harmonicNumber === 2 ? '2nd harmonic (1st overtone)'
            : harmonicNumber === 3 ? '3rd harmonic (2nd overtone)'
            : `${harmonicNumber}th harmonic`}
        </text>
      </svg>
    );
  }

  if (variant === 'superposition') {
    const resultantPath = (() => {
      const points: string[] = [];
      for (let i = 0; i <= pts; i++) {
        const x = MARGIN.left + plotW * (i / pts);
        const t = (i / pts) * cycles * 2 * Math.PI;
        const y1 = A * Math.sin(t);
        const y2 = A2 * Math.sin(t + phaseShift);
        const y = axisY - (y1 + y2) / 2;
        points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      return points.join(' ');
    })();

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={22} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        <line x1={MARGIN.left} y1={axisY}
          x2={MARGIN.left + plotW} y2={axisY}
          stroke={colors.axis} strokeWidth={1} strokeDasharray="4 3" />

        <path d={wavePath(A / 2)}
          fill="none" stroke={colors.wave1}
          strokeWidth={1.5} strokeDasharray="6 3" opacity={0.7} />

        <path d={wavePath(A2 / 2, phaseShift)}
          fill="none" stroke={colors.wave2}
          strokeWidth={1.5} strokeDasharray="6 3" opacity={0.7} />

        <path d={resultantPath}
          fill="none" stroke={colors.resultant} strokeWidth={2.5} />

        <line x1={MARGIN.left} y1={MARGIN.top - 10}
          x2={MARGIN.left + 24} y2={MARGIN.top - 10}
          stroke={colors.wave1} strokeWidth={1.5} strokeDasharray="6 3" />
        <text x={MARGIN.left + 28} y={MARGIN.top - 6}
          fontSize={10} fill={colors.wave1}>Wave 1</text>

        <line x1={MARGIN.left + 80} y1={MARGIN.top - 10}
          x2={MARGIN.left + 104} y2={MARGIN.top - 10}
          stroke={colors.wave2} strokeWidth={1.5} strokeDasharray="6 3" />
        <text x={MARGIN.left + 108} y={MARGIN.top - 6}
          fontSize={10} fill={colors.wave2}>Wave 2</text>

        <line x1={MARGIN.left + 160} y1={MARGIN.top - 10}
          x2={MARGIN.left + 184} y2={MARGIN.top - 10}
          stroke={colors.resultant} strokeWidth={2.5} />
        <text x={MARGIN.left + 188} y={MARGIN.top - 6}
          fontSize={10} fill={colors.resultant}>Resultant</text>

        <text x={W/2} y={H - 8} textAnchor="middle"
          fontSize={10} fill={colors.dim}>
          {Math.abs(phaseShift - Math.PI) < 0.1
            ? 'Waves in antiphase → destructive interference'
            : phaseShift < 0.1
            ? 'Waves in phase → constructive interference'
            : 'Superposition of two waves'}
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>

      {title && <text x={W/2} y={22} textAnchor="middle"
        fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

      <line x1={MARGIN.left} y1={MARGIN.top}
        x2={MARGIN.left} y2={H - MARGIN.bottom}
        stroke={colors.axis} strokeWidth={1.5} />
      <line x1={MARGIN.left} y1={axisY}
        x2={W - MARGIN.right} y2={axisY}
        stroke={colors.axis} strokeWidth={1.5}
        markerEnd="url(#arrAxis)" />

      <text x={MARGIN.left - 6} y={MARGIN.top + 6}
        textAnchor="end" fontSize={11}
        fill={colors.dim}>Displacement</text>
      <text x={W - MARGIN.right + 8} y={axisY + 4}
        fontSize={11} fill={colors.dim}>Distance</text>

      <text x={MARGIN.left - 6} y={axisY + 4}
        textAnchor="end" fontSize={10}
        fill={colors.dim}>0</text>

      <path d={wavePath(A)}
        fill="none" stroke={colors.wave1} strokeWidth={2.5} />

      {showAmplitudeLabel && (
        <>
          <line x1={MARGIN.left - 12} y1={axisY}
            x2={MARGIN.left - 12} y2={axisY - A}
            stroke={colors.dim} strokeWidth={1}
            markerStart="url(#arrAxisRev)"
            markerEnd="url(#arrAxis)" />
          <text x={MARGIN.left - 28} y={axisY - A / 2 + 4}
            textAnchor="middle" fontSize={11}
            fill={colors.dim}
            transform={`rotate(-90, ${MARGIN.left - 28}, ${axisY - A / 2 + 4})`}>
            A
          </text>
        </>
      )}

      {showWavelengthLabel && (
        <>
          <line x1={MARGIN.left} y1={axisY + A + 20}
            x2={MARGIN.left + plotW / cycles} y2={axisY + A + 20}
            stroke={colors.dim} strokeWidth={1.5} />
          <line x1={MARGIN.left} y1={axisY + A + 14}
            x2={MARGIN.left} y2={axisY + A + 26}
            stroke={colors.dim} strokeWidth={1.5} />
          <line x1={MARGIN.left + plotW / cycles}
            y1={axisY + A + 14}
            x2={MARGIN.left + plotW / cycles}
            y2={axisY + A + 26}
            stroke={colors.dim} strokeWidth={1.5} />
          <text x={MARGIN.left + plotW / (cycles * 2)}
            y={axisY + A + 36}
            textAnchor="middle" fontSize={11}
            fill={colors.dim}>λ</text>
        </>
      )}

      <defs>
        <marker id="arrAxis" markerWidth={8} markerHeight={6}
          refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={colors.axis} />
        </marker>
        <marker id="arrAxisRev" markerWidth={8} markerHeight={6}
          refX={1} refY={3} orient="auto">
          <polygon points="8 0, 0 3, 8 6" fill={colors.axis} />
        </marker>
      </defs>
    </svg>
  );
};

export default WaveDiagramRenderer;
