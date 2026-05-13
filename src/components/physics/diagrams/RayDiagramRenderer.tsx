import type { RayDiagramConfig } from '../types';

interface Props { config: RayDiagramConfig; }

export const RayDiagramRenderer = ({ config }: Props) => {
  const {
    variant, objectPosition, showConstruction,
    showImage, showNormals, showAngles,
    refractiveIndex, mediumLabel, title,
  } = config;

  const W = 520, H = 320;
  const cx = W / 2, cy = H / 2;
  const f = 80;
  const twoF = f * 2;

  const lensX = cx;
  const axisY = cy;

  const getObjectX = () => {
    switch (objectPosition) {
      case 'inside_f': return lensX - f * 0.6;
      case 'at_f': return lensX - f;
      case 'between_f_2f': return lensX - f * 1.5;
      case 'at_2f': return lensX - twoF;
      case 'beyond_2f':
      default: return lensX - twoF * 1.2;
    }
  };

  const objX = getObjectX();
  const objH = 50;

  const u = lensX - objX;
  const focalLen = f;
  const v = (focalLen * u) / (u - focalLen);
  const imgX = lensX + v;
  const imgH = objectPosition === 'inside_f' ? -objH * (v / u) : objH * (v / u);

  const colors = {
    axis: 'hsl(var(--muted-foreground))',
    object: 'hsl(221 83% 53%)',
    image: 'hsl(0 84% 60%)',
    ray1: 'hsl(25 95% 53%)',
    ray2: 'hsl(142 71% 45%)',
    ray3: 'hsl(262 83% 58%)',
    lens: 'hsl(var(--foreground))',
    label: 'hsl(var(--foreground))',
    dim: 'hsl(var(--muted-foreground))',
  };

  if (variant === 'flat_mirror') {
    const mirrorX = cx + 60;
    const objMX = mirrorX - 120;
    const imgMX = mirrorX + 120;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}
        <line x1={mirrorX} y1={40} x2={mirrorX} y2={H-40}
          stroke={colors.lens} strokeWidth={3} />
        <text x={mirrorX+8} y={50} fontSize={11}
          fill={colors.dim}>Mirror</text>
        <line x1={objMX} y1={axisY} x2={objMX} y2={axisY-60}
          stroke={colors.object} strokeWidth={2.5} markerEnd="url(#arrowBlue)" />
        <text x={objMX} y={axisY-68} textAnchor="middle"
          fontSize={11} fontWeight={600} fill={colors.object}>Object</text>
        <line x1={objMX} y1={axisY-60} x2={mirrorX} y2={axisY-60}
          stroke={colors.ray1} strokeWidth={1.5}
          markerEnd="url(#arrowOrange)" />
        <line x1={objMX} y1={axisY-60} x2={mirrorX} y2={axisY}
          stroke={colors.ray2} strokeWidth={1.5}
          markerEnd="url(#arrowGreen)" />
        <line x1={mirrorX} y1={axisY-60} x2={imgMX} y2={axisY-60}
          stroke={colors.ray1} strokeWidth={1.5} strokeDasharray="4 3"
          markerEnd="url(#arrowOrange)" />
        <line x1={mirrorX} y1={axisY} x2={imgMX} y2={axisY-60}
          stroke={colors.ray2} strokeWidth={1.5} strokeDasharray="4 3"
          markerEnd="url(#arrowGreen)" />
        <line x1={imgMX} y1={axisY} x2={imgMX} y2={axisY-60}
          stroke={colors.image} strokeWidth={2} strokeDasharray="6 3" />
        <text x={imgMX} y={axisY-68} textAnchor="middle"
          fontSize={11} fontWeight={600} fill={colors.image}>Image</text>
        <text x={imgMX} y={axisY-80} textAnchor="middle"
          fontSize={9} fill={colors.image}>(virtual)</text>
        <line x1={20} y1={axisY} x2={mirrorX-5} y2={axisY}
          stroke={colors.axis} strokeWidth={1} strokeDasharray="4 3" />
        <defs>
          <marker id="arrowBlue" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={colors.ray1} />
          </marker>
          <marker id="arrowOrange" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={colors.ray1} />
          </marker>
          <marker id="arrowGreen" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={colors.ray2} />
          </marker>
        </defs>
      </svg>
    );
  }

  if (variant === 'refraction_block') {
    const blockLeft = cx - 60, blockRight = cx + 60;
    const blockTop = axisY - 70;
    const n = refractiveIndex ?? 1.5;
    const inAngle = 40;
    void n; void inAngle;
    const incidentStartX = blockLeft - 80;
    const incidentStartY = axisY - 80;
    const entryX = blockLeft, entryY = axisY - 20;
    const exitX = blockRight, exitY = axisY + 20;
    const refractedEndX = exitX + 80, refractedEndY = axisY + 80;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}
        <rect x={blockLeft} y={blockTop} width={120} height={140}
          fill="hsl(221 83% 53% / 0.1)"
          stroke="hsl(221 83% 53%)" strokeWidth={2} />
        <text x={(blockLeft+blockRight)/2} y={blockTop-8}
          textAnchor="middle" fontSize={10}
          fill={colors.dim}>{mediumLabel ?? 'glass'}</text>
        <line x1={incidentStartX} y1={incidentStartY}
          x2={entryX} y2={entryY}
          stroke={colors.ray1} strokeWidth={2}
          markerEnd="url(#arrowR1)" />
        <text x={incidentStartX+10} y={incidentStartY+14}
          fontSize={10} fill={colors.ray1}>Incident ray</text>
        {showNormals && (
          <line x1={entryX} y1={blockTop+20} x2={entryX} y2={blockTop+90}
            stroke={colors.dim} strokeWidth={1} strokeDasharray="4 3" />
        )}
        <line x1={entryX} y1={entryY} x2={exitX} y2={exitY}
          stroke={colors.ray1} strokeWidth={2} />
        <line x1={exitX} y1={exitY} x2={refractedEndX} y2={refractedEndY}
          stroke={colors.ray1} strokeWidth={2}
          markerEnd="url(#arrowR1)" />
        <text x={refractedEndX-10} y={refractedEndY+14}
          fontSize={10} fill={colors.ray1}>Emergent ray</text>
        {showAngles && (
          <>
            <text x={entryX+14} y={entryY-8} fontSize={10}
              fill={colors.dim}>i</text>
            <text x={entryX+8} y={entryY+18} fontSize={10}
              fill={colors.dim}>r</text>
          </>
        )}
        <defs>
          <marker id="arrowR1" markerWidth={8} markerHeight={6}
            refX={7} refY={3} orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={colors.ray1} />
          </marker>
        </defs>
      </svg>
    );
  }

  if (variant === 'optical_fibre') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}
        <rect x={40} y={axisY-40} width={440} height={80}
          fill="hsl(221 83% 53% / 0.08)"
          stroke="hsl(221 83% 53%)" strokeWidth={2} />
        <rect x={40} y={axisY-24} width={440} height={48}
          fill="hsl(221 83% 53% / 0.15)"
          stroke="hsl(221 83% 53% / 0.6)" strokeWidth={1} />
        <text x={44} y={axisY-44} fontSize={10}
          fill={colors.dim}>Cladding</text>
        <text x={44} y={axisY-28} fontSize={10}
          fill={colors.dim}>Core</text>
        {[0,1,2,3].map(i => {
          const x1 = 60 + i * 100;
          const y1 = i % 2 === 0 ? axisY - 20 : axisY + 20;
          const x2 = x1 + 100;
          const y2 = i % 2 === 0 ? axisY + 20 : axisY - 20;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(25 95% 53%)" strokeWidth={2} />
          );
        })}
        <text x={W/2} y={axisY-50} textAnchor="middle"
          fontSize={11} fill={colors.dim}>
          Total Internal Reflection
        </text>
        <text x={W/2} y={axisY+68} textAnchor="middle"
          fontSize={10} fill={colors.dim}>
          Angle of incidence &gt; critical angle
        </text>
      </svg>
    );
  }

  if (variant === 'prism_dispersion') {
    const prismPoints = `${cx-60},${axisY+60} ${cx+80},${axisY+60} ${cx+10},${axisY-60}`;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
        {title && <text x={W/2} y={20} textAnchor="middle"
          fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}
        <polygon points={prismPoints}
          fill="hsl(221 83% 53% / 0.1)"
          stroke="hsl(221 83% 53%)" strokeWidth={2} />
        <line x1={60} y1={axisY} x2={cx-30} y2={axisY+10}
          stroke="hsl(var(--foreground))" strokeWidth={3} />
        <text x={40} y={axisY-8} fontSize={10}
          fill="hsl(var(--foreground))">White light</text>
        {[
          { color: '#FF0000', label: 'Red', dy: 0 },
          { color: '#FF7700', label: 'Orange', dy: 8 },
          { color: '#FFFF00', label: 'Yellow', dy: 16 },
          { color: '#00CC00', label: 'Green', dy: 24 },
          { color: '#0000FF', label: 'Blue', dy: 32 },
          { color: '#4400AA', label: 'Indigo', dy: 38 },
          { color: '#7700AA', label: 'Violet', dy: 44 },
        ].map((r, i) => (
          <g key={i}>
            <line
              x1={cx+60} y1={axisY+20+i*4}
              x2={cx+160} y2={axisY+20+r.dy}
              stroke={r.color} strokeWidth={1.5} />
            <text x={cx+165} y={axisY+24+r.dy}
              fontSize={9} fill={r.color}>{r.label}</text>
          </g>
        ))}
      </svg>
    );
  }

  const isConverging = variant === 'converging_lens' ||
    variant === 'eye_long_sight' || variant === 'eye_short_sight';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto', overflow: 'visible' }}>
      <defs>
        <marker id="arrOrange" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={colors.ray1} />
        </marker>
        <marker id="arrGreen" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={colors.ray2} />
        </marker>
        <marker id="arrPurple" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={colors.ray3} />
        </marker>
        <marker id="arrRed" markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={colors.image} />
        </marker>
      </defs>

      {title && <text x={W/2} y={20} textAnchor="middle"
        fontSize={12} fontWeight={700} fill={colors.label}>{title}</text>}

      <line x1={20} y1={axisY} x2={W-20} y2={axisY}
        stroke={colors.axis} strokeWidth={1} strokeDasharray="4 3" />
      <text x={W-18} y={axisY+14} fontSize={10}
        fill={colors.dim}>Principal axis</text>

      {isConverging ? (
        <>
          <line x1={lensX} y1={40} x2={lensX} y2={H-40}
            stroke={colors.lens} strokeWidth={2} />
          <text x={lensX-4} y={38} textAnchor="end" fontSize={20} fill={colors.lens}>⟨</text>
          <text x={lensX+4} y={38} fontSize={20} fill={colors.lens}>⟩</text>
          <text x={lensX-4} y={H-36} textAnchor="end" fontSize={20} fill={colors.lens}>⟨</text>
          <text x={lensX+4} y={H-36} fontSize={20} fill={colors.lens}>⟩</text>
        </>
      ) : (
        <>
          <line x1={lensX} y1={40} x2={lensX} y2={H-40}
            stroke={colors.lens} strokeWidth={2} />
          <text x={lensX-4} y={38} textAnchor="end" fontSize={20} fill={colors.lens}>⟩</text>
          <text x={lensX+4} y={38} fontSize={20} fill={colors.lens}>⟨</text>
          <text x={lensX-4} y={H-36} textAnchor="end" fontSize={20} fill={colors.lens}>⟩</text>
          <text x={lensX+4} y={H-36} fontSize={20} fill={colors.lens}>⟨</text>
        </>
      )}

      <circle cx={lensX + f} cy={axisY} r={4} fill={colors.dim} />
      <text x={lensX + f} y={axisY + 16} textAnchor="middle" fontSize={11} fill={colors.dim}>F</text>
      <circle cx={lensX - f} cy={axisY} r={4} fill={colors.dim} />
      <text x={lensX - f} y={axisY + 16} textAnchor="middle" fontSize={11} fill={colors.dim}>F</text>

      <circle cx={lensX + twoF} cy={axisY} r={3} fill={colors.dim} opacity={0.5} />
      <text x={lensX + twoF} y={axisY + 16} textAnchor="middle" fontSize={10} fill={colors.dim}>2F</text>
      <circle cx={lensX - twoF} cy={axisY} r={3} fill={colors.dim} opacity={0.5} />
      <text x={lensX - twoF} y={axisY + 16} textAnchor="middle" fontSize={10} fill={colors.dim}>2F</text>

      <line x1={objX} y1={axisY} x2={objX} y2={axisY - objH}
        stroke={colors.object} strokeWidth={2.5}
        markerEnd="url(#arrOrange)" />
      <text x={objX} y={axisY - objH - 8}
        textAnchor="middle" fontSize={11}
        fontWeight={600} fill={colors.object}>Object</text>

      {showConstruction && (
        <>
          <line x1={objX} y1={axisY - objH}
            x2={lensX} y2={axisY - objH}
            stroke={colors.ray1} strokeWidth={1.5} />
          {isConverging ? (
            <line x1={lensX} y1={axisY - objH}
              x2={imgX > lensX ? imgX + 40 : lensX + 200}
              y2={imgX > lensX ? axisY + Math.abs(imgH) + 10 : axisY - 60}
              stroke={colors.ray1} strokeWidth={1.5}
              markerEnd="url(#arrOrange)" />
          ) : (
            <line x1={lensX} y1={axisY - objH}
              x2={lensX + 200} y2={axisY - 20}
              stroke={colors.ray1} strokeWidth={1.5}
              markerEnd="url(#arrOrange)" />
          )}

          <line x1={objX} y1={axisY - objH}
            x2={lensX + 200} y2={axisY + 40}
            stroke={colors.ray2} strokeWidth={1.5}
            markerEnd="url(#arrGreen)" />

          {isConverging && (
            <>
              <line x1={objX} y1={axisY - objH}
                x2={lensX} y2={axisY}
                stroke={colors.ray3} strokeWidth={1.5} />
              <line x1={lensX} y1={axisY}
                x2={lensX + 200} y2={axisY}
                stroke={colors.ray3} strokeWidth={1.5}
                markerEnd="url(#arrPurple)" />
            </>
          )}
        </>
      )}

      {showImage && isConverging && objectPosition !== 'inside_f' &&
       objectPosition !== 'at_f' && imgX > lensX && (
        <>
          <line x1={imgX} y1={axisY} x2={imgX} y2={axisY + Math.abs(imgH)}
            stroke={colors.image} strokeWidth={2}
            markerEnd="url(#arrRed)" />
          <text x={imgX} y={axisY + Math.abs(imgH) + 14}
            textAnchor="middle" fontSize={11}
            fontWeight={600} fill={colors.image}>Image</text>
          <text x={imgX} y={axisY + Math.abs(imgH) + 26}
            textAnchor="middle" fontSize={9}
            fill={colors.image}>(real, inverted)</text>
        </>
      )}

      {showImage && isConverging && objectPosition === 'inside_f' && (
        <>
          <line x1={objX - 40} y1={axisY} x2={objX - 40} y2={axisY - objH * 1.5}
            stroke={colors.image} strokeWidth={2} strokeDasharray="6 3" />
          <text x={objX - 40} y={axisY - objH * 1.5 - 8}
            textAnchor="middle" fontSize={11}
            fontWeight={600} fill={colors.image}>Image</text>
          <text x={objX - 40} y={axisY - objH * 1.5 - 20}
            textAnchor="middle" fontSize={9}
            fill={colors.image}>(virtual, upright)</text>
        </>
      )}
    </svg>
  );
};

export default RayDiagramRenderer;
