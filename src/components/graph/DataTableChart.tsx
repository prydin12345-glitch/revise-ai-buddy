import { useState } from 'react';

export interface DataTableData {
  type: 'data_table';
  headers: string[];
  rows: (string | number)[][];
  caption?: string;
  highlightColumn?: number;
  units?: string[];
  footnote?: string;
}

export function isDataTableQuestion(options: any): options is DataTableData {
  if (!options || typeof options !== 'object') return false;
  return (
    options.type === 'data_table' &&
    Array.isArray(options.headers) &&
    Array.isArray(options.rows) &&
    options.headers.length > 0 &&
    options.rows.length > 0
  );
}

interface DataTableChartProps {
  chartData: DataTableData;
  className?: string;
}

export const DataTableChart = ({ chartData, className = '' }: DataTableChartProps) => {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const { headers, rows, caption, highlightColumn, units, footnote } = chartData;

  const displayHeaders = headers.map((h, i) =>
    units?.[i] ? `${h} (${units[i]})` : h
  );

  return (
    <figure className={`w-full my-4 ${className}`}>
      {caption && (
        <figcaption className="text-sm font-medium text-foreground mb-2 text-center">
          {caption}
        </figcaption>
      )}

      <div className="w-full overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              {displayHeaders.map((header, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap ${
                    highlightColumn === i ? 'bg-primary/10' : ''
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onMouseEnter={() => setHoveredRow(rowIndex)}
                onMouseLeave={() => setHoveredRow(null)}
                className="border-b border-border last:border-b-0 transition-colors"
                style={{
                  background:
                    hoveredRow === rowIndex
                      ? 'hsl(var(--primary) / 0.04)'
                      : rowIndex % 2 === 0
                      ? 'transparent'
                      : 'hsl(var(--muted) / 0.2)',
                }}
              >
                {row.map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-3 py-2 text-foreground ${
                      colIndex === 0 ? 'font-medium' : 'tabular-nums'
                    } ${highlightColumn === colIndex ? 'bg-primary/5' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {footnote && (
        <p className="text-xs text-muted-foreground mt-2 italic">{footnote}</p>
      )}
    </figure>
  );
};

export default DataTableChart;
