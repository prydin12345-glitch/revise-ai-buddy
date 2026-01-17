import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Move, RotateCw } from 'lucide-react';

export interface ProtractorState {
  x: number; // center X as fraction of plot width (0-1)
  y: number; // center Y as fraction of plot height (0-1)
  rotationDeg: number;
  visible: boolean;
}

interface ProtractorOverlayProps {
  containerWidth: number;
  containerHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  /** Protractor state for persistence */
  protractorState?: ProtractorState;
  /** Callback when state changes (for persistence) */
  onProtractorStateChange?: (state: ProtractorState) => void;
  /** Read-only mode */
  readOnly?: boolean;
}

/**
 * Draggable and rotatable protractor overlay for angle measurement reference.
 * 0° is along +x axis, 90° is up (+y).
 * 
 * Drag: Click/touch and drag anywhere on the protractor to move it.
 * Rotate: Drag the rotation handle on the rim, or use two-finger rotation.
 */
export function ProtractorOverlay({
  containerWidth,
  containerHeight,
  marginLeft,
  marginRight,
  marginTop,
  marginBottom,
  protractorState,
  onProtractorStateChange,
  readOnly = false,
}: ProtractorOverlayProps) {
  const plotWidth = containerWidth - marginLeft - marginRight;
  const plotHeight = containerHeight - marginTop - marginBottom;
  
  // Default state: center of plot, no rotation
  const defaultState: ProtractorState = {
    x: 0.5,
    y: 0.5,
    rotationDeg: 0,
    visible: true,
  };
  
  const state = protractorState || defaultState;
  
  // Convert fractional position to pixels
  const centerX = marginLeft + state.x * plotWidth;
  const centerY = marginTop + state.y * plotHeight;
  
  // Radius - use smaller dimension to fit, but smaller than before for draggability
  const radius = Math.min(plotWidth, plotHeight) * 0.35;
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; stateX: number; stateY: number } | null>(null);
  const rotateStartRef = useRef<{ angle: number; stateRotation: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Two-finger rotation tracking
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialAngleBetweenTouchesRef = useRef<number | null>(null);
  const initialRotationRef = useRef<number>(0);
  
  const updateState = useCallback((updates: Partial<ProtractorState>) => {
    if (onProtractorStateChange) {
      onProtractorStateChange({ ...state, ...updates });
    }
  }, [state, onProtractorStateChange]);
  
  // Handle drag start
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (readOnly || isRotating) return;
    e.stopPropagation();
    e.preventDefault();
    
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      stateX: state.x,
      stateY: state.y,
    };
    
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }, [readOnly, isRotating, state.x, state.y]);
  
  // Handle drag move
  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current || !svgRef.current) return;
    e.preventDefault();
    
    const rect = svgRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    // Convert pixel delta to fractional delta
    const newX = Math.max(0.1, Math.min(0.9, dragStartRef.current.stateX + deltaX / plotWidth));
    const newY = Math.max(0.1, Math.min(0.9, dragStartRef.current.stateY + deltaY / plotHeight));
    
    updateState({ x: newX, y: newY });
  }, [isDragging, plotWidth, plotHeight, updateState]);
  
  // Handle drag end
  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (isDragging) {
      e.preventDefault();
      setIsDragging(false);
      dragStartRef.current = null;
    }
  }, [isDragging]);
  
  // Handle rotation start (from handle)
  const handleRotateStart = useCallback((e: React.PointerEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    
    setIsRotating(true);
    
    // Calculate initial angle from center to pointer
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    const angle = Math.atan2(pointerY - centerY, pointerX - centerX) * 180 / Math.PI;
    
    rotateStartRef.current = {
      angle,
      stateRotation: state.rotationDeg,
    };
    
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }, [readOnly, centerX, centerY, state.rotationDeg]);
  
  // Handle rotation move
  const handleRotateMove = useCallback((e: React.PointerEvent) => {
    if (!isRotating || !rotateStartRef.current || !svgRef.current) return;
    e.preventDefault();
    
    const rect = svgRef.current.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    const currentAngle = Math.atan2(pointerY - centerY, pointerX - centerX) * 180 / Math.PI;
    
    const deltaAngle = currentAngle - rotateStartRef.current.angle;
    let newRotation = (rotateStartRef.current.stateRotation + deltaAngle) % 360;
    if (newRotation < 0) newRotation += 360;
    
    updateState({ rotationDeg: newRotation });
  }, [isRotating, centerX, centerY, updateState]);
  
  // Handle rotation end
  const handleRotateEnd = useCallback((e: React.PointerEvent) => {
    if (isRotating) {
      e.preventDefault();
      setIsRotating(false);
      rotateStartRef.current = null;
    }
  }, [isRotating]);
  
  // Two-finger rotation for touch devices
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (readOnly) return;
    
    // Track all touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      touchesRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    
    // If we have exactly 2 touches, start rotation tracking
    if (touchesRef.current.size === 2) {
      const touches = Array.from(touchesRef.current.values());
      const angle = Math.atan2(
        touches[1].y - touches[0].y,
        touches[1].x - touches[0].x
      ) * 180 / Math.PI;
      initialAngleBetweenTouchesRef.current = angle;
      initialRotationRef.current = state.rotationDeg;
    }
  }, [readOnly, state.rotationDeg]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (readOnly) return;
    
    // Update touch positions
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      touchesRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    
    // Two-finger rotation
    if (touchesRef.current.size === 2 && initialAngleBetweenTouchesRef.current !== null) {
      e.preventDefault();
      const touches = Array.from(touchesRef.current.values());
      const currentAngle = Math.atan2(
        touches[1].y - touches[0].y,
        touches[1].x - touches[0].x
      ) * 180 / Math.PI;
      
      const deltaAngle = currentAngle - initialAngleBetweenTouchesRef.current;
      let newRotation = (initialRotationRef.current + deltaAngle) % 360;
      if (newRotation < 0) newRotation += 360;
      
      updateState({ rotationDeg: newRotation });
    }
  }, [readOnly, updateState]);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      touchesRef.current.delete(e.changedTouches[i].identifier);
    }
    
    if (touchesRef.current.size < 2) {
      initialAngleBetweenTouchesRef.current = null;
    }
  }, []);
  
  // Generate tick marks every 10 degrees
  const ticks: Array<{ angle: number; major: boolean }> = [];
  for (let i = 0; i < 360; i += 10) {
    ticks.push({ angle: i, major: i % 30 === 0 });
  }
  
  // Rotation handle position (on rim, at 0°)
  const handleAngle = state.rotationDeg * Math.PI / 180;
  const handleX = centerX + radius * Math.cos(handleAngle);
  const handleY = centerY - radius * Math.sin(handleAngle); // Negative because SVG y is flipped

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        pointerEvents: (isDragging || isRotating) ? 'auto' : 'none',
        overflow: 'visible',
        zIndex: 10,
        touchAction: 'none',
      }}
      onPointerMove={(e) => {
        if (isDragging) handleDragMove(e);
        if (isRotating) handleRotateMove(e);
      }}
      onPointerUp={(e) => {
        handleDragEnd(e);
        handleRotateEnd(e);
      }}
      onPointerCancel={(e) => {
        handleDragEnd(e);
        handleRotateEnd(e);
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <g transform={`rotate(${-state.rotationDeg}, ${centerX}, ${centerY})`}>
        {/* Main draggable circle - invisible but captures events */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="transparent"
          style={{ 
            cursor: readOnly ? 'default' : 'move', 
            pointerEvents: 'auto',
          }}
          onPointerDown={handleDragStart}
        />
        
        {/* Semi-transparent circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="hsl(var(--primary) / 0.08)"
          stroke="hsl(var(--primary) / 0.4)"
          strokeWidth={2}
          pointerEvents="none"
        />
        
        {/* Inner circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius * 0.08}
          fill="hsl(var(--primary) / 0.3)"
          stroke="hsl(var(--primary) / 0.5)"
          strokeWidth={1}
          pointerEvents="none"
        />
        
        {/* Tick marks */}
        {ticks.map(({ angle, major }) => {
          // Convert to radians, adjust so 0° is +x and 90° is +y (up)
          // In SVG, y increases downward, so we need to negate
          const rad = (-angle * Math.PI) / 180;
          const innerR = major ? radius * 0.85 : radius * 0.9;
          const outerR = radius;
          
          const x1 = centerX + innerR * Math.cos(rad);
          const y1 = centerY + innerR * Math.sin(rad);
          const x2 = centerX + outerR * Math.cos(rad);
          const y2 = centerY + outerR * Math.sin(rad);
          
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="hsl(var(--primary) / 0.5)"
              strokeWidth={major ? 2 : 1}
              pointerEvents="none"
            />
          );
        })}
        
        {/* Angle labels every 30 degrees */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
          const rad = (-angle * Math.PI) / 180;
          const labelR = radius * 0.75;
          const x = centerX + labelR * Math.cos(rad);
          const y = centerY + labelR * Math.sin(rad);
          
          return (
            <text
              key={`label-${angle}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fill="hsl(var(--primary) / 0.7)"
              fontWeight={angle % 90 === 0 ? 'bold' : 'normal'}
              pointerEvents="none"
            >
              {angle}°
            </text>
          );
        })}
      </g>
      
      {/* Rotation handle (not rotated with the protractor) */}
      {!readOnly && (
        <g>
          {/* Larger invisible touch target */}
          <circle
            cx={handleX}
            cy={handleY}
            r={18}
            fill="transparent"
            style={{ cursor: 'grab', pointerEvents: 'auto' }}
            onPointerDown={handleRotateStart}
          />
          {/* Visible handle */}
          <circle
            cx={handleX}
            cy={handleY}
            r={10}
            fill="hsl(var(--primary))"
            stroke="white"
            strokeWidth={2}
            style={{ cursor: 'grab', pointerEvents: 'auto' }}
            onPointerDown={handleRotateStart}
          />
          <g transform={`translate(${handleX - 6}, ${handleY - 6})`}>
            <RotateCw size={12} color="white" />
          </g>
        </g>
      )}
      
      {/* Move indicator at center */}
      {!readOnly && (
        <g 
          style={{ cursor: 'move', pointerEvents: 'auto' }}
          onPointerDown={handleDragStart}
        >
          <circle
            cx={centerX}
            cy={centerY}
            r={16}
            fill="transparent"
          />
          <g transform={`translate(${centerX - 8}, ${centerY - 8})`}>
            <Move size={16} color="hsl(var(--primary))" opacity={0.6} />
          </g>
        </g>
      )}
    </svg>
  );
}

export default ProtractorOverlay;
