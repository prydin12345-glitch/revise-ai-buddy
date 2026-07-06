// FILE: src/components/insert/MapFigure.tsx
// Renders an exam-insert style map figure: real coastline (Natural Earth,
// public domain, bundled as an asset), data points projected at true
// lat/lng, a key, north arrow and scale bar. The geometry is never
// AI-generated — the AI only supplies the data points, which are validated
// server-side (see supabase/functions/_shared/insert-figures.ts) before
// they ever reach this component.

import { useMemo } from "react";
import ukGeo from "@/assets/basemaps/uk-simplified.json";

export interface MapPoint {
  name: string;
  lat: number;
  lng: number;
  category: string;
  /** Optional quantitative value — rendered as a proportional circle */
  value?: number;
}

export interface MapCategory {
  id: string;
  label: string;
  color: string;
}

export interface MapFigureProps {
  title: string;
  region?: "uk"; // world and others come later — same pattern, new asset
  points: MapPoint[];
  categories: MapCategory[];
  /** Show point names next to dots (off by default, like most exam maps) */
  showPointLabels?: boolean;
  className?: string;
}

// UK projection window — matches the validated PoC values.
const BOUNDS = { minLon: -8.7, minLat: 49.8, maxLon: 2.0, maxLat: 61.0 };
const W = 520, H = 720, PAD = 32;
const LON_SCALE = Math.cos((((BOUNDS.minLat + BOUNDS.maxLat) / 2) * Math.PI) / 180);

function project(lon: number, lat: number): [number, number] {
  const spanX = (BOUNDS.maxLon - BOUNDS.minLon) * LON_SCALE;
  const spanY = BOUNDS.maxLat - BOUNDS.minLat;
  const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
  return [
    PAD + (lon - BOUNDS.minLon) * LON_SCALE * scale,
    H - PAD - (lat - BOUNDS.minLat) * scale,
  ];
}

function ringToPath(ring: number[][]): string {
  return (
    "M " +
    ring.map(([lon, lat]) => {
      const [x, y] = project(lon, lat);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" L ") +
    " Z"
  );
}

export function MapFigure({
  title, points, categories, showPointLabels = false, className,
}: MapFigureProps) {
  const landPaths = useMemo(() => {
    const g: any = (ukGeo as any).geometry;
    const polys: number[][][][] = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
    return polys.flatMap((poly) => poly.map(ringToPath));
  }, []);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );

  // 100 km scale bar: 1° latitude ≈ 111 km
  const scaleBarPx = useMemo(() => {
    const [, y0] = project(0, 54);
    const [, y1] = project(0, 54 + 100 / 111);
    return Math.abs(y0 - y1);
  }, []);

  // Proportional symbols: sqrt scaling (area ∝ value), radius 4–12px.
  const values = points.map((p) => p.value).filter((v): v is number => typeof v === "number");
  const proportional = values.length === points.length && points.length > 0;
  const maxV = proportional ? Math.max(...values, 1) : 1;
  const radiusFor = (p: MapPoint) =>
    proportional ? 4 + 8 * Math.sqrt((p.value as number) / maxV) : 6;

  const keyHeight = 34 + categories.length * 15 + (proportional ? 16 : 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={title}
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
    >
      {/* Sea */}
      <rect width={W} height={H} fill="hsl(var(--muted))" opacity={0.45} rx={6} />
      {/* Land — real coastline from the bundled asset */}
      {landPaths.map((d, i) => (
        <path key={i} d={d} fill="hsl(var(--card))" stroke="hsl(var(--muted-foreground))" strokeWidth={1.05} />
      ))}
      {/* Data points */}
      {points.map((p, i) => {
        const [x, y] = project(p.lng, p.lat);
        const cat = catMap[p.category];
        return (
          <g key={`${p.name}-${i}`}>
            <circle cx={x} cy={y} r={radiusFor(p)} fill={cat?.color ?? "hsl(var(--primary))"} fillOpacity={proportional ? 0.8 : 1} stroke="hsl(var(--foreground))" strokeWidth={0.9} />
            {showPointLabels && (
              <text x={x + 9} y={y + 3.5} fontSize={9} fill="hsl(var(--muted-foreground))">{p.name}</text>
            )}
          </g>
        );
      })}
      {/* Title */}
      <text x={W / 2} y={24} fontSize={15} fontWeight={700} textAnchor="middle" fill="hsl(var(--foreground))">
        {title}
      </text>
      {/* North arrow */}
      <g transform="translate(44,58)">
        <line x1={0} y1={-8} x2={0} y2={4} stroke="hsl(var(--foreground))" strokeWidth={1.4} />
        <polygon points="-4,-4 0,-12 4,-4" fill="hsl(var(--foreground))" />
        <text x={-3.5} y={18} fontSize={11} fill="hsl(var(--foreground))">N</text>
      </g>
      {/* Key */}
      <rect x={W - 164} y={42} width={150} height={keyHeight} fill="hsl(var(--background))" stroke="hsl(var(--border))" rx={4} />
      <text x={W - 156} y={59} fontSize={11} fontWeight={700} fill="hsl(var(--foreground))">Key</text>
      {proportional && (
        <text x={W - 156} y={59 + categories.length * 15 + 14} fontSize={8.5} fill="hsl(var(--muted-foreground))">
          Circle size ∝ value
        </text>
      )}
      {categories.map((c, i) => (
        <g key={c.id}>
          <circle cx={W - 148} cy={73 + i * 15} r={5.5} fill={c.color} stroke="hsl(var(--foreground))" strokeWidth={0.8} />
          <text x={W - 136} y={76.5 + i * 15} fontSize={9.5} fill="hsl(var(--foreground))">{c.label}</text>
        </g>
      ))}
      {/* Scale bar */}
      <g transform={`translate(${W - 160},${H - 48})`}>
        <line x1={0} y1={0} x2={scaleBarPx} y2={0} stroke="hsl(var(--foreground))" strokeWidth={1.6} />
        <line x1={0} y1={-4} x2={0} y2={4} stroke="hsl(var(--foreground))" strokeWidth={1.6} />
        <line x1={scaleBarPx} y1={-4} x2={scaleBarPx} y2={4} stroke="hsl(var(--foreground))" strokeWidth={1.6} />
        <text x={scaleBarPx / 2} y={15} fontSize={9.5} textAnchor="middle" fill="hsl(var(--foreground))">100 km</text>
      </g>
    </svg>
  );
}

export default MapFigure;
