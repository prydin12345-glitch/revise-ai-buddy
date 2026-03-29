import React from 'react';
import { CIRCUIT_COLORS, CIRCUIT_FONT } from './types';

interface SymbolProps {
  x: number;
  y: number;
  rotation: number; // 0 for horizontal, 90 for vertical
  label?: string;
  showLabel: boolean;
  highlight?: boolean; // optional highlight for focused component
}

const STROKE_W = 2;
const HIGHLIGHT_COLOR = '#0066cc';

/** Label positioned with generous padding from component body */
const ComponentLabel: React.FC<{
  x: number; y: number; rotation: number; text: string; show: boolean; highlight?: boolean;
}> = ({ x, y, rotation, text, show, highlight }) => {
  if (!show || !text) return null;
  const isVertical = Math.abs(rotation) === 90;
  // Increased offset: 28px for horizontal (was 18), 26px for vertical (was 20)
  const lx = isVertical ? x + 26 : x;
  const ly = isVertical ? y : y - 24;

  return (
    <text
      x={lx}
      y={ly}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily={CIRCUIT_FONT.family}
      fontStyle={CIRCUIT_FONT.style}
      fontSize={CIRCUIT_FONT.size}
      fill={highlight ? HIGHLIGHT_COLOR : CIRCUIT_COLORS.label}
      fontWeight={highlight ? 'bold' : 'normal'}
    >
      {text}
    </text>
  );
};

/** Unknown placeholder box */
const UnknownBox: React.FC<{ x: number; y: number; rotation: number }> = ({ x, y, rotation }) => {
  const isVertical = Math.abs(rotation) === 90;
  const bx = isVertical ? x + 26 : x;
  const by = isVertical ? y : y - 24;
  return (
    <g>
      <rect x={bx - 10} y={by - 8} width={20} height={16} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={1} rx={2} />
      <text x={bx} y={by} textAnchor="middle" dominantBaseline="central" fontFamily={CIRCUIT_FONT.family} fontSize={CIRCUIT_FONT.size} fill={CIRCUIT_COLORS.unknown}>?</text>
    </g>
  );
};

/** Battery — two unequal parallel lines, +/- labels positioned clearly outside wires */
export const BatterySymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel, highlight }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      {/* Long thin line = positive plate */}
      <line x1={x - 6} y1={y - 12} x2={x - 6} y2={y + 12} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      {/* Short thick line = negative plate */}
      <line x1={x + 6} y1={y - 7} x2={x + 6} y2={y + 7} stroke={CIRCUIT_COLORS.component} strokeWidth={3} />
      {/* +/- labels pushed further out and positioned above the plates, not on the wire */}
      <text x={x - 10} y={y - 16} textAnchor="middle" fontSize={9} fontWeight="bold" fill={CIRCUIT_COLORS.label}>+</text>
      <text x={x + 10} y={y - 16} textAnchor="middle" fontSize={9} fontWeight="bold" fill={CIRCUIT_COLORS.label}>−</text>
      {/* Wire stubs connecting to the plates */}
      <line x1={x - 30} y1={y} x2={x - 6} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 6} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {/* ε / EMF label positioned well above the battery, not overlapping +/- */}
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} highlight={highlight} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Resistor — IEC rectangle */
export const ResistorSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel, highlight }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      {highlight && (
        <rect x={x - 17} y={y - 8} width={34} height={16} fill="none" stroke={HIGHLIGHT_COLOR} strokeWidth={2.5} strokeDasharray="4 2" rx={3} />
      )}
      <rect x={x - 15} y={y - 6} width={30} height={12} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 30} y1={y} x2={x - 15} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 15} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} highlight={highlight} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Variable Resistor — rectangle with diagonal arrow */
export const VariableResistorSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel, highlight }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <rect x={x - 15} y={y - 6} width={30} height={12} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 18} y1={y + 10} x2={x + 18} y2={y - 10} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      <polygon points={`${x + 18},${y - 10} ${x + 12},${y - 6} ${x + 14},${y - 12}`} fill={CIRCUIT_COLORS.component} />
      <line x1={x - 30} y1={y} x2={x - 15} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 15} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} highlight={highlight} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Thermistor — resistor rectangle with diagonal line and θ symbol */
export const ThermistorSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel, highlight }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <rect x={x - 15} y={y - 6} width={30} height={12} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 18} y1={y + 10} x2={x + 18} y2={y - 10} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      <text x={x + 22} y={y + 14} textAnchor="middle" dominantBaseline="central"
        fontFamily={CIRCUIT_FONT.family} fontStyle={CIRCUIT_FONT.style} fontSize={10} fill={CIRCUIT_COLORS.label}>θ</text>
      <line x1={x - 30} y1={y} x2={x - 15} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 15} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} highlight={highlight} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Lamp — circle with X inside */
export const LampSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel, highlight }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <circle cx={x} cy={y} r={12} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      <line x1={x + 8} y1={y - 8} x2={x - 8} y2={y + 8} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      <line x1={x - 30} y1={y} x2={x - 12} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 12} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} highlight={highlight} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Voltmeter — circle with V */
export const VoltmeterSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <circle cx={x} cy={y} r={14} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontFamily={CIRCUIT_FONT.family} fontStyle={CIRCUIT_FONT.style} fontSize={14} fill={CIRCUIT_COLORS.label}>V</text>
      <line x1={x - 30} y1={y} x2={x - 14} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 14} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : null}
  </g>
);

