import type { ProbabilityTreeConfig, TreeBranch } from '../types';

interface Props { config: ProbabilityTreeConfig; }

export const ProbabilityTreeDiagram = ({ config }: Props) => {
  const { branches, showOutcomes, showFinalProbabilities, title } = config;

  const countLeaves = (bs: TreeBranch[]): number =>
    bs.reduce((sum, b) => sum + (b.children ? countLeaves(b.children) : 1), 0);

  const totalLeaves = countLeaves(branches);

  const SVG_W = showOutcomes ? 660 : 480;
  const LEAF_HEIGHT = Math.max(36, Math.min(56, 340 / totalLeaves));
  const SVG_H = Math.max(280, totalLeaves * LEAF_HEIGHT + 80);
  const MARGIN = { top: 48, left: 40, right: showOutcomes ? 240 : 40 };

  const plotW = SVG_W - MARGIN.left - MARGIN.right;
  const stages = config.stages;
  const stageW = plotW / (stages + 0.5);

  interface NodePos {
    x: number; y: number; branch: TreeBranch; depth: number;
    leafStart: number; leafCount: number;
  }

  const computePositions = (
    bs: TreeBranch[], depth: number, leafStart: number,
  ): NodePos[] => {
    const nodes: NodePos[] = [];
    let currentLeaf = leafStart;
    bs.forEach(branch => {
      const leafCount = branch.children ? countLeaves(branch.children) : 1;
      const leafMid = currentLeaf + leafCount / 2;
      const x = MARGIN.left + depth * stageW;
      const y = MARGIN.top + leafMid * LEAF_HEIGHT;
      nodes.push({ x, y, branch, depth, leafStart: currentLeaf, leafCount });
      if (branch.children) {
        nodes.push(...computePositions(branch.children, depth + 1, currentLeaf));
      }
      currentLeaf += leafCount;
    });
    return nodes;
  };

  const rootX = MARGIN.left;
  const rootY = MARGIN.top + (totalLeaves * LEAF_HEIGHT) / 2;

  const allNodes = computePositions(branches, 1, 0);

  const edges: Array<{
    x1: number; y1: number; x2: number; y2: number;
    label: string; probLabel: string;
  }> = [];

  const buildEdges = (
    bs: TreeBranch[], depth: number, leafStart: number,
    parentX: number, parentY: number,
  ) => {
    let currentLeaf = leafStart;
    bs.forEach(branch => {
      const leafCount = branch.children ? countLeaves(branch.children) : 1;
      const leafMid = currentLeaf + leafCount / 2;
      const x = MARGIN.left + depth * stageW;
      const y = MARGIN.top + leafMid * LEAF_HEIGHT;
      edges.push({
        x1: parentX, y1: parentY, x2: x, y2: y,
        label: branch.label, probLabel: branch.probability,
      });
      if (branch.children) {
        buildEdges(branch.children, depth + 1, currentLeaf, x, y);
      }
      currentLeaf += leafCount;
    });
  };

  buildEdges(branches, 1, 0, rootX, rootY);

  interface LeafData { outcome: string; probability: string; y: number; highlighted: boolean; }

  const computeLeaves = (
    bs: TreeBranch[], leafStart: number, path: string[], probs: string[],
  ): LeafData[] => {
    const leaves: LeafData[] = [];
    let currentLeaf = leafStart;
    bs.forEach(branch => {
      const newPath = [...path, branch.label];
      const newProbs = [...probs, branch.probability];
      if (!branch.children) {
        const leafMid = currentLeaf + 0.5;
        const y = MARGIN.top + leafMid * LEAF_HEIGHT;
        let probProduct = '';
        if (showFinalProbabilities) {
          if (newProbs.every(p => p.includes('/'))) {
            const nums = newProbs.map(p => parseInt(p.split('/')[0]));
            const dens = newProbs.map(p => parseInt(p.split('/')[1]));
            const num = nums.reduce((a, b) => a * b, 1);
            const den = dens.reduce((a, b) => a * b, 1);
            const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
            const g = gcd(num, den);
            probProduct = `${num / g}/${den / g}`;
          } else {
            const product = newProbs
              .map(p => parseFloat(p.replace('%', '')) / (p.includes('%') ? 100 : 1))
              .reduce((a, b) => a * b, 1);
            probProduct = product % 1 === 0 ? product.toString() : product.toFixed(4).replace(/\.?0+$/, '');
          }
        }
        leaves.push({
          outcome: newPath.join(''),
          probability: probProduct,
          y,
          highlighted: branch.highlight ?? false,
        });
        currentLeaf++;
      } else {
        const childLeaves = computeLeaves(branch.children, currentLeaf, newPath, newProbs);
        leaves.push(...childLeaves);
        currentLeaf += countLeaves(branch.children);
      }
    });
    return leaves;
  };

  const leaves = computeLeaves(branches, 0, [], []);
  const leafX = MARGIN.left + stages * stageW;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%"
      style={{ maxWidth: SVG_W, display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {title && (
        <text x={SVG_W / 2} y={24} textAnchor="middle" fontSize={12} fontWeight={700}
          fill="hsl(var(--foreground))">{title}</text>
      )}
      {Array.from({ length: stages }, (_, i) => (
        <text key={i} x={MARGIN.left + (i + 1) * stageW} y={32}
          textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
          {stages === 1 ? 'Trial 1' : stages === 2 ? (i === 0 ? '1st trial' : '2nd trial') : `Trial ${i + 1}`}
        </text>
      ))}
      {showOutcomes && (
        <text x={leafX + 16} y={32} fontSize={10} fill="hsl(var(--muted-foreground))">Outcome</text>
      )}
      {showFinalProbabilities && showOutcomes && (
        <text x={leafX + 90} y={32} fontSize={10} fill="hsl(var(--muted-foreground))">Probability</text>
      )}
      <circle cx={rootX} cy={rootY} r={4} fill="hsl(var(--foreground))" />
      {edges.map((edge, i) => {
        const midX = (edge.x1 + edge.x2) / 2;
        const midY = (edge.y1 + edge.y2) / 2;
        const dx = edge.x2 - edge.x1;
        const dy = edge.y2 - edge.y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const offsetX = (-dy / len) * 10;
        const offsetY = (dx / len) * 10;
        return (
          <g key={i}>
            <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
              stroke="hsl(var(--foreground))" strokeWidth={1.5} opacity={0.7} />
            <text x={edge.x2 + 8} y={edge.y2 + 4} fontSize={12} fontWeight={600}
              fill="hsl(221 83% 53%)">{edge.label}</text>
            <text x={midX + offsetX} y={midY + offsetY + 4} textAnchor="middle"
              fontSize={10} fill="hsl(0 84% 60%)">{edge.probLabel}</text>
          </g>
        );
      })}
      {allNodes.map((node, i) => (
        <circle key={i} cx={node.x} cy={node.y} r={3.5}
          fill="hsl(var(--foreground))" opacity={0.8} />
      ))}
      {showOutcomes && leaves.map((leaf, i) => (
        <g key={i}>
          {leaf.highlighted && (
            <rect x={leafX + 10} y={leaf.y - 10} width={160} height={18} rx={3}
              fill="hsl(142 71% 45% / 0.08)" stroke="hsl(142 71% 45% / 0.3)" strokeWidth={0.5} />
          )}
          <text x={leafX + 16} y={leaf.y + 4} fontSize={11}
            fontWeight={leaf.highlighted ? 700 : 400}
            fill={leaf.highlighted ? 'hsl(142 71% 45%)' : 'hsl(var(--foreground))'}>
            {leaf.outcome}
          </text>
          {showFinalProbabilities && (
            <text x={leafX + 90} y={leaf.y + 4} fontSize={11}
              fill={leaf.highlighted ? 'hsl(142 71% 45%)' : 'hsl(var(--muted-foreground))'}>
              {leaf.probability}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

export default ProbabilityTreeDiagram;
