import React, { useRef, useCallback, useState } from 'react';
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
}

/**
 * GraphDrawingCanvas - SVG overlay for freeform drawing on the graph.
 * 
 * When active, captures mouse/touch events to draw freehand paths.
 * Paths are stored as pixel coordinates relative to the canvas.
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
}: GraphDrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ pixelX: number; pixelY: number }>>([]);

  // Calculate plot area bounds
  const plotLeft = marginLeft;
  const plotTop = marginTop;
  const plotRight = containerWidth - marginRight;
  const plotBottom = containerHeight - marginBottom;

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
   * End drawing - save the path.
   */
  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);

    // Only save if we have at least 2 points (a line)
    if (currentPath.length >= 2) {
      const newPath: DrawingPath = {
        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        points: currentPath,
      };
      onPathsChange([...paths, newPath]);
    }

    setCurrentPath([]);
  }, [isDrawing, currentPath, paths, onPathsChange]);

  /**
   * Convert path points to SVG polyline points string.
   */
  const pathToPolylinePoints = useCallback((points: Array<{ pixelX: number; pixelY: number }>): string => {
    return points.map(p => `${p.pixelX},${p.pixelY}`).join(' ');
  }, []);

  // Don't render anything if not active (let clicks pass through)
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
      {/* Saved paths */}
      {paths.map((path) => (
        <polyline
          key={path.id}
          points={pathToPolylinePoints(path.points)}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Current drawing path */}
      {isDrawing && currentPath.length > 0 && (
        <polyline
          points={pathToPolylinePoints(currentPath)}
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