/** Ammeter — circle with A */
export const AmmeterSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <circle cx={x} cy={y} r={14} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontFamily={CIRCUIT_FONT.family} fontStyle={CIRCUIT_FONT.style} fontSize={14} fill={CIRCUIT_COLORS.label}>A</text>
      <line x1={x - 30} y1={y} x2={x - 14} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 14} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : null}
  </g>
);

/** Switch (open) — dot + angled line */
export const SwitchOpenSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <circle cx={x - 12} cy={y} r={3} fill={CIRCUIT_COLORS.component} />
      <circle cx={x + 12} cy={y} r={3} fill={CIRCUIT_COLORS.component} />
      <line x1={x - 12} y1={y} x2={x + 10} y2={y - 12} stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 30} y1={y} x2={x - 12} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 12} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : null}
  </g>
);

/** Switch (closed) — dot + flat line */
export const SwitchClosedSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <circle cx={x - 12} cy={y} r={3} fill={CIRCUIT_COLORS.component} />
      <circle cx={x + 12} cy={y} r={3} fill={CIRCUIT_COLORS.component} />
      <line x1={x - 12} y1={y} x2={x + 12} y2={y} stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 30} y1={y} x2={x - 12} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 12} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : null}
  </g>
);

/** Diode — triangle with bar */
export const DiodeSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <polygon points={`${x - 8},${y - 8} ${x - 8},${y + 8} ${x + 8},${y}`} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x + 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 30} y1={y} x2={x - 8} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 8} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Motor — circle with M inside */
export const MotorSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <circle cx={x} cy={y} r={14} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontFamily={CIRCUIT_FONT.family} fontStyle={CIRCUIT_FONT.style} fontSize={14} fill={CIRCUIT_COLORS.label}>M</text>
      <line x1={x - 30} y1={y} x2={x - 14} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 14} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : null}
  </g>
);

/** Junction dot */
export const JunctionDot: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <circle cx={x} cy={y} r={4} fill={CIRCUIT_COLORS.junction} />
);

/** Renders the appropriate component symbol */
export const CircuitComponent: React.FC<{
  component: string;
  x: number;
  y: number;
  rotation: number;
  label?: string;
  showLabel: boolean;
  highlight?: boolean;
}> = ({ component, x, y, rotation, label, showLabel, highlight }) => {
  const props: SymbolProps = { x, y, rotation, label, showLabel, highlight };

  switch (component) {
    case 'battery': return <BatterySymbol {...props} />;
    case 'resistor': return <ResistorSymbol {...props} />;
    case 'variable_resistor': return <VariableResistorSymbol {...props} />;
    case 'thermistor': return <ThermistorSymbol {...props} />;
    case 'lamp': return <LampSymbol {...props} />;
    case 'voltmeter': return <VoltmeterSymbol {...props} />;
    case 'ammeter': return <AmmeterSymbol {...props} />;
    case 'motor': return <MotorSymbol {...props} />;
    case 'switch_open': return <SwitchOpenSymbol {...props} />;
    case 'switch_closed': return <SwitchClosedSymbol {...props} />;
    case 'diode': return <DiodeSymbol {...props} />;
    case 'ac_source': return <AcSourceSymbol {...props} />;
    case 'inductor': return <InductorSymbol {...props} />;
    case 'capacitor': return <CapacitorSymbol {...props} />;
    case 'impedance': return <ImpedanceSymbol {...props} />;
    case 'fuse': return <FuseSymbol {...props} />;
    case 'current_source': return <CurrentSourceSymbol {...props} />;
    case 'ground': return (
      <g>
        <line x1={x} y1={y - 10} x2={x} y2={y} stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
        <line x1={x - 12} y1={y} x2={x + 12} y2={y} stroke={CIRCUIT_COLORS.component} strokeWidth={2} />
        <line x1={x - 8} y1={y + 5} x2={x + 8} y2={y + 5} stroke={CIRCUIT_COLORS.component} strokeWidth={2} />
        <line x1={x - 4} y1={y + 10} x2={x + 4} y2={y + 10} stroke={CIRCUIT_COLORS.component} strokeWidth={2} />
      </g>
    );
    case 'open_terminal': return (
      <circle cx={x} cy={y} r={5} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
    );
    default: return (
      <g transform={`rotate(${rotation}, ${x}, ${y})`}>
        <line x1={x - 30} y1={y} x2={x - 15} y2={y} stroke="#cc0000" strokeWidth={STROKE_W} />
        <line x1={x + 15} y1={y} x2={x + 30} y2={y} stroke="#cc0000" strokeWidth={STROKE_W} />
        <rect x={x - 15} y={y - 8} width={30} height={16} fill="#fff8f8" stroke="#cc0000" strokeWidth={1.5} strokeDasharray="3 2" rx={2} />
        <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fill="#cc0000" fontFamily="serif">?</text>
      </g>
    );
  }
};
