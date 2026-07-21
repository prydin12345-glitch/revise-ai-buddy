import type { UnifiedMastery } from "@/hooks/useUnifiedTopicPerformance";

export const TELEMETRY = {
  bg: "hsl(220 10% 6%)",
  card: "hsl(220 10% 9%)",
  cardAlt: "hsl(220 10% 11%)",
  border: "hsl(220 8% 14%)",
  borderSoft: "hsl(220 8% 18% / 0.6)",
  text: "hsl(0 0% 98%)",
  muted: "hsl(220 8% 62%)",
  mutedStrong: "hsl(220 8% 78%)",
  lime: "hsl(88 92% 58%)",
  cyan: "hsl(190 95% 60%)",
  magenta: "hsl(320 90% 62%)",
  amber: "hsl(38 95% 60%)",
  red: "hsl(0 84% 62%)",
};

export const clampPct = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

export const masteryColor = (m: UnifiedMastery): string => {
  switch (m) {
    case "strong": return TELEMETRY.lime;
    case "developing": return TELEMETRY.amber;
    case "weak": return TELEMETRY.magenta;
    default: return TELEMETRY.muted;
  }
};

export const scoreColor = (pct: number): string => {
  const p = clampPct(pct);
  if (p >= 75) return TELEMETRY.lime;
  if (p >= 50) return TELEMETRY.cyan;
  if (p >= 30) return TELEMETRY.amber;
  return TELEMETRY.magenta;
};

/** Build a smooth-ish SVG path (monotone-ish) from y-values [0..1] normalised to width/height. */
export const buildSparklinePath = (values: number[], width: number, height: number, pad = 2): string => {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = height / 2;
    return `M 0 ${y} L ${width} ${y}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  // simple smooth path with quadratic midpoints
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const mx = (px + x) / 2;
    const my = (py + y) / 2;
    d += ` Q ${px} ${py} ${mx} ${my}`;
  }
  d += ` T ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
  return d;
};

export const truncate = (s: string, n = 12) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;
