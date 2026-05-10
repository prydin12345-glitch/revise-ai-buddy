import { useState } from 'react';
import type { TwoWayTableConfig } from '../types';

interface Props {
  config: TwoWayTableConfig;
  isPracticeQuiz?: boolean;
  isSubmitted?: boolean;
  isAnswerRevealed?: boolean;
}

export const TwoWayTableDiagram = ({
  config,
  isPracticeQuiz = false,
  isSubmitted = false,
  isAnswerRevealed = false,
}: Props) => {
  const {
    rowVariable, colVariable, rowLabels, colLabels,
    data, rowTotals, colTotals, grandTotal,
    givenData, givenRowTotals, givenColTotals,
    title, highlightCell,
  } = config;

  const cellW = Math.min(86, Math.max(64, 360 / (colLabels.length + 1)));
  const cellH = 42;
  const headerH = 44;
  const labelW = 90;
  const totalColW = 76;

  const tableW = labelW + (colLabels.length + 1) * cellW + totalColW + 24;
  const tableH = headerH * 2 + rowLabels.length * cellH + cellH + 40;
  const svgW = tableW + 20;
  const svgH = tableH + 40;

  const ox = 10;
  const oy = title ? 32 : 12;

  // Identify which cells were originally blank — only those become inputs
  // for the practice-quiz interactive flow.
  const isBlankCell = (ri: number, ci: number): boolean => {
    if (!givenData) return data[ri]?.[ci] == null;
    return givenData[ri]?.[ci] == null;
  };
  const isBlankRowTotal = (ri: number): boolean => {
    if (!givenRowTotals) return rowTotals?.[ri] == null;
    return givenRowTotals[ri] == null;
  };
  const isBlankColTotal = (ci: number): boolean => {
    if (!givenColTotals) return colTotals?.[ci] == null;
    return givenColTotals[ci] == null;
  };

  // Student inputs keyed "r-c" for data cells, "rt-r"/"ct-c" for totals.
  const [studentInputs, setStudentInputs] = useState<Record<string, string>>({});
  const setInput = (key: string, value: string) =>
    setStudentInputs(prev => ({ ...prev, [key]: value }));

  // The interactive (input) view is shown only in a practice quiz, before
  // submit, and before the student reveals the answer.
  const showInputs = isPracticeQuiz && !isSubmitted && !isAnswerRevealed;
  // After submit (or answer revealed), show comparison feedback.
  const showFeedback = isPracticeQuiz && (isSubmitted || isAnswerRevealed);

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

  const renderInteractiveCell = (
    x: number, y: number, w: number, h: number,
    inputKey: string, correctValue: number | null,
    key: string,
  ) => {
    const studentVal = studentInputs[inputKey] ?? '';
    const studentNum = studentVal === '' ? null : Number(studentVal);
    const correct = correctValue != null && studentNum === correctValue;

    if (showInputs) {
      return (
        <foreignObject key={key} x={x} y={y} width={w} height={h}>
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px dashed hsl(var(--muted-foreground) / 0.4)',
            background: 'hsl(var(--muted) / 0.15)',
            boxSizing: 'border-box',
          }}>
            <input
              type="number"
              value={studentVal}
              onChange={e => setInput(inputKey, e.target.value)}
              placeholder="?"
              style={{
                width: '100%', height: '100%',
                background: 'transparent',
                border: 'none', outline: 'none',
                textAlign: 'center',
                fontSize: 14, fontWeight: 600,
                color: 'hsl(var(--foreground))',
                padding: '0 4px',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </foreignObject>
      );
    }

    if (showFeedback) {
      const studentAttempted = studentVal !== '';
      const correctColour = correct ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)';
      return (
        <g key={key}>
          <rect
            x={x} y={y} width={w} height={h}
            fill={correct ? 'hsl(142 71% 45% / 0.12)' : 'hsl(0 84% 60% / 0.08)'}
            stroke={correctColour} strokeWidth={1.25}
          />
          {studentAttempted && !correct && (
            <text
              x={x + w / 2} y={y + 12}
              textAnchor="middle"
              fontSize={9}
              fill="hsl(var(--muted-foreground))"
              style={{ textDecoration: 'line-through' } as any}
            >
              {studentVal}
            </text>
          )}
          <text
            x={x + w / 2}
            y={y + (studentAttempted && !correct ? h / 2 + 8 : h / 2 + 5)}
            textAnchor="middle"
            fontSize={13} fontWeight={700}
            fill={correctColour}
          >
            {correctValue ?? '—'}
          </text>
        </g>
      );
    }

    // Static reference (exam / preview / non-quiz contexts).
    return renderCell(x, y, w, h, correctValue, false, false, -1, -1, key);
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
    const isUnknownDataCell = isEmpty && !isHeader && !isTotal;
    return (
      <g key={key ?? `${x}-${y}`}>
        <rect
          x={x} y={y} width={w} height={h}
          fill={isUnknownDataCell ? 'hsl(var(--muted) / 0.15)' : style.fill}
          stroke={isUnknownDataCell ? 'hsl(var(--muted-foreground) / 0.4)' : style.stroke}
          strokeWidth={isUnknownDataCell ? 1.25 : 1}
          strokeDasharray={isUnknownDataCell ? '4 3' : undefined}
        />
        {!isEmpty && (
          <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle"
            fontSize={isHeader ? 11 : 13}
            fontWeight={isHeader || isTotal ? 700 : 400}
            fill="hsl(var(--foreground))">{content}</text>
        )}
      </g>
    );
  };

  // Decide whether a data cell renders as interactive (input/feedback) or static.
  const renderDataCell = (
    x: number, y: number, w: number, h: number,
    ri: number, ci: number,
  ) => {
    const correctValue = data[ri]?.[ci] ?? null;
    if (isPracticeQuiz && isBlankCell(ri, ci)) {
      return renderInteractiveCell(x, y, w, h, `c-${ri}-${ci}`, correctValue, `cell-${ri}-${ci}`);
    }
    return renderCell(x, y, w, h, correctValue, false, false, ri, ci, `cell-${ri}-${ci}`);
  };

  const renderRowTotal = (x: number, y: number, w: number, h: number, ri: number) => {
    const correctValue = rowTotals?.[ri] ?? null;
    if (isPracticeQuiz && isBlankRowTotal(ri)) {
      return renderInteractiveCell(x, y, w, h, `rt-${ri}`, correctValue, `rowtotal-${ri}`);
    }
    return renderCell(x, y, w, h, correctValue, false, true, -1, -1, `rowtotal-${ri}`);
  };

  const renderColTotal = (x: number, y: number, w: number, h: number, ci: number) => {
    const correctValue = colTotals?.[ci] ?? null;
    if (isPracticeQuiz && isBlankColTotal(ci)) {
      return renderInteractiveCell(x, y, w, h, `ct-${ci}`, correctValue, `coltotal-${ci}`);
    }
    return renderCell(x, y, w, h, correctValue, false, true, -1, -1, `coltotal-${ci}`);
  };

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%"
      style={{ maxWidth: svgW, display: 'block', margin: '0 auto', overflow: 'visible' }}>
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
            renderDataCell(
              ox + labelW + (ci + 1) * cellW,
              oy + headerH * 2 + ri * cellH,
              cellW, cellH, ri, ci,
            ),
          )}
          {renderRowTotal(
            ox + labelW + (colLabels.length + 1) * cellW,
            oy + headerH * 2 + ri * cellH,
            totalColW, cellH, ri,
          )}
        </g>
      ))}
      {renderCell(
        ox + labelW, oy + headerH * 2 + rowLabels.length * cellH,
        cellW, cellH, 'Total', true, false, -1, -1, 'totalrow',
      )}
      {colLabels.map((_, ci) =>
        renderColTotal(
          ox + labelW + (ci + 1) * cellW,
          oy + headerH * 2 + rowLabels.length * cellH,
          cellW, cellH, ci,
        ),
      )}
      {(() => {
        const x = ox + labelW + (colLabels.length + 1) * cellW;
        const y = oy + headerH * 2 + rowLabels.length * cellH;
        if (isPracticeQuiz && (givenColTotals ? givenColTotals.every(v => v == null) : grandTotal == null)) {
          return renderInteractiveCell(x, y, totalColW, cellH, 'gt', grandTotal ?? null, 'grandtotal');
        }
        return renderCell(x, y, totalColW, cellH, grandTotal ?? null, false, true, -1, -1, 'grandtotal');
      })()}
    </svg>
  );
};

export default TwoWayTableDiagram;
