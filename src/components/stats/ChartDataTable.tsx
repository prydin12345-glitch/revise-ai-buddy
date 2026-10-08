/** Keyboard and screen-reader access to the same values plotted in a chart. */
export function ChartDataTable({
  caption,
  rows,
  series,
  periodKey = "period",
  periodLabel = "Period",
  unit = "%",
}: {
  caption: string;
  rows: Array<Record<string, number | string | boolean | null>>;
  series: Array<{ key: string; label: string }>;
  periodKey?: string;
  periodLabel?: string;
  unit?: string;
}) {
  return (
    <details className="stats-chart-data">
      <summary>
        View chart data<span className="sr-only">: {caption}</span>
      </summary>
      <div
        className="max-w-full overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={`${caption} data table`}
      >
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2">
                {periodLabel}
              </th>
              {series.map((s) => (
                <th key={s.key} scope="col" className="px-3 py-2">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                <th
                  scope="row"
                  className="whitespace-nowrap px-3 py-2 font-medium"
                >
                  {String(row[periodKey])}
                </th>
                {series.map((s) => (
                  <td key={s.key} className="px-3 py-2">
                    {typeof row[s.key] === "number"
                      ? `${Math.round((row[s.key] as number) * 10) / 10}${unit}`
                      : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
