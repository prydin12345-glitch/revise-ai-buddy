import React, { useMemo } from 'react';
import { LineSegment, GraphPoint } from './types';

interface AngleMeasurementOverlayProps {
  segments: LineSegment[];
  selectedSegmentIds: string[];
  containerWidth: number;
  containerHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  domainX: [number, number];
  domainY: [number, number];
  xScale?: (value: number) => number;
  yScale?: (value: number) => number;
  stroke?: string;
}

/**
 * Computes the angle between two vectors in degrees (0-180).
 */
function computeAngleBetweenVectors(
  v1: { x: number; y: number },
  v2: { x: number; y: number }
): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  const angleRad = Math.acos(cosAngle);
  return Math.round((angleRad * 180) / Math.PI);
}

/**
 * Finds the shared vertex between two segments, if any.
 */
function findSharedVertex(
  seg1: LineSegment,
  seg2: LineSegment
): GraphPoint | null {
  const points1 = [seg1.from, seg1.to];
  const points2 = [seg2.from, seg2.to];
  
  for (const p1 of points1) {
    for (const p2 of points2) {
      if (p1.x === p2.x && p1.y === p2.y) {
        return p1;
      }
    }
  }
  return null;
}

/**
 * Gets the vector from shared vertex to the other endpoint.
 */
function getVectorFromVertex(
  segment: LineSegment,
  vertex: GraphPoint
): { x: number; y: number } {
  const isFromVertex = segment.from.x === vertex.x && segment.from.y === vertex.y;
  const other = isFromVertex ? segment.to : segment.from;
  return { x: other.x - vertex.x, y: other.y - vertex.y };
}

/**
 * Overlay that shows the angle between two selected segments at their shared vertex.
 */
export function AngleMeasurementOverlay({
  segments,
  selectedSegmentIds,
  containerWidth,
  containerHeight,
  marginLeft,
  marginRight,
  marginTop,
  marginBottom,
  domainX,
  domainY,
  xScale,
  yScale,
  stroke = 'hsl(var(--primary))',
}: AngleMeasurementOverlayProps) {
  const plotWidth = containerWidth - marginLeft - marginRight;
  const plotHeight = containerHeight - marginTop - marginBottom;
  
  // Check if scales need offset
  const xScaleNeedsOffset = xScale ? xScale(domainX[0]) < marginLeft : false;
  const yScaleNeedsOffset = yScale ? yScale(domainY[0]) < marginTop : false;

  const dataToPixelX = (dataX: number): number => {
    if (xScale) {
      const px = xScale(dataX);
      return xScaleNeedsOffset ? px + marginLeft : px;
    }
    const denom = domainX[1] - domainX[0] || 1;
    const fraction = (dataX - domainX[0]) / denom;
    return marginLeft + fraction * plotWidth;
  };

  const dataToPixelY = (dataY: number): number => {
    if (yScale) {
      const py = yScale(dataY);
      return yScaleNeedsOffset ? py + marginTop : py;
    }
    const denom = domainY[1] - domainY[0] || 1;
    const fraction = (dataY - domainY[0]) / denom;
    return marginTop + (1 - fraction) * plotHeight;
  };

  // Calculate angle display data
  const angleData = useMemo(() => {
    if (selectedSegmentIds.length !== 2) return null;
    
    const seg1 = segments.find(s => s.id === selectedSegmentIds[0]);
    const seg2 = segments.find(s => s.id === selectedSegmentIds[1]);
    
    if (!seg1 || !seg2) return null;
    
    const sharedVertex = findSharedVertex(seg1, seg2);
    if (!sharedVertex) return null;
    
    const v1 = getVectorFromVertex(seg1, sharedVertex);
    const v2 = getVectorFromVertex(seg2, sharedVertex);
    const angle = computeAngleBetweenVectors(v1, v2);
    
    // Convert vertex to pixels
    const px = dataToPixelX(sharedVertex.x);
    const py = dataToPixelY(sharedVertex.y);
    
    // Calculate arc for visual display
    const arcRadius = 25;
    
    // Calculate angles for arc
    const angle1 = Math.atan2(-v1.y, v1.x); // Negative y because SVG y is flipped
    const angle2 = Math.atan2(-v2.y, v2.x);
    
    return { px, py, angle, arcRadius, angle1, angle2 };
  }, [selectedSegmentIds, segments, domainX, domainY, xScale, yScale, marginLeft, marginTop, plotWidth, plotHeight]);

  if (!angleData) return null;

  const { px, py, angle, arcRadius, angle1, angle2 } = angleData;
  
  // Create arc path
  const startAngle = Math.min(angle1, angle2);
  const endAngle = Math.max(angle1, angle2);
  
  // Choose the smaller arc
  let arcStart = startAngle;
  let arcEnd = endAngle;
  if (endAngle - startAngle > Math.PI) {
    arcStart = endAngle;
    arcEnd = startAngle + 2 * Math.PI;
  }
  
  const x1 = px + arcRadius * Math.cos(arcStart);
  const y1 = py + arcRadius * Math.sin(arcStart);
  const x2 = px + arcRadius * Math.cos(arcEnd);
  const y2 = py + arcRadius * Math.sin(arcEnd);
  
  const largeArc = (arcEnd - arcStart) > Math.PI ? 1 : 0;
  const arcPath = `M ${x1} ${y1} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${x2} ${y2}`;
  
  // Label position (midpoint of arc)
  const midAngle = (arcStart + arcEnd) / 2;
  const labelRadius = arcRadius + 18;
  const labelX = px + labelRadius * Math.cos(midAngle);
  const labelY = py + labelRadius * Math.sin(midAngle);

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 15,
      }}
    >
      {/* Arc showing the angle */}
      <path
        d={arcPath}
        fill="none"
        stroke="hsl(var(--warning))"
        strokeWidth={2}
        strokeLinecap="round"
      />
      
      {/* Angle label with background */}
      <g>
        <rect
          x={labelX - 24}
          y={labelY - 10}
          width={48}
          height={20}
          rx={4}
          fill="hsl(var(--warning))"
        />
        <text
          x={labelX}
          y={labelY + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fontWeight="bold"
          fill="hsl(var(--warning-foreground, 0 0% 0%))"
        >
          {angle}°
        </text>
      </g>
      
      {/* Small circle at vertex */}
      <circle
        cx={px}
        cy={py}
        r={4}
        fill="hsl(var(--warning))"
      />
    </svg>
  );
}

export default AngleMeasurementOverlay;
