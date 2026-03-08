import React from 'react';
import { CIRCUIT_COLORS, CIRCUIT_FONT } from './types';

interface SymbolProps {
  x: number;
  y: number;
  rotation: number; // 0 for horizontal, 90 for vertical
  label?: string;
  showLabel: boolean;
}

const STROKE_W = 2;

/** Label positioned above horizontal components, right of vertical */
const ComponentLabel: React.FC<{ x: number; y: number; rotation: number; text: string; show: boolean }> = ({
  x, y, rotation, text, show,
}) => {
  if (!show || !text) return null;
  const isVertical = Math.abs(rotation) === 90;
  const lx = isVertical ? x + 20 : x;
  const ly = isVertical ? y : y - 18;

  return (
    <text
      x={lx}
      y={ly}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily={CIRCUIT_FONT.family}
      fontStyle={CIRCUIT_FONT.style}
      fontSize={CIRCUIT_FONT.size}
      fill={CIRCUIT_COLORS.label}
    >
      {text}
    </text>
  );
};

/** Unknown placeholder box */
const UnknownBox: React.FC<{ x: number; y: number; rotation: number }> = ({ x, y, rotation }) => {
  const isVertical = Math.abs(rotation) === 90;
  const bx = isVertical ? x + 20 : x;
  const by = isVertical ? y : y - 18;
  return (
    <g>
      <rect x={bx - 10} y={by - 8} width={20} height={16} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={1} rx={2} />
      <text x={bx} y={by} textAnchor="middle" dominantBaseline="central" fontFamily={CIRCUIT_FONT.family} fontSize={CIRCUIT_FONT.size} fill={CIRCUIT_COLORS.unknown}>?</text>
    </g>
  );
};

/** Battery — two unequal parallel lines */
export const BatterySymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <line x1={x - 6} y1={y - 12} x2={x - 6} y2={y + 12} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      <line x1={x + 6} y1={y - 7} x2={x + 6} y2={y + 7} stroke={CIRCUIT_COLORS.component} strokeWidth={3} />
      <text x={x - 14} y={y - 6} textAnchor="middle" fontSize={10} fontWeight="bold" fill={CIRCUIT_COLORS.label}>+</text>
      <text x={x + 14} y={y - 6} textAnchor="middle" fontSize={10} fontWeight="bold" fill={CIRCUIT_COLORS.label}>−</text>
      <line x1={x - 30} y1={y} x2={x - 6} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 6} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Resistor — IEC rectangle */
export const ResistorSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <rect x={x - 15} y={y - 6} width={30} height={12} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 30} y1={y} x2={x - 15} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 15} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Variable Resistor — rectangle with diagonal arrow */
export const VariableResistorSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <rect x={x - 15} y={y - 6} width={30} height={12} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 18} y1={y + 10} x2={x + 18} y2={y - 10} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      <polygon points={`${x + 18},${y - 10} ${x + 12},${y - 6} ${x + 14},${y - 12}`} fill={CIRCUIT_COLORS.component} />
      <line x1={x - 30} y1={y} x2={x - 15} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 15} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Thermistor — resistor rectangle with diagonal line and θ symbol */
export const ThermistorSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <rect x={x - 15} y={y - 6} width={30} height={12} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      {/* Diagonal line with negative slope indicator (NTC) */}
      <line x1={x - 18} y1={y + 10} x2={x + 18} y2={y - 10} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      {/* Small "θ" temperature symbol */}
      <text x={x + 22} y={y + 14} textAnchor="middle" dominantBaseline="central"
        fontFamily={CIRCUIT_FONT.family} fontStyle={CIRCUIT_FONT.style} fontSize={10} fill={CIRCUIT_COLORS.label}>θ</text>
      <line x1={x - 30} y1={y} x2={x - 15} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 15} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
    ) : !showLabel ? (
      <UnknownBox x={x} y={y} rotation={rotation} />
    ) : null}
  </g>
);

/** Lamp — circle with X inside */
export const LampSymbol: React.FC<SymbolProps> = ({ x, y, rotation, label, showLabel }) => (
  <g>
    <g transform={`rotate(${rotation}, ${x}, ${y})`}>
      <circle cx={x} cy={y} r={12} fill="white" stroke={CIRCUIT_COLORS.component} strokeWidth={STROKE_W} />
      <line x1={x - 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      <line x1={x + 8} y1={y - 8} x2={x - 8} y2={y + 8} stroke={CIRCUIT_COLORS.component} strokeWidth={1.5} />
      <line x1={x - 30} y1={y} x2={x - 12} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
      <line x1={x + 12} y1={y} x2={x + 30} y2={y} stroke={CIRCUIT_COLORS.wire} strokeWidth={STROKE_W} />
    </g>
    {showLabel && label ? (
      <ComponentLabel x={x} y={y} rotation={rotation} text={label} show={true} />
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
}> = ({ component, x, y, rotation, label, showLabel }) => {
  const props: SymbolProps = { x, y, rotation, label, showLabel };

  switch (component) {
    case 'battery': return <BatterySymbol {...props} />;
    case 'resistor': return <ResistorSymbol {...props} />;
    case 'variable_resistor': return <VariableResistorSymbol {...props} />;
    case 'thermistor': return <ThermistorSymbol {...props} />;
    case 'lamp': return <LampSymbol {...props} />;
    case 'voltmeter': return <VoltmeterSymbol {...props} />;
    case 'ammeter': return <AmmeterSymbol {...props} />;
    case 'switch_open': return <SwitchOpenSymbol {...props} />;
    case 'switch_closed': return <SwitchClosedSymbol {...props} />;
    case 'diode': return <DiodeSymbol {...props} />;
    default: return null;
  }
};
