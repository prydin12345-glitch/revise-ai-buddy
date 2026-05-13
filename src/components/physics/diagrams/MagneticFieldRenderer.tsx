import type { MagneticFieldConfig } from '../types';

interface Props { config: MagneticFieldConfig; }

const C = {
  field: 'hsl(221 83% 53%)',
  north: 'hsl(0 84% 60%)',
  south: 'hsl(221 83% 53%)',
  body: 'hsl(var(--foreground))',
  dim: 'hsl(var(--muted-foreground))',
  force: 'hsl(142 71% 45%)',
};

export const MagneticFieldRenderer = ({ config }: Props) => {
  const W = 520, H = 320;
  const cx = W / 2, cy = H / 2;
  const { variant, currentDirection, title, labelN, labelS, showForceArrow } = config;

  if (variant === 'current_straight_wire') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.body}>{title}</text>}
        <circle cx={cx} cy={cy} r={8} fill="none" stroke={C.body} strokeWidth={2} />
        {currentDirection === 'out_of_page' ? (
          <circle cx={cx} cy={cy} r={2} fill={C.body} />
        ) : (
          <>
            <line x1={cx-5} y1={cy-5} x2={cx+5} y2={cy+5} stroke={C.body} strokeWidth={2} />
            <line x1={cx+5} y1={cy-5} x2={cx-5} y2={cy+5} stroke={C.body} strokeWidth={2} />
          </>
        )}
        {[1,2,3,4].map(i => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={i * 28} fill="none"
              stroke={C.field} strokeWidth={1.3} />
            <polygon points={`${cx + i * 28 - 4},${cy - 5} ${cx + i * 28 + 4},${cy} ${cx + i * 28 - 4},${cy + 5}`}
              fill={C.field} />
          </g>
        ))}
        <text x={cx + 14} y={cy + 4} fontSize={11} fill={C.body}>I</text>
      </svg>
    );
  }

  if (variant === 'current_solenoid') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.body}>{title}</text>}
        <rect x={cx - 120} y={cy - 30} width={240} height={60}
          fill="none" stroke={C.body} strokeWidth={1} strokeDasharray="3 2" />
        {Array.from({ length: 10 }).map((_, i) => {
          const x = cx - 110 + i * 24;
          return (
            <ellipse key={i} cx={x} cy={cy} rx={6} ry={30}
              fill="none" stroke={C.body} strokeWidth={2} />
          );
        })}
        {[-50, -20, 10, 40].map((dy, i) => (
          <g key={i}>
            <line x1={cx - 100} y1={cy + dy * 0.4} x2={cx + 100} y2={cy + dy * 0.4}
              stroke={C.field} strokeWidth={1.5} />
            <polygon points={`${cx + 100 - 6},${cy + dy * 0.4 - 4} ${cx + 100},${cy + dy * 0.4} ${cx + 100 - 6},${cy + dy * 0.4 + 4}`}
              fill={C.field} />
          </g>
        ))}
        {labelN && <text x={cx + 130} y={cy + 4} fontSize={14} fontWeight={700} fill={C.north}>N</text>}
        {labelS && <text x={cx - 140} y={cy + 4} fontSize={14} fontWeight={700} fill={C.south}>S</text>}
      </svg>
    );
  }

  if (variant === 'motor_effect') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
          fontWeight={700} fill={C.body}>{title}</text>}
        <rect x={cx - 130} y={cy - 60} width={50} height={120} fill={C.north} opacity={0.85} />
        <text x={cx - 105} y={cy + 6} textAnchor="middle" fontSize={16}
          fontWeight={700} fill="white">N</text>
        <rect x={cx + 80} y={cy - 60} width={50} height={120} fill={C.south} opacity={0.85} />
        <text x={cx + 105} y={cy + 6} textAnchor="middle" fontSize={16}
          fontWeight={700} fill="white">S</text>
        {[-40, -20, 0, 20, 40].map((dy, i) => (
          <line key={i} x1={cx - 80} y1={cy + dy} x2={cx + 80} y2={cy + dy}
            stroke={C.field} strokeWidth={1.3} markerEnd="url(#mfArr)" />
        ))}
        <circle cx={cx} cy={cy} r={10} fill="none" stroke={C.body} strokeWidth={2} />
        <circle cx={cx} cy={cy} r={2.5} fill={C.body} />
        {showForceArrow && (
          <>
            <line x1={cx} y1={cy} x2={cx} y2={cy - 80}
              stroke={C.force} strokeWidth={3} markerEnd="url(#fArr)" />
            <text x={cx + 8} y={cy - 70} fontSize={12} fontWeight={700} fill={C.force}>F</text>
          </>
        )}
        <defs>
          <marker id="mfArr" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill={C.field} />
          </marker>
          <marker id="fArr" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto">
            <polygon points="0 0, 8 4, 0 8" fill={C.force} />
          </marker>
        </defs>
      </svg>
    );
  }

  // Default: bar magnet (single, attract, or repel)
  const isPair = variant === 'two_bar_magnets_attract' || variant === 'two_bar_magnets_repel';
  const repel = variant === 'two_bar_magnets_repel';

  const drawBar = (x: number, leftIsN: boolean) => (
    <g key={x}>
      <rect x={x - 60} y={cy - 22} width={60} height={44} fill={leftIsN ? C.north : C.south} opacity={0.9} />
      <rect x={x} y={cy - 22} width={60} height={44} fill={leftIsN ? C.south : C.north} opacity={0.9} />
      <text x={x - 30} y={cy + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="white">
        {leftIsN ? 'N' : 'S'}
      </text>
      <text x={x + 30} y={cy + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="white">
        {leftIsN ? 'S' : 'N'}
      </text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      {title && <text x={W/2} y={20} textAnchor="middle" fontSize={12}
        fontWeight={700} fill={C.body}>{title}</text>}
      {isPair ? (
        <>
          {drawBar(cx - 100, true)}
          {drawBar(cx + 100, repel)}
          {[-50, -25, 0, 25, 50].map((dy, i) => (
            <path key={i}
              d={`M ${cx - 100} ${cy + dy} Q ${cx} ${cy + dy * (repel ? 2 : 0.3)} ${cx + 100} ${cy + dy}`}
              stroke={C.field} strokeWidth={1.4} fill="none" markerEnd="url(#bArr)" />
          ))}
        </>
      ) : (
        <>
          {drawBar(cx, true)}
          {[40, 70, 100, 130].map((r, i) => (
            <ellipse key={i} cx={cx} cy={cy} rx={60 + r} ry={r * 0.8}
              fill="none" stroke={C.field} strokeWidth={1.3} />
          ))}
          {[40, 70, 100, 130].map((r, i) => (
            <polygon key={i}
              points={`${cx + 60 + r - 6},${cy - 5} ${cx + 60 + r},${cy} ${cx + 60 + r - 6},${cy + 5}`}
              fill={C.field} />
          ))}
        </>
      )}
      <defs>
        <marker id="bArr" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill={C.field} />
        </marker>
      </defs>
    </svg>
  );
};

export default MagneticFieldRenderer;
