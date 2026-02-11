import React, { useRef, useCallback, useState, useMemo } from 'react';
import { DrawingPath } from './types';

/**
 * Douglas-Peucker line simplification algorithm.
 * Reduces the number of points in a path while preserving the overall shape.
 */
function douglasPeucker(points: Array<{ x: number; y: number }>, epsilon: number): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    // Recursively simplify
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Compute minimum distance from a point to a polyline (for eraser hit detection).
 */
function distanceToPolyline(
  px: number, py: number,
  polyline: Array<{ x: number; y: number }>
): number {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = perpendicularDistance({ x: px, y: py }, polyline[i], polyline[i + 1]);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

interface GraphDrawingCanvasProps {
  containerWidth: number;
  containerHeight: number;
  marginLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  paths: DrawingPath[];
  onPathsChange: (paths: DrawingPath[]) => void;
  readOnly?: boolean;
  active: boolean; // Only capture drawing when in freeform mode
  stroke?: string;
  strokeWidth?: number;
  // Data domain for coordinate conversion (required for stable rendering)
  domainX?: [number, number];
  domainY?: [number, number];
  // Eraser mode - clicking on a path deletes it
  eraseMode?: boolean;
}

/**
 * GraphDrawingCanvas - SVG overlay for freeform drawing on the graph.
 * 
 * Paths are stored in data coordinates for stable re-rendering across viewport changes.
 * Applies Douglas-Peucker smoothing to reduce jitter on freeform paths.
 */
export function GraphDrawingCanvas({
  containerWidth,
  containerHeight,
  marginLeft,
  marginTop,
  marginRight,
  marginBottom,
  paths,
  onPathsChange,
  readOnly = false,
  active,
  stroke = 'hsl(var(--primary))',
  strokeWidth = 2,
  domainX = [0, 10],
  domainY = [0, 10],
  eraseMode = false,
}: GraphDrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ pixelX: number; pixelY: number }>>([]);

  // Calculate plot area bounds
  const plotLeft = marginLeft;
  const plotTop = marginTop;
  const plotRight = containerWidth - marginRight;
  const plotBottom = containerHeight - marginBottom;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const pixelToData = useCallback((pixelX: number, pixelY: number): { x: number; y: number } => {
    const x = domainX[0] + ((pixelX - plotLeft) / plotWidth) * (domainX[1] - domainX[0]);
    const y = domainY[0] + (1 - (pixelY - plotTop) / plotHeight) * (domainY[1] - domainY[0]);
    return { x, y };
  }, [domainX, domainY, plotLeft, plotTop, plotWidth, plotHeight]);

  const dataToPixel = useCallback((dataX: number, dataY: number): { px: number; py: number } => {
    const px = plotLeft + ((dataX - domainX[0]) / (domainX[1] - domainX[0])) * plotWidth;
    const py = plotTop + (1 - (dataY - domainY[0]) / (domainY[1] - domainY[0])) * plotHeight;
    return { px, py };
  }, [domainX, domainY, plotLeft, plotTop, plotWidth, plotHeight]);

  const getCursorPosition = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      // Palm rejection: ignore multi-touch for drawing
      if (e.touches.length > 1) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const clampedX = Math.max(plotLeft, Math.min(plotRight, x));
    const clampedY = Math.max(plotTop, Math.min(plotBottom, y));
    return { x: clampedX, y: clampedY };
  }, [plotLeft, plotTop, plotRight, plotBottom]);

  /**
   * Handle eraser click on a path - find nearest path and remove it.
   */
  const handleEraserClick = useCallback((e: React.MouseEvent) => {
    if (!eraseMode || readOnly) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const ERASE_RADIUS = 15; // pixels
    
    let closestIdx = -1;
    let closestDist = ERASE_RADIUS;
    
    paths.forEach((path, idx) => {
      if (!path.dataPoints || path.dataPoints.length < 2) return;
      // Convert path to pixel coords for hit testing
      const pixelPoints = path.dataPoints.map(p => {
        const { px, py } = dataToPixel(p.x, p.y);
        return { x: px, y: py };
      });
      const dist = distanceToPolyline(clickX, clickY, pixelPoints);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });
    
    if (closestIdx >= 0) {
      onPathsChange(paths.filter((_, i) => i !== closestIdx));
    }
  }, [eraseMode, readOnly, paths, onPathsChange, dataToPixel]);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (eraseMode) {
      if ('clientX' in e) handleEraserClick(e);
      return;
    }
    if (!active || readOnly) return;
    const pos = getCursorPosition(e);
    if (!pos) return;
    if (pos.x < plotLeft || pos.x > plotRight || pos.y < plotTop || pos.y > plotBottom) return;
    setIsDrawing(true);
    setCurrentPath([{ pixelX: pos.x, pixelY: pos.y }]);
  }, [active, readOnly, getCursorPosition, plotLeft, plotRight, plotTop, plotBottom, eraseMode, handleEraserClick]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !active || readOnly) return;
    const pos = getCursorPosition(e);
    if (!pos) return;
    setCurrentPath(prev => [...prev, { pixelX: pos.x, pixelY: pos.y }]);
  }, [isDrawing, active, readOnly, getCursorPosition]);

  /**
   * End drawing - save path with Douglas-Peucker smoothing applied.
   */
  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPath.length >= 2) {
      // Convert to data coordinates
      const dataPoints = currentPath.map(p => pixelToData(p.pixelX, p.pixelY));
      
      // Apply Douglas-Peucker smoothing (epsilon in graph units)
      // Use a small epsilon relative to the domain size for clean curves
      const domainRange = Math.max(domainX[1] - domainX[0], domainY[1] - domainY[0]);
      const epsilon = domainRange * 0.005; // 0.5% of domain range
      const smoothed = douglasPeucker(dataPoints, epsilon);
      
      const newPath: DrawingPath = {
        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dataPoints: smoothed,
      };
      onPathsChange([...paths, newPath]);
    }

    setCurrentPath([]);
  }, [isDrawing, currentPath, paths, onPathsChange, pixelToData, domainX, domainY]);

  const pathToPolylinePoints = useCallback((path: DrawingPath): string => {
    if (path.dataPoints && path.dataPoints.length > 0) {
      return path.dataPoints
        .map(p => {
          const { px, py } = dataToPixel(p.x, p.y);
          return `${px},${py}`;
        })
        .join(' ');
    }
    if (path.points && path.points.length > 0) {
      return path.points.map(p => `${p.pixelX},${p.pixelY}`).join(' ');
    }
    return '';
  }, [dataToPixel]);

  const currentPathToPoints = useMemo(() => {
    return currentPath.map(p => `${p.pixelX},${p.pixelY}`).join(' ');
  }, [currentPath]);

  // Don't render anything if not active and no paths (let clicks pass through)
  // BUT always render if in erase mode (need click targets)
  if (!active && !eraseMode && paths.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 z-10"
      width={containerWidth}
      height={containerHeight}
      style={{ 
        pointerEvents: (active || eraseMode) ? 'auto' : 'none',
        touchAction: active ? 'none' : 'auto',
        cursor: eraseMode ? 'pointer' : active ? 'crosshair' : 'default',
      }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {/* Saved paths */}
      {paths.map((path) => (
        <polyline
          key={path.id}
          points={pathToPolylinePoints(path)}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ cursor: eraseMode ? 'pointer' : 'default' }}
          onClick={(e) => {
            if (eraseMode) {
              e.stopPropagation();
              onPathsChange(paths.filter(p => p.id !== path.id));
            }
          }}
        />
      ))}

      {/* Invisible wider hit areas for eraser */}
      {eraseMode && paths.map((path) => (
        <polyline
          key={`hit-${path.id}`}
          points={pathToPolylinePoints(path)}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onPathsChange(paths.filter(p => p.id !== path.id));
          }}
        />
      ))}

      {/* Current drawing path */}
      {isDrawing && currentPath.length > 0 && (
        <polyline
          points={currentPathToPoints}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
      )}
    </svg>
  );
}

export default GraphDrawingCanvas;
