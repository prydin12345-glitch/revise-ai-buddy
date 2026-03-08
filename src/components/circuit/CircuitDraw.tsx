import React from 'react';
import type { CircuitConfig, CircuitNode } from './types';
import { CIRCUIT_COLORS } from './types';
import { CircuitComponent, JunctionDot } from './symbols';

export interface CircuitDrawProps {
  config: CircuitConfig;
  width?: number;
}

const PADDING = 40;

const CircuitDraw: React.FC<CircuitDrawProps> = ({ config, width = 480 }) => {
  const { gridSpacing = 80, nodes = [], wires = [], junctions, showLabels } = config;

  // ── Validation guard ──
  if (!nodes.length || !wires || wires.length < 3) {
    return (
      <svg width="300" height="100" style={{ background: 'white', display: 'block', margin: '0 auto' }}>
        <rect x="10" y="10" width="280" height="80"
          fill="#fff8f8" stroke="#cc0000" strokeWidth={1} strokeDasharray="4 2" />
        <text x="150" y="55" textAnchor="middle"
          fontSize="12" fill="#cc0000" fontFamily="serif" fontStyle="italic">
          Circuit config incomplete — check generation
        </text>
      </svg>
    );
  }

  // Build node lookup
  const nodeMap = new Map<string, CircuitNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // Compute SVG dimensions dynamically from actual node positions
  const maxCol = Math.max(...nodes.map(n => n.col));
  const maxRow = Math.max(...nodes.map(n => n.row));
  const svgW = maxCol * gridSpacing + 2 * PADDING;
  const svgH = maxRow * gridSpacing + 2 * PADDING;

  const toX = (col: number) => col * gridSpacing + PADDING;
  const toY = (row: number) => row * gridSpacing + PADDING;

  // Build set of junction node IDs from the junctions array
  const junctionSet = new Set<string>();
  if (junctions) {
    junctions.forEach(j => junctionSet.add(j.at));
  }

  // Also auto-detect junctions: any node with 3+ wire connections
  const connectionCount = new Map<string, number>();
  wires.forEach(w => {
    connectionCount.set(w.from, (connectionCount.get(w.from) || 0) + 1);
    connectionCount.set(w.to, (connectionCount.get(w.to) || 0) + 1);
  });
  connectionCount.forEach((count, nodeId) => {
    if (count >= 3) junctionSet.add(nodeId);
  });

  const renderWire = (
    fromId: string,
    toId: string,
    component: string,
    label: string | undefined,
    key: string
  ) => {
    const fromNode = nodeMap.get(fromId);
    const toNode = nodeMap.get(toId);
    if (!fromNode || !toNode) return null;

    const x1 = toX(fromNode.col);
    const y1 = toY(fromNode.row);
    const x2 = toX(toNode.col);
    const y2 = toY(toNode.row);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    const isHorizontal = fromNode.row === toNode.row;
    const isVertical = fromNode.col === toNode.col;
    const rotation = isVertical ? 90 : 0;

    if (component === 'wire') {
      if (!isHorizontal && !isVertical) {
        return (
          <g key={key}>
            <polyline
              points={`${x1},${y1} ${x2},${y1} ${x2},${y2}`}
              fill="none"
              stroke={CIRCUIT_COLORS.wire}
              strokeWidth={2}
            />
          </g>
        );
      }
      return (
        <line
          key={key}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={CIRCUIT_COLORS.wire}
          strokeWidth={2}
        />
      );
    }

    // Component wire: draw wire segments with component symbol in the middle
    const componentHalf = 30;

    if (isHorizontal) {
      const dir = x2 > x1 ? 1 : -1;
      return (
        <g key={key}>
          <line x1={x1} y1={y1} x2={mx - componentHalf * dir} y2={y1} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
          <line x1={mx + componentHalf * dir} y1={y1} x2={x2} y2={y2} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
          <CircuitComponent component={component} x={mx} y={my} rotation={rotation} label={label} showLabel={showLabels} />
        </g>
      );
    }

    if (isVertical) {
      const dir = y2 > y1 ? 1 : -1;
      return (
        <g key={key}>
          <line x1={x1} y1={y1} x2={x1} y2={my - componentHalf * dir} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
          <line x1={x1} y1={my + componentHalf * dir} x2={x2} y2={y2} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
          <CircuitComponent component={component} x={mx} y={my} rotation={rotation} label={label} showLabel={showLabels} />
        </g>
      );
    }

    // Diagonal: L-route with component on the longer segment
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    if (dx >= dy) {
      const cornerX = x2;
      const cornerY = y1;
      const segMx = (x1 + cornerX) / 2;
      return (
        <g key={key}>
          <line x1={x1} y1={y1} x2={segMx - 30} y2={y1} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
          <CircuitComponent component={component} x={segMx} y={y1} rotation={0} label={label} showLabel={showLabels} />
          <line x1={segMx + 30} y1={y1} x2={cornerX} y2={cornerY} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
          <line x1={cornerX} y1={cornerY} x2={x2} y2={y2} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
        </g>
      );
    } else {
      const cornerX = x1;
      const cornerY = y2;
      const segMy = (y1 + cornerY) / 2;
      return (
        <g key={key}>
          <line x1={x1} y1={y1} x2={x1} y2={segMy - 30} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
          <CircuitComponent component={component} x={x1} y={segMy} rotation={90} label={label} showLabel={showLabels} />
          <line x1={x1} y1={segMy + 30} x2={cornerX} y2={cornerY} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
          <line x1={cornerX} y1={cornerY} x2={x2} y2={y2} stroke={CIRCUIT_COLORS.wire} strokeWidth={2} />
        </g>
      );
    }
  };

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      width="100%"
      style={{
        maxWidth: width,
        display: 'block',
        margin: '0 auto',
        background: 'white',
        borderRadius: 4,
      }}
    >
      {/* Render all wires + components */}
      {wires.map((w, i) => renderWire(w.from, w.to, w.component, w.label, `wire-${i}`))}

      {/* Render junction dots for all marked junctions */}
      {nodes.map(n => {
        if (junctionSet.has(n.id)) {
          return <JunctionDot key={`dot-${n.id}`} x={toX(n.col)} y={toY(n.row)} />;
        }
        return null;
      })}
    </svg>
  );
};

export default CircuitDraw;
