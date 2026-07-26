import { useEffect, useState } from "react";
import type { UnifiedMastery } from "@/hooks/useUnifiedTopicPerformance";

export interface TelemetryPalette {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  borderSoft: string;
  text: string;
  muted: string;
  mutedStrong: string;
  /** Text/icon colour to sit ON an accent fill (e.g. the active range chip). */
  onAccent: string;
  lime: string;
  cyan: string;
  magenta: string;
  amber: string;
  red: string;
  gray: string;
}

/**
 * Dark surfaces are aligned to the app's own --background / --card / --border
 * values so the telemetry panel sits flush with the rest of the page instead
 * of forming a visible seam. Only the accent hues are telemetry-specific.
 */
const DARK: TelemetryPalette = {
  bg: "hsl(220 8% 8%)",
  card: "hsl(220 8% 13%)",
  cardAlt: "hsl(220 8% 16%)",
  border: "hsl(220 6% 20%)",
  borderSoft: "hsl(220 6% 20% / 0.6)",
  text: "hsl(210 15% 94%)",
  muted: "hsl(210 10% 62%)",
  mutedStrong: "hsl(210 12% 80%)",
  onAccent: "hsl(220 8% 8%)",
  lime: "hsl(88 92% 58%)",
  cyan: "hsl(190 95% 60%)",
  magenta: "hsl(320 90% 62%)",
  amber: "hsl(38 95% 60%)",
  red: "hsl(0 84% 62%)",
  gray: "hsl(220 6% 45%)",
};

/**
 * Light variant. The neon accents are darkened hard — lime at 58% lightness is
 * roughly 1.4:1 on white and effectively invisible. These sit at 30-42%
 * lightness so they clear AA as both text and fills, while keeping the same
 * hue relationships so the surface still reads as the same design.
 */
const LIGHT: TelemetryPalette = {
  bg: "hsl(216 40% 98%)",
  card: "hsl(0 0% 100%)",
  cardAlt: "hsl(216 38% 96%)",
  border: "hsl(216 24% 88%)",
  borderSoft: "hsl(216 24% 88% / 0.7)",
  text: "hsl(220 38% 11%)",
  muted: "hsl(218 14% 45%)",
  mutedStrong: "hsl(220 25% 25%)",
  onAccent: "hsl(0 0% 100%)",
  lime: "hsl(88 65% 28%)",
  cyan: "hsl(190 90% 28%)",
  magenta: "hsl(320 75% 40%)",
  amber: "hsl(35 90% 34%)",
  red: "hsl(0 72% 46%)",
  gray: "hsl(220 9% 55%)",
};

/**
 * Reads the theme from the `dark` class on <html> rather than from useTheme().
 *
 * useTheme() holds its state in a plain useState per call site, so separate
 * instances never see each other's toggles — a component using it here would
 * keep the old palette until it remounted. Observing the class directly means
 * this stays correct no matter what flips the theme.
 */
const useIsDark = (): boolean => {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark;
};

export const useTelemetry = (): TelemetryPalette => (useIsDark() ? DARK : LIGHT);

/**
 * Applies an alpha to a palette colour or a subject hex.
 * Replaces the old `${COLOR}33` string concatenation, which only worked while
 * every colour happened to be a 6-digit hex.
 */
export const alpha = (color: string, a: number): string => {
  if (!color) return color;
  const c = color.trim();

  if (c.startsWith("hsl(")) {
    const inner = c.slice(4, c.lastIndexOf(")")).split("/")[0].trim();
    return `hsl(${inner} / ${a})`;
  }
  if (c.startsWith("rgb(")) {
    const inner = c.slice(4, c.lastIndexOf(")")).split("/")[0].trim();
    return `rgb(${inner} / ${a})`;
  }

  const hex = c.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  return c;
};

export const clampPct = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

export const masteryColor = (m: UnifiedMastery, p: TelemetryPalette): string => {
  switch (m) {
    case "strong": return p.lime;
    case "developing": return p.amber;
    case "weak": return p.magenta;
    default: return p.gray;
  }
};

/**
 * Status colour driven by *actual score + attempts*, not just the mastery bucket.
 * - Unattempted (no data)           → muted gray
 * - Needs Review (<40 or 0 w/ tries)→ magenta
 * - Developing (40-69)              → cyan
 * - High mastery (>=70)             → lime
 */
export const scoreStatusColor = (score: number, attempts: number, p: TelemetryPalette): string => {
  if (attempts === 0) return p.gray;
  const pct = clampPct(score);
  if (pct >= 70) return p.lime;
  if (pct >= 40) return p.cyan;
  return p.magenta;
};

export const scoreStatusLabel = (score: number, attempts: number): string => {
  if (attempts === 0) return "Unattempted";
  const pct = clampPct(score);
  if (pct >= 70) return "Mastered";
  if (pct >= 40) return "Developing";
  return "Needs review";
};

export const scoreColor = (pct: number, p: TelemetryPalette): string => {
  const v = clampPct(pct);
  if (v >= 75) return p.lime;
  if (v >= 50) return p.cyan;
  if (v >= 30) return p.amber;
  return p.magenta;
};

/** Build a smooth-ish SVG path from y-values normalised to width/height. */
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

export const truncate = (s: string, n = 12) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
