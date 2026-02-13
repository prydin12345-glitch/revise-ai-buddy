import React from 'react';
import type { GraphAnnotation, GraphSeries } from './types';

export interface AnnotationLayerProps {
  annotations: GraphAnnotation[];
  graphToScreen: (x: number, y: number) => { x: number; y: number };
  referenceSeries?: GraphSeries[];
  subjectColor?: string;
  /** Visible domain for region shading bounds */
  visibleDomain?: { domainX: [number, number]; domainY: [number, number] };
}

/**
 * AnnotationLayer - Pure SVG overlay for point labels, intercept labels, and region shading.
 * Renders on top of curves but below student points.
 */
export function AnnotationLayer({
  annotations,
  graphToScreen,
  referenceSeries = [],
  subjectColor = 'hsl(var(--primary))',
  visibleDomain,
}: AnnotationLayerProps) {
  return (
    <g className="annotation-layer">
      {annotations.map((ann) => {
        switch (ann.type) {
          case 'point':
          case 'text':
            return <PointAnnotation key={ann.id} annotation={ann} graphToScreen={graphToScreen} />;
          case 'intercept':
            return (
              <InterceptAnnotation
                key={ann.id}
                annotation={ann}
                graphToScreen={graphToScreen}
                referenceSeries={referenceSeries}
              />
            );
          case 'region':
            return (
              <RegionAnnotation
                key={ann.id}
                annotation={ann}
                graphToScreen={graphToScreen}
                referenceSeries={referenceSeries}
                subjectColor={subjectColor}
                visibleDomain={visibleDomain}
              />
            );
          default:
            return null;
        }
      })}
    </g>
  );
}

/** Renders a labeled tag near a coordinate */
function PointAnnotation({
  annotation,
  graphToScreen,
}: {
  annotation: GraphAnnotation;
  graphToScreen: (x: number, y: number) => { x: number; y: number };
}) {
  if (!annotation.coords) return null;
  const screen = graphToScreen(annotation.coords.x, annotation.coords.y);
  if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;

  const coordText = annotation.showCoordinates
    ? ` (${annotation.coords.x}, ${annotation.coords.y})`
    : '';
  const text = `${annotation.label}${coordText}`;

  // Offset the label slightly above and to the right
  const offsetX = 10;
  const offsetY = -14;

  return (
    <g>
      {/* Small dot at the coordinate */}
      {annotation.type === 'point' && (
        <circle
          cx={screen.x}
          cy={screen.y}
          r={3}
          fill="hsl(var(--foreground))"
          stroke="hsl(var(--background))"
          strokeWidth={1}
        />
      )}
      {/* Background rect for readability */}
      <rect
        x={screen.x + offsetX - 3}
        y={screen.y + offsetY - 12}
        width={text.length * 7 + 6}
        height={16}
        rx={3}
        fill="hsl(var(--background) / 0.85)"
        stroke="hsl(var(--border))"
        strokeWidth={0.5}
      />
      {/* Label text */}
      <text
        x={screen.x + offsetX}
        y={screen.y + offsetY}
        fontSize={11}
        fontWeight={500}
        fill="hsl(var(--foreground))"
        fontFamily="system-ui, sans-serif"
      >
        {text}
      </text>
    </g>
  );
}

/** Finds where a series crosses an axis and places a label */
function InterceptAnnotation({
  annotation,
  graphToScreen,
  referenceSeries,
}: {
  annotation: GraphAnnotation;
  graphToScreen: (x: number, y: number) => { x: number; y: number };
  referenceSeries: GraphSeries[];
}) {
  // If explicit coords provided, use them
  if (annotation.coords) {
    return <PointAnnotation annotation={annotation} graphToScreen={graphToScreen} />;
  }

  // Otherwise auto-detect from series data
  for (const series of referenceSeries) {
    if (!series.data || series.data.length < 2) continue;
    for (let i = 1; i < series.data.length; i++) {
      const prev = series.data[i - 1];
      const curr = series.data[i];
      if (annotation.axis === 'x') {
        // Find where y crosses 0
        if ((prev.y <= 0 && curr.y >= 0) || (prev.y >= 0 && curr.y <= 0)) {
          const t = Math.abs(prev.y) / (Math.abs(prev.y) + Math.abs(curr.y));
          const interceptX = prev.x + t * (curr.x - prev.x);
          const derivedAnnotation = { ...annotation, coords: { x: interceptX, y: 0 } };
          return <PointAnnotation annotation={derivedAnnotation} graphToScreen={graphToScreen} />;
        }
      } else if (annotation.axis === 'y') {
        // Find where x crosses 0
        if ((prev.x <= 0 && curr.x >= 0) || (prev.x >= 0 && curr.x <= 0)) {
          const t = Math.abs(prev.x) / (Math.abs(prev.x) + Math.abs(curr.x));
          const interceptY = prev.y + t * (curr.y - prev.y);
          const derivedAnnotation = { ...annotation, coords: { x: 0, y: interceptY } };
          return <PointAnnotation annotation={derivedAnnotation} graphToScreen={graphToScreen} />;
        }
      }
    }
  }

  return null;
}

/** Renders a filled region between a curve and the x-axis */
function RegionAnnotation({
  annotation,
  graphToScreen,
  referenceSeries,
  subjectColor,
  visibleDomain,
}: {
  annotation: GraphAnnotation;
  graphToScreen: (x: number, y: number) => { x: number; y: number };
  referenceSeries: GraphSeries[];
  subjectColor: string;
  visibleDomain?: { domainX: [number, number]; domainY: [number, number] };
}) {
  if (!annotation.fillBetween) return null;
  const { curveSeriesId, fromX, toX, fillColor } = annotation.fillBetween;

  const series = referenceSeries.find((s) => s.id === curveSeriesId);
  if (!series?.data || series.data.length < 2) return null;

  const minX = fromX ?? visibleDomain?.domainX[0] ?? series.data[0].x;
  const maxX = toX ?? visibleDomain?.domainX[1] ?? series.data[series.data.length - 1].x;

  // Filter data points within range
  const filtered = series.data.filter((p) => p.x >= minX && p.x <= maxX && Number.isFinite(p.y));
  if (filtered.length < 2) return null;

  // Build SVG path: curve then close along x-axis
  const screenPoints = filtered.map((p) => graphToScreen(p.x, p.y));
  const xAxisY = graphToScreen(0, 0).y;

  let d = `M ${screenPoints[0].x} ${xAxisY}`;
  for (const sp of screenPoints) {
    d += ` L ${sp.x} ${sp.y}`;
  }
  d += ` L ${screenPoints[screenPoints.length - 1].x} ${xAxisY} Z`;

  const color = fillColor || subjectColor;

  return (
    <g>
      <path d={d} fill={color} fillOpacity={0.15} stroke="none" />
      {annotation.label && (
        <text
          x={(screenPoints[0].x + screenPoints[screenPoints.length - 1].x) / 2}
          y={xAxisY - 8}
          fontSize={10}
          fill={color}
          textAnchor="middle"
          fontStyle="italic"
        >
          {annotation.label}
        </text>
      )}
    </g>
  );
}

export default AnnotationLayer;

