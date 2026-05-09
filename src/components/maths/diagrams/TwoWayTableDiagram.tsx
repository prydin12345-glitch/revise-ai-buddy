import type { TwoWayTableConfig } from '../types';

interface Props { config: TwoWayTableConfig; }

export const TwoWayTableDiagram = ({ config }: Props) => {
  const {
    rowVariable, colVariable, rowLabels, colLabels,
    data, rowTotals, colTotals, grandTotal,
    title, highlightCell,
  } = config;

  const cellW = Math.min(80, Math.max(60, 320 / (colLabels.length + 1)));
  const cellH = 38;
  const headerH = 44;
  const labelW = 90;
  const totalColW = 72;

  const tableW = labelW + (colLabels.length + 1) * cellW + totalColW + 24;
  const tableH = headerH * 2 + rowLabels.length * cellH + cellH + 40;
  const svgW = tableW + 20;
  const svgH = tableH + 40;

  const ox = 10;
  const oy = title ? 32 : 12;

  const cellStyle = (row: number, col: number, isHeader = false, isTotal = false) => {
    const isHighlighted = highlightCell?.row === row && highlightCell?.col === col;
    return {
      fill: isHighlighted
        ? 'hsl(221 83% 53% / 0.15)'
        : isHeader || isTotal
        ? 'hsl(var(--muted) / 0.4)'
        : 'hsl(var(--background))',
      stroke: 'hsl(var(--border))',
    };
  };

  const renderCell = (
    x: number, y: number, w: number, h: number,
    content: string | number | null,
    isHeader = false, isTotal = false,
    row = -1, col = -1,
    key?: string,
  ) => {
    const style = cellStyle(row, col, isHeader, isTotal);
    const isEmpty = content === null || content === undefined || content === '';
    return (
      <g key={key ?? `${x}-${y}`}>
        <rect x={x} y={y} width={w} height={h}
          fill={style.fill} stroke={style.stroke} strokeWidth={1} />
        {!isEmpty && (
          <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle"
            fontSize={isHeader ? 11 : 13}
            fontWeight={isHeader || isTotal ? 700 : 400}
            fill="hsl(var(--foreground))">{content}</text>
        )}
        {isEmpty && !isHeader && (
          <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle"
            fontSize={11} fill="hsl(var(--muted-foreground) / 0.5)">?</text>
        )}
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}>
      {title && (
        <text x={svgW / 2} y={20} textAnchor="middle" fontSize={12} fontWeight={700}
          fill="hsl(var(--foreground))">{title}</text>
      )}
      <text x={ox + labelW + ((colLabels.length + 1) * cellW) / 2} y={oy + 14}
        textAnchor="middle" fontSize={11} fontWeight={700}
        fill="hsl(var(--muted-foreground))">{colVariable}</text>
      <text x={ox + 10} y={oy + headerH + (rowLabels.length * cellH) / 2}
        textAnchor="middle" fontSize={11} fontWeight={700}
        fill="hsl(var(--muted-foreground))"
        transform={`rotate(-90, ${ox + 10}, ${oy + headerH + (rowLabels.length * cellH) / 2})`}>
        {rowVariable}
      </text>
      {renderCell(ox + labelW, oy + headerH, cellW, headerH, '', true, false, -1, -1, 'corner')}
      {colLabels.map((label, ci) =>
        renderCell(ox + labelW + (ci + 1) * cellW, oy + headerH, cellW, headerH,
          label, true, false, -1, -1, `colhdr-${ci}`),
      )}
      {renderCell(
        ox + labelW + (colLabels.length + 1) * cellW, oy + headerH,
        totalColW, headerH, 'Total', true, false, -1, -1, 'totalhdr',
      )}
      {rowLabels.map((rowLabel, ri) => (
        <g key={`row-${ri}`}>
          {renderCell(ox + labelW, oy + headerH * 2 + ri * cellH, cellW, cellH,
            rowLabel, true, false, -1, -1, `rowhdr-${ri}`)}
          {colLabels.map((_, ci) =>
            renderCell(
              ox + labelW + (ci + 1) * cellW,
              oy + headerH * 2 + ri * cellH,
              cellW, cellH,
              data[ri]?.[ci] ?? null,
              false, false, ri, ci, `cell-${ri}-${ci}`,
            ),
          )}
          {renderCell(
            ox + labelW + (colLabels.length + 1) * cellW,
            oy + headerH * 2 + ri * cellH,
            totalColW, cellH,
            rowTotals?.[ri] ?? null,
            false, true, -1, -1, `rowtotal-${ri}`,
          )}
        </g>
      ))}
      {renderCell(
        ox + labelW, oy + headerH * 2 + rowLabels.length * cellH,
        cellW, cellH, 'Total', true, false, -1, -1, 'totalrow',
      )}
      {colLabels.map((_, ci) =>
        renderCell(
          ox + labelW + (ci + 1) * cellW,
          oy + headerH * 2 + rowLabels.length * cellH,
          cellW, cellH,
          colTotals?.[ci] ?? null,
          false, true, -1, -1, `coltotal-${ci}`,
        ),
      )}
      {renderCell(
        ox + labelW + (colLabels.length + 1) * cellW,
        oy + headerH * 2 + rowLabels.length * cellH,
        totalColW, cellH,
        grandTotal ?? null,
        false, true, -1, -1, 'grandtotal',
      )}
    </svg>
  );
};

export default TwoWayTableDiagram;
