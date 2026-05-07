import type { SampleSpaceConfig } from '../types';

interface Props { config: SampleSpaceConfig; }

export const SampleSpaceDiagram = ({ config }: Props) => {
  const {
    event1Label, event2Label,
    event1Values, event2Values,
    highlightCondition, title,
  } = config;

  const cellSize = Math.min(44, Math.max(32, 280 / Math.max(event1Values.length, event2Values.length)));
  const headerSize = cellSize;
  const labelW = 60;
  const svgW = labelW + (event2Values.length + 1) * cellSize + 20;
  const svgH = (event1Values.length + 2) * cellSize + 48;

  const isHighlighted = (v1: string, v2: string): boolean => {
    if (!highlightCondition) return false;
    const n1 = parseInt(v1);
    const n2 = parseInt(v2);
    try {
      if (highlightCondition === 'equal') return v1 === v2;
      const sum = n1 + n2;
      if (highlightCondition.startsWith('sum >')) {
        return sum > parseInt(highlightCondition.replace('sum >', '').trim());
      }
      if (highlightCondition.startsWith('sum ===')) {
        return sum === parseInt(highlightCondition.replace('sum ===', '').trim());
      }
      if (highlightCondition.startsWith('sum <')) {
        return sum < parseInt(highlightCondition.replace('sum <', '').trim());
      }
    } catch { return false; }
    return false;
  };

  const ox = 10;
  const oy = title ? 36 : 12;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}>
      {title && (
        <text x={svgW / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700}
          fill="hsl(var(--foreground))">{title}</text>
      )}
      <text x={ox + labelW + (event2Values.length * cellSize) / 2} y={oy + 14}
        textAnchor="middle" fontSize={11} fontWeight={700}
        fill="hsl(var(--muted-foreground))">{event2Label}</text>
      <text x={ox + 10}
        y={oy + headerSize + (event1Values.length * cellSize) / 2}
        textAnchor="middle" fontSize={11} fontWeight={700}
        fill="hsl(var(--muted-foreground))"
        transform={`rotate(-90, ${ox + 10}, ${oy + headerSize + (event1Values.length * cellSize) / 2})`}>
        {event1Label}
      </text>
      {event2Values.map((v, ci) => (
        <g key={`hdr-${ci}`}>
          <rect x={ox + labelW + ci * cellSize} y={oy + headerSize}
            width={cellSize} height={headerSize}
            fill="hsl(var(--muted)/0.5)" stroke="hsl(var(--border))" strokeWidth={1} />
          <text x={ox + labelW + ci * cellSize + cellSize / 2}
            y={oy + headerSize + headerSize / 2 + 5}
            textAnchor="middle" fontSize={12} fontWeight={700}
            fill="hsl(var(--foreground))">{v}</text>
        </g>
      ))}
      {event1Values.map((v1, ri) => (
        <g key={`row-${ri}`}>
          <rect x={ox + labelW} y={oy + headerSize * 2 + ri * cellSize}
            width={cellSize} height={cellSize}
            fill="hsl(var(--muted)/0.5)" stroke="hsl(var(--border))" strokeWidth={1} />
          <text x={ox + labelW + cellSize / 2}
            y={oy + headerSize * 2 + ri * cellSize + cellSize / 2 + 5}
            textAnchor="middle" fontSize={12} fontWeight={700}
            fill="hsl(var(--foreground))">{v1}</text>
          {event2Values.map((v2, ci) => {
            const highlighted = isHighlighted(v1, v2);
            const n1 = parseInt(v1);
            const n2 = parseInt(v2);
            const cellValue = !isNaN(n1) && !isNaN(n2) ? `${n1 + n2}` : `(${v1},${v2})`;
            return (
              <g key={`cell-${ri}-${ci}`}>
                <rect x={ox + labelW + (ci + 1) * cellSize}
                  y={oy + headerSize * 2 + ri * cellSize}
                  width={cellSize} height={cellSize}
                  fill={highlighted ? 'hsl(221 83% 53% / 0.2)' : 'white'}
                  stroke="hsl(var(--border))" strokeWidth={1} />
                <text x={ox + labelW + (ci + 1) * cellSize + cellSize / 2}
                  y={oy + headerSize * 2 + ri * cellSize + cellSize / 2 + 5}
                  textAnchor="middle"
                  fontSize={cellSize > 38 ? 12 : 10}
                  fontWeight={highlighted ? 700 : 400}
                  fill={highlighted ? 'hsl(221 83% 53%)' : 'hsl(var(--foreground))'}>
                  {cellValue}
                </text>
              </g>
            );
          })}
        </g>
      ))}
      {highlightCondition && (
        <text x={svgW / 2} y={svgH - 8} textAnchor="middle" fontSize={10}
          fill="hsl(var(--muted-foreground))">
          Highlighted outcomes satisfy the condition
        </text>
      )}
    </svg>
  );
};

export default SampleSpaceDiagram;
