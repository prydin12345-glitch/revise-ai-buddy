import React from 'react';
import { MechanicsConfig, COLORS } from './types';
import { ArrowMarkerDefs } from './svg-helpers';
import SlopeRenderer from './renderers/SlopeRenderer';
import PulleyRenderer from './renderers/PulleyRenderer';
import BeamRenderer from './renderers/BeamRenderer';
import ProjectileRenderer from './renderers/ProjectileRenderer';
import RodRenderer from './renderers/RodRenderer';
import FreeBodyRenderer from './renderers/FreeBodyRenderer';
import ConicalPendulumRenderer from './renderers/ConicalPendulumRenderer';
import VerticalMotionRenderer from './renderers/VerticalMotionRenderer';
import VerticalLiftRenderer from './renderers/VerticalLiftRenderer';
import DualRenderer from './renderers/DualRenderer';

export interface MechanicsDrawProps {
  config: MechanicsConfig;
  width?: number;
  height?: number;
}

/** Visible error placeholder for broken/unknown configs */
const MissingDiagram: React.FC<{ type?: string; error?: string }> = ({ type, error }) => (
  <svg width="300" height="80" style={{ background: 'white', display: 'block', margin: '0 auto' }}>
    <rect x="8" y="8" width="284" height="64"
      fill="#fff8f8" stroke="#cc0000" strokeWidth={1} strokeDasharray="4 2" rx={4} />
    <text x="150" y="32" textAnchor="middle"
      fontSize="11" fill="#cc0000" fontFamily="serif">
      Diagram type &quot;{type || 'unknown'}&quot; not rendered
    </text>
    {error && (
      <text x="150" y="52" textAnchor="middle"
        fontSize="10" fill="#cc0000" fontFamily="serif" fontStyle="italic">
        {error}
      </text>
    )}
  </svg>
);

