/** Compact history from the same range-filtered data as the main score chart. */
export function SubjectHistoryBars({
  subject,
  rows,
  colour,
}: {
  subject: string;
  rows: Array<Record<string, string | number>>;
  colour: string;
}) {
  if (!rows.some((row) => typeof row[subject] === "number"))
    return (
      <p className="stats-mini-chart-empty">No marked results in this range</p>
    );
  return (
    <>
      <svg
        className="stats-subject-mini-chart"
        viewBox="0 0 180 84"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${subject} score history: ${rows.map((row) => `${row.period}: ${typeof row[subject] === "number" ? `${Math.round(row[subject] as number)}%` : "no marked results"}`).join("; ")}`}
      >
        <line x1="0" x2="180" y1="78" y2="78" stroke="hsl(var(--border))" />
        {rows.map((row, i) => {
          const value = row[subject];
          if (typeof value !== "number") return null;
          const width = 176 / rows.length;
          const height = Math.max(0, Math.min(100, value)) * 0.7;
          return (
            <rect
              key={`${row.period}-${i}`}
              x={i * width + 4}
              y={78 - height}
              width={Math.max(2, width * 0.55)}
              height={height}
              rx="2"
              fill={colour}
            >
              <title>{`${row.period}: ${Math.round(value as number)}%`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="stats-mini-chart-range">
        <span>{rows[0]?.period}</span>
        <span>{rows.at(-1)?.period}</span>
      </div>
    </>
  );
}
