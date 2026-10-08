/** Labelled series use a high-contrast blue/amber/teal palette plus line patterns.
 * Subject colours stay intact in stored data; these are presentation only. */
export const chartColour = (index: number) =>
  `var(--stats-series-${(index % 6) + 1})`;
export const chartDash = (index: number) =>
  [undefined, "7 3", "2 3", "10 3 2 3", "4 4", "10 5"][index % 6];
