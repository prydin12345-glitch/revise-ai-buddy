/** Lossless chart label aliases shared by screen, printable capture and validation. */
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export function chartAxisLabels(chart: unknown): {
  xLabel?: string;
  yLabel?: string;
} {
  const value =
    chart && typeof chart === "object"
      ? (chart as Record<string, unknown>)
      : {};
  return {
    xLabel: text(value.xLabel) ?? text(value.xAxisLabel),
    yLabel: text(value.yLabel) ?? text(value.yAxisLabel),
  };
}

export function conflictingAxisLabels(chart: unknown): boolean {
  if (!chart || typeof chart !== "object") return false;
  const value = chart as Record<string, unknown>;
  const key = (value: string) => value.toLowerCase().replace(/\s+/g, " ");
  return (["x", "y"] as const).some((axis) => {
    const primary = text(value[`${axis}Label`]),
      alternate = text(value[`${axis}AxisLabel`]);
    return (
      primary !== undefined &&
      alternate !== undefined &&
      key(primary) !== key(alternate)
    );
  });
}
