import type { CircuitConfig, CircuitComponentType } from './types';

/**
 * Auto-generates a simple rectangular series circuit config
 * from a list of component types and a battery EMF label.
 */
export function generateSeriesConfig(
  components: CircuitComponentType[],
  emf: string = '6V'
): CircuitConfig {
  // Place components around a rectangle: top → right → bottom → left
  const count = components.length;

  // Determine grid size based on component count
  const cols = Math.max(2, Math.ceil(count / 2));
  const rows = 2;

  // Build nodes around the perimeter
  const perimeterNodes: { id: string; col: number; row: number }[] = [];

  // Top row: left to right
  for (let c = 0; c <= cols; c++) {
    perimeterNodes.push({ id: `T${c}`, col: c, row: 0 });
  }
  // Right column: top to bottom (skip corner already added)
  for (let r = 1; r <= rows; r++) {
    perimeterNodes.push({ id: `R${r}`, col: cols, row: r });
  }
  // Bottom row: right to left (skip corner already added)
  for (let c = cols - 1; c >= 0; c--) {
    perimeterNodes.push({ id: `B${c}`, col: c, row: rows });
  }
  // Left column: bottom to top (skip corners already added)
  for (let r = rows - 1; r >= 1; r--) {
    perimeterNodes.push({ id: `L${r}`, col: 0, row: r });
  }

  // We need exactly count+1 nodes (count segments around the loop)
  // Trim or pad the perimeter
  const usedNodes = perimeterNodes.slice(0, count + 1);

  // Close the loop: last node connects back to first
  const wires: CircuitConfig['wires'] = [];
  for (let i = 0; i < count; i++) {
    wires.push({
      from: usedNodes[i].id,
      to: usedNodes[(i + 1) % usedNodes.length].id,
      component: components[i],
      label: components[i] === 'battery' ? emf : undefined,
    });
  }

  // Ensure loop closure if needed
  if (usedNodes.length > count) {
    wires.push({
      from: usedNodes[count].id,
      to: usedNodes[0].id,
      component: 'wire',
    });
  }

  return {
    type: 'circuit',
    gridSpacing: 80,
    nodes: usedNodes,
    wires,
    showLabels: true,
  };
}
