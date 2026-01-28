import React, { useRef, useCallback, useState, useMemo } from 'react';
import { DrawingPath } from './types';

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
}

/**
 * GraphDrawingCanvas - SVG overlay for freeform drawing on the graph.
 * 
 * When active, captures mouse/touch events to draw freehand paths.
 * Paths are stored in BOTH pixel coordinates (for immediate rendering) AND
 * data coordinates (for stable re-rendering across viewport changes).
 * 
 * FIX: Previously paths were only stored in pixel coords, causing lines to
 * shift when the container resized (e.g., between drawing and review modes).
 * Now we convert to data coords on save and use those for rendering.
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

  /**
   * Convert pixel coordinates to data coordinates.
   * Full precision (no rounding) to preserve curve smoothness.
   */
  const pixelToData = useCallback((pixelX: number, pixelY: number): { x: number; y: number } => {
    const x = domainX[0] + ((pixelX - plotLeft) / plotWidth) * (domainX[1] - domainX[0]);
    const y = domainY[0] + (1 - (pixelY - plotTop) / plotHeight) * (domainY[1] - domainY[0]);
    return { x, y };
  }, [domainX, domainY, plotLeft, plotTop, plotWidth, plotHeight]);

  /**
   * Convert data coordinates to pixel coordinates (for rendering).
   */
  const dataToPixel = useCallback((dataX: number, dataY: number): { px: number; py: number } => {
    const px = plotLeft + ((dataX - domainX[0]) / (domainX[1] - domainX[0])) * plotWidth;
    const py = plotTop + (1 - (dataY - domainY[0]) / (domainY[1] - domainY[0])) * plotHeight;
    return { px, py };
  }, [domainX, domainY, plotLeft, plotTop, plotWidth, plotHeight]);

  /**
   * Get cursor position relative to SVG.
   */
  const getCursorPosition = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;

    const rect = svgRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Clamp to plot area
    const clampedX = Math.max(plotLeft, Math.min(plotRight, x));
    const clampedY = Math.max(plotTop, Math.min(plotBottom, y));

    return { x: clampedX, y: clampedY };
  }, [plotLeft, plotTop, plotRight, plotBottom]);

  /**
   * Start drawing.
   */
  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!active || readOnly) return;

    const pos = getCursorPosition(e);
    if (!pos) return;

    // Check if click is within plot area
    if (pos.x < plotLeft || pos.x > plotRight || pos.y < plotTop || pos.y > plotBottom) {
      return;
    }

    setIsDrawing(true);
    setCurrentPath([{ pixelX: pos.x, pixelY: pos.y }]);
  }, [active, readOnly, getCursorPosition, plotLeft, plotRight, plotTop, plotBottom]);

  /**
   * Continue drawing.
   */
  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !active || readOnly) return;

    const pos = getCursorPosition(e);
    if (!pos) return;

    setCurrentPath(prev => [...prev, { pixelX: pos.x, pixelY: pos.y }]);
  }, [isDrawing, active, readOnly, getCursorPosition]);

  /**
   * End drawing - save the path with BOTH pixel and data coordinates.
   */
  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);

    // Only save if we have at least 2 points (a line)
    if (currentPath.length >= 2) {
      // Convert all points to data coordinates for stable storage
      const dataPoints = currentPath.map(p => pixelToData(p.pixelX, p.pixelY));
      
      const newPath: DrawingPath = {
        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        points: currentPath,
        dataPoints: dataPoints, // Canonical coords for stable rendering
      };
      onPathsChange([...paths, newPath]);
    }

    setCurrentPath([]);
  }, [isDrawing, currentPath, paths, onPathsChange, pixelToData]);

  /**
   * Convert path to SVG polyline points string.
   * Uses data coordinates if available (stable), falls back to pixel coords (legacy).
   */
  const pathToPolylinePoints = useCallback((path: DrawingPath): string => {
    // Prefer data coordinates for stable rendering across different viewport sizes
    if (path.dataPoints && path.dataPoints.length > 0) {
      return path.dataPoints
        .map(p => {
          const { px, py } = dataToPixel(p.x, p.y);
          return `${px},${py}`;
        })
        .join(' ');
    }
    // Fallback to legacy pixel coordinates
    return path.points.map(p => `${p.pixelX},${p.pixelY}`).join(' ');
  }, [dataToPixel]);

  /**
   * Convert current drawing path (still in pixel coords) to SVG points string.
   */
  const currentPathToPoints = useMemo(() => {
    return currentPath.map(p => `${p.pixelX},${p.pixelY}`).join(' ');
  }, [currentPath]);

  // Don't render anything if not active and no paths (let clicks pass through)
  if (!active && paths.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 z-10"
      width={containerWidth}
      height={containerHeight}
      style={{ 
        pointerEvents: active ? 'auto' : 'none',
        touchAction: active ? 'none' : 'auto',
      }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {/* Saved paths - rendered using data coordinates for stability */}
      {paths.map((path) => (
        <polyline
          key={path.id}
          points={pathToPolylinePoints(path)}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Current drawing path (still in pixel coords during drawing) */}
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