const MechanicsDraw: React.FC<MechanicsDrawProps> = ({ config, width = 400, height = 300 }) => {
  try {
    if (!config) return null;

    // Dual type renders side-by-side, not inside a single SVG
    if (config.type === 'dual') {
      return <DualRenderer config={config as any} />;
    }

    // Phasor diagram renders its own SVG, not inside the shared wrapper
    if (config.type === 'phasor_diagram') {
      const { phasors, title } = config as any;
      const cx = 150; const cy = 150;
      const maxMag = Math.max(...phasors.map((p: any) => p.magnitude));
      const drawScale = 110 / maxMag;

      return (
        <svg viewBox="0 0 300 300" width="100%"
          style={{ background: COLORS.background, maxWidth: 300, display: 'block', margin: '0 auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          {/* Grid circles */}
          {[0.25, 0.5, 0.75, 1].map(r => (
            <circle key={r} cx={cx} cy={cy} r={maxMag * drawScale * r}
              fill="none" stroke="#e5e7eb" strokeWidth={0.5} strokeDasharray="3 3" />
          ))}
          {/* Axes */}
          <line x1={cx - 130} y1={cy} x2={cx + 130} y2={cy} stroke="#d1d5db" strokeWidth={1} />
          <line x1={cx} y1={cy - 130} x2={cx} y2={cy + 130} stroke="#d1d5db" strokeWidth={1} />
          <text x={cx + 132} y={cy + 4} fontSize={9} fill="#9ca3af" textAnchor="start">Re</text>
          <text x={cx + 3} y={cy - 132} fontSize={9} fill="#9ca3af">Im</text>
          {/* Phasor arrows */}
          {phasors.map((p: any, i: number) => {
            const angleRad = (p.angleDeg * Math.PI) / 180;
            const ex = cx + p.magnitude * drawScale * Math.cos(angleRad);
            const ey = cy - p.magnitude * drawScale * Math.sin(angleRad);
            const colour = p.colour ?? ['#3b82f6', '#ef4444', '#22c55e'][i % 3];
            const markerId = `arrow-phasor-${i}`;
            return (
              <g key={i}>
                <defs>
                  <marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={colour} />
                  </marker>
                </defs>
                <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={colour} strokeWidth={2.5} markerEnd={`url(#${markerId})`} />
                <text
                  x={cx + (p.magnitude * drawScale * 0.5) * Math.cos(angleRad) + (i % 2 === 0 ? 8 : -8)}
                  y={cy - (p.magnitude * drawScale * 0.5) * Math.sin(angleRad)}
                  fontSize={10} fill={colour} fontFamily="serif" fontStyle="italic"
                >{p.magnitude}</text>
                <text
                  x={ex + Math.cos(angleRad) * 12}
                  y={ey - Math.sin(angleRad) * 12}
                  fontSize={11} fill={colour} fontFamily="serif" fontStyle="italic" fontWeight="bold"
                >{p.label}</text>
                {p.angleDeg !== 0 && i > 0 && (
                  <text
                    x={cx + 30 * Math.cos(angleRad / 2)}
                    y={cy - 30 * Math.sin(angleRad / 2)}
                    fontSize={9} fill={colour} fontFamily="serif"
                  >{p.angleDeg > 0 ? '+' : ''}{p.angleDeg}°</text>
                )}
              </g>
            );
          })}
          {title && (
            <text x={150} y={288} textAnchor="middle" fontSize={10} fill="#6b7280" fontFamily="serif" fontStyle="italic">{title}</text>
          )}
        </svg>
      );
    }

    if (config.type === 'delta_wye_comparison') {
      return (
        <svg viewBox="0 0 400 200" width="100%"
          style={{ background: COLORS.background, maxWidth: 400, display: 'block', margin: '0 auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <text x={80} y={20} textAnchor="middle"
            fontSize={12} fontWeight="bold" fill="#1a1a1a"
            fontFamily="serif">
            Delta (Δ)
          </text>
          <polygon
            points="80,40 30,140 130,140"
            fill="none" stroke="#1a1a1a" strokeWidth={2}
          />
          <text x={42} y={95} fontSize={10} fill="#3b82f6"
            fontFamily="serif" fontStyle="italic">Z₁</text>
          <text x={110} y={95} fontSize={10} fill="#3b82f6"
            fontFamily="serif" fontStyle="italic">Z₂</text>
          <text x={75} y={152} fontSize={10} fill="#3b82f6"
            fontFamily="serif" fontStyle="italic">Z₃</text>
          {[[80, 40], [30, 140], [130, 140]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4}
              fill="#1a1a1a" />
          ))}
          <text x={80} y={35} textAnchor="middle"
            fontSize={9} fill="#6b7280" fontFamily="serif">A</text>
          <text x={22} y={145} fontSize={9} fill="#6b7280"
            fontFamily="serif">B</text>
          <text x={133} y={145} fontSize={9} fill="#6b7280"
            fontFamily="serif">C</text>

          <line x1={200} y1={20} x2={200} y2={170}
            stroke="#e5e7eb" strokeWidth={1}
            strokeDasharray="4 4" />

          <text x={310} y={20} textAnchor="middle"
            fontSize={12} fontWeight="bold" fill="#1a1a1a"
            fontFamily="serif">
            Wye (Y)
          </text>
          <circle cx={310} cy={110} r={4} fill="#1a1a1a" />
          <text x={318} y={114} fontSize={9} fill="#6b7280"
            fontFamily="serif">N</text>
          {[
            [310, 40, 'A'],
            [240, 155, 'B'],
            [380, 155, 'C'],
          ].map(([x, y, label], i) => (
            <g key={i}>
              <line x1={310} y1={110}
                x2={x as number} y2={y as number}
                stroke="#1a1a1a" strokeWidth={2} />
              <circle cx={x as number} cy={y as number}
                r={4} fill="#1a1a1a" />
              <text
                x={(310 + (x as number)) / 2 + (i === 0 ? 8 : i === 1 ? -12 : 8)}
                y={(110 + (y as number)) / 2}
                fontSize={10} fill="#3b82f6"
                fontFamily="serif" fontStyle="italic">
                {`Z${i + 1}`}
              </text>
              <text
                x={(x as number) + (i === 0 ? 0 : i === 1 ? -14 : 6)}
                y={(y as number) + (i === 0 ? -8 : 12)}
                fontSize={9} fill="#6b7280"
                fontFamily="serif">
                {label as string}
              </text>
            </g>
          ))}
        </svg>
      );
    }

    const renderDiagram = () => {
      switch (config.type) {
        case 'slope':
          return <SlopeRenderer config={config} />;
        case 'pulley':
          return <PulleyRenderer config={config} />;
        case 'beam':
          return <BeamRenderer config={config} />;
        case 'projectile':
          return <ProjectileRenderer config={config} />;
        case 'rod':
          return <RodRenderer config={config} />;
        case 'free_body':
          return <FreeBodyRenderer config={config} />;
        case 'conical_pendulum':
          return <ConicalPendulumRenderer config={config} />;
        case 'vertical_motion':
          return <VerticalMotionRenderer config={config} />;
        case 'vertical_lift':
          return <VerticalLiftRenderer config={config as any} />;
        default:
          return null;
      }
    };

    const diagram = renderDiagram();
    if (!diagram) {
      return <MissingDiagram type={config.type} />;
    }

    const viewBoxForType = (t: string): { vb: string; mw: number } => {
      if (t === 'projectile') return { vb: '0 0 560 420', mw: 520 };
      if (t === 'slope') return { vb: '0 0 520 400', mw: 500 };
      if (t === 'beam') return { vb: '0 0 560 420', mw: 520 };
      if (t === 'rod') return { vb: '0 0 480 420', mw: width };
      if (t === 'collision') return { vb: '0 0 480 420', mw: 460 };
      if (t === 'spring_mass') return { vb: '0 0 440 400', mw: 420 };
      if (t === 'connected_particles') return { vb: '0 0 520 420', mw: 500 };
      return { vb: '0 0 480 380', mw: width };
    };
    const { vb, mw } = viewBoxForType(config.type);

    return (
      <svg
        viewBox={vb}
        width="100%"
        style={{ maxWidth: mw, display: 'block', margin: '0 auto', background: COLORS.background, border: '1px solid #e5e7eb', borderRadius: 6 }}
      >
        <g transform="translate(40, 40)">
          <ArrowMarkerDefs />
          {diagram}
        </g>
      </svg>
    );
  } catch (err: any) {
    return <MissingDiagram type={config?.type} error={err?.message} />;
  }
};

export default MechanicsDraw;
