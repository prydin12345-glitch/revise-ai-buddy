import type { MagneticFieldConfig } from '../types';

interface Props { config: MagneticFieldConfig; }

export const MagneticFieldRenderer = ({ config }: Props) => {
  const {
    variant, northOnLeft = true, currentDirection,
    showArrows = true, showCurrentSymbols,
    showForceArrow, labelN = true, labelS = true,
    title,
  } = config;

  const W = 440, H = 300;
  const cx = W / 2, cy = H / 2;

  const colors = {
    fieldLine: 'hsl(221 83% 53%)',
    magnet: { N: 'hsl(0 84% 60%)', S: 'hsl(221 83% 53%)' },
    force: 'hsl(142 71% 45%)',
    current: 'hsl(25 95% 53%)',
    label: 'hsl(var(--foreground))',
    dim: 'hsl(var(--muted-foreground))',
    wire: 'hsl(var(--foreground))',
  };

  const arrowDef = (id: string, color: string) => (
    <marker key={id} id={id} markerWidth={8} markerHeight={6}
      refX={6} refY={3} orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill={color} />
    </marker>
  );

  const BarMagnet = ({
    x, y, width = 120, height = 40,
    nLeft = true,
  }: {
    x: number; y: number; width?: number; height?: number; nLeft?: boolean;
  }) => (
    <g>
      <rect x={nLeft ? x : x + width / 2}
        y={y} width={width / 2} height={height}
        fill={colors.magnet.N} rx={nLeft ? 4 : 0} />
      {labelN && (
        <text x={nLeft ? x + width / 4 : x + width * 0.75}
          y={y + height / 2 + 5}
          textAnchor="middle" fontSize={14} fontWeight={700}
          fill="white">N</text>
      )}
      <rect x={nLeft ? x + width / 2 : x}
        y={y} width={width / 2} height={height}
        fill={colors.magnet.S} rx={nLeft ? 0 : 4} />
      {labelS && (
        <text x={nLeft ? x + width * 0.75 : x + width / 4}
          y={y + height / 2 + 5}
          textAnchor="middle" fontSize={14} fontWeight={700}
          fill="white">S</text>
      )}
    </g>
  );

  const DotSymbol = ({ x, y, r = 14 }: { x: number; y: number; r?: number }) => (
    <g>
      <circle cx={x} cy={y} r={r}
        fill="none" stroke={colors.current} strokeWidth={2} />
      <circle cx={x} cy={y} r={r * 0.25}
        fill={colors.current} />
    </g>
  );

  const CrossSymbol = ({ x, y, r = 14 }: { x: number; y: number; r?: number }) => (
    <g>
      <circle cx={x} cy={y} r={r}
        fill="none" stroke={colors.current} strokeWidth={2} />
      <line x1={x - r * 0.6} y1={y - r * 0.6}
        x2={x + r * 0.6} y2={y + r * 0.6}
        stroke={colors.current} strokeWidth={2} />
      <line x1={x + r * 0.6} y1={y - r * 0.6}
        x2={x - r * 0.6} y2={y + r * 0.6}
        stroke={colors.current} strokeWidth={2} />
    </g>
  );

  if (variant === 'bar_magnet') {
    const magnetY = cy - 20;
    const magnetX = cx - 60;
    const nX = northOnLeft ? magnetX : magnetX + 60;
    const sX = northOnLeft ? magnetX + 60 : magnetX;

    const fieldArcs = [
      { rx: 80, ry: 50 }, { rx: 120, ry: 80 }, { rx: 160, ry: 110 },
    ];

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        <defs>
          {arrowDef('arrField', colors.fieldLine)}
        </defs>
        {title && <text x={W/2} y={20} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        {fieldArcs.map((arc, i) => (
          <g key={i}>
            <path
              d={`M ${nX + 60} ${magnetY + 20}
                  Q ${cx} ${magnetY - arc.ry}
                  ${sX} ${magnetY + 20}`}
              fill="none" stroke={colors.fieldLine}
              strokeWidth={1.5} opacity={0.7}
              markerMid="url(#arrField)"
            />
            <path
              d={`M ${nX + 60} ${magnetY + 20}
                  Q ${cx} ${magnetY + arc.ry + 40}
                  ${sX} ${magnetY + 20}`}
              fill="none" stroke={colors.fieldLine}
              strokeWidth={1.5} opacity={0.7}
            />
          </g>
        ))}

        <line
          x1={northOnLeft ? magnetX + 5 : magnetX + 115}
          y1={magnetY + 20}
          x2={northOnLeft ? magnetX + 115 : magnetX + 5}
          y2={magnetY + 20}
          stroke={colors.fieldLine} strokeWidth={1.5}
          strokeDasharray="4 3" opacity={0.5}
        />

        <BarMagnet x={magnetX} y={magnetY}
          width={120} height={40} nLeft={northOnLeft} />

        <text x={cx} y={H - 12} textAnchor="middle"
          fontSize={10} fill={colors.dim}>
          Field lines run from N to S outside the magnet
        </text>
      </svg>
    );
  }

  if (variant === 'two_bar_magnets_attract' || variant === 'two_bar_magnets_repel') {
    const isAttracting = variant === 'two_bar_magnets_attract';
    const leftMagnetX = 40;
    const rightMagnetX = W - 160;
    const magnetY = cy - 20;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        <BarMagnet x={leftMagnetX} y={magnetY} width={120} height={40}
          nLeft={isAttracting} />

        <BarMagnet x={rightMagnetX} y={magnetY} width={120} height={40}
          nLeft={!isAttracting} />

        {isAttracting ? (
          [0, 1, 2].map(i => (
            <path key={i}
              d={`M ${leftMagnetX + 120} ${magnetY + 8 + i * 12}
                  Q ${cx} ${magnetY + 8 + i * 12}
                  ${rightMagnetX} ${magnetY + 8 + i * 12}`}
              fill="none" stroke={colors.fieldLine}
              strokeWidth={1.5} opacity={0.8}
            />
          ))
        ) : (
          [0, 1, 2].map(i => (
            <g key={i}>
              <path
                d={`M ${leftMagnetX + 120} ${magnetY + 8 + i * 12}
                    Q ${cx - 40} ${magnetY - 30 + i * 8}
                    ${cx - 20} ${magnetY + 20}`}
                fill="none" stroke={colors.fieldLine}
                strokeWidth={1.5} opacity={0.6}
              />
              <path
                d={`M ${rightMagnetX} ${magnetY + 8 + i * 12}
                    Q ${cx + 40} ${magnetY - 30 + i * 8}
                    ${cx + 20} ${magnetY + 20}`}
                fill="none" stroke={colors.fieldLine}
                strokeWidth={1.5} opacity={0.6}
              />
            </g>
          ))
        )}

        <text x={cx} y={H - 12} textAnchor="middle"
          fontSize={11} fontWeight={600}
          fill={isAttracting ? colors.force : 'hsl(0 84% 60%)'}>
          {isAttracting ? 'Attraction — unlike poles facing' : 'Repulsion — like poles facing'}
        </text>
      </svg>
    );
  }

  if (variant === 'current_solenoid') {
    const solenoidLeft = 60, solenoidRight = W - 60;
    const solenoidY = cy;
    const solenoidH = 50;
    const numCoils = 8;
    const coilSpacing = (solenoidRight - solenoidLeft) / numCoils;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        <defs>{arrowDef('arrSol', colors.fieldLine)}</defs>
        {title && <text x={W/2} y={20} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        {Array.from({ length: numCoils }, (_, i) => {
          const x = solenoidLeft + i * coilSpacing;
          return (
            <g key={i}>
              <line x1={x} y1={solenoidY - solenoidH}
                x2={x + coilSpacing * 0.5} y2={solenoidY - solenoidH}
                stroke={colors.wire} strokeWidth={2} />
              <path
                d={`M ${x + coilSpacing * 0.5} ${solenoidY - solenoidH}
                    A ${coilSpacing * 0.5} ${solenoidH} 0 1 1
                    ${x + coilSpacing} ${solenoidY - solenoidH}`}
                fill="none" stroke={colors.wire} strokeWidth={2}
              />
              {showCurrentSymbols && i % 2 === 0 && (
                <DotSymbol x={x + coilSpacing * 0.25}
                  y={solenoidY - solenoidH - 16} r={10} />
              )}
            </g>
          );
        })}

        {[-16, 0, 16].map(dy => (
          <line key={dy}
            x1={solenoidLeft + 10} y1={solenoidY + dy}
            x2={solenoidRight - 10} y2={solenoidY + dy}
            stroke={colors.fieldLine} strokeWidth={2}
            markerEnd="url(#arrSol)"
          />
        ))}

        <path
          d={`M ${solenoidRight} ${solenoidY}
              Q ${solenoidRight + 50} ${solenoidY}
              ${solenoidRight + 50} ${solenoidY - 80}
              Q ${solenoidRight + 50} ${solenoidY - 140}
              ${cx} ${solenoidY - 140}
              Q ${solenoidLeft - 50} ${solenoidY - 140}
              ${solenoidLeft - 50} ${solenoidY - 80}
              Q ${solenoidLeft - 50} ${solenoidY}
              ${solenoidLeft} ${solenoidY}`}
          fill="none" stroke={colors.fieldLine}
          strokeWidth={1.5} opacity={0.5}
        />

        <text x={solenoidLeft - 8} y={solenoidY + 6}
          textAnchor="end" fontSize={16} fontWeight={700}
          fill={colors.magnet.S}>S</text>
        <text x={solenoidRight + 8} y={solenoidY + 6}
          fontSize={16} fontWeight={700}
          fill={colors.magnet.N}>N</text>

        <text x={cx} y={H - 10} textAnchor="middle"
          fontSize={10} fill={colors.dim}>
          Field inside solenoid is uniform and parallel
        </text>
      </svg>
    );
  }

  if (variant === 'current_straight_wire') {
    const isOutOfPage = currentDirection === 'out_of_page' ||
      !currentDirection;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        {[30, 60, 90, 120].map((r, i) => (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={colors.fieldLine}
            strokeWidth={i === 0 ? 2 : 1.5}
            opacity={1 - i * 0.15}
          />
        ))}

        {showArrows && [40, 75, 105].map((r, i) => {
          const angle = isOutOfPage ? -Math.PI / 2 : Math.PI / 2;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          return (
            <text key={i} x={x} y={y + 6}
              textAnchor="middle" fontSize={16}
              fill={colors.fieldLine}
              transform={`rotate(${isOutOfPage ? -90 : 90}, ${x}, ${y})`}>
              {isOutOfPage ? '→' : '←'}
            </text>
          );
        })}

        {isOutOfPage ? (
          <DotSymbol x={cx} y={cy} r={18} />
        ) : (
          <CrossSymbol x={cx} y={cy} r={18} />
        )}

        <text x={cx} y={cy + 36} textAnchor="middle"
          fontSize={11} fontWeight={600}
          fill={colors.current}>
          Current {isOutOfPage ? 'out of page ⊙' : 'into page ⊗'}
        </text>

        <text x={cx} y={H - 12} textAnchor="middle"
          fontSize={10} fill={colors.dim}>
          {isOutOfPage
            ? 'Field circles anticlockwise (viewed from front)'
            : 'Field circles clockwise (viewed from front)'}
        </text>
      </svg>
    );
  }

  if (variant === 'motor_effect') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

        {[60, 120, 180, 240, 300, 360].flatMap(x => (
          [80, 130, 180, 220].map(y => (
            <CrossSymbol key={`${x}-${y}`} x={x} y={y} r={12} />
          ))
        ))}

        <text x={cx} y={50} textAnchor="middle"
          fontSize={11} fill={colors.dim}>
          Magnetic field B (into page) ⊗
        </text>

        <rect x={cx - 8} y={70} width={16} height={160}
          fill={colors.wire} rx={3} />

        <line x1={cx} y1={80} x2={cx} y2={210}
          stroke={colors.current} strokeWidth={3}
          markerEnd="url(#arrCurrent)" />
        <text x={cx + 18} y={150} fontSize={11}
          fill={colors.current}>I</text>

        {showForceArrow && (
          <>
            <line x1={cx} y1={150} x2={cx + 80} y2={150}
              stroke={colors.force} strokeWidth={3}
              markerEnd="url(#arrForce)" />
            <text x={cx + 88} y={154} fontSize={11}
              fontWeight={700} fill={colors.force}>F</text>
          </>
        )}

        <text x={cx} y={H - 14} textAnchor="middle"
          fontSize={10} fill={colors.dim}>
          Fleming's Left Hand Rule: F = BIl
        </text>

        <defs>
          {arrowDef('arrCurrent', colors.current)}
          {arrowDef('arrForce', colors.force)}
        </defs>
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      {title && <text x={W/2} y={20} textAnchor="middle"
        fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}
      <text x={cx} y={cy} textAnchor="middle"
        fontSize={13} fill={colors.dim}>
        {title ?? 'Magnetic Field Diagram'}
      </text>
    </svg>
  );
};

export default MagneticFieldRenderer;
