import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CameraState, getVisibleDomain, createCameraFromDomain } from '@/components/graph/types';

interface UseGraphCameraOptions {
  /** Initial domain to fit in view */
  initialDomainX?: [number, number];
  initialDomainY?: [number, number];
  /** Viewport dimensions */
  viewportWidth: number;
  viewportHeight: number;
  /** Minimum scale (graph units per 100 pixels) - prevents zooming in too far */
  minScale?: number;
  /** Maximum scale - prevents zooming out too far */
  maxScale?: number;
  /** Whether pan/zoom is enabled */
  interactionEnabled?: boolean;
  /** Callback when camera changes */
  onCameraChange?: (camera: CameraState) => void;
}

interface UseGraphCameraReturn {
  /** Current camera state */
  camera: CameraState;
  /** Set camera state directly */
  setCamera: (camera: CameraState) => void;
  /** Current visible domain based on camera and viewport */
  visibleDomain: { domainX: [number, number]; domainY: [number, number] };
  /** Convert graph coordinates to screen pixels */
  graphToScreen: (graphX: number, graphY: number) => { x: number; y: number };
  /** Convert screen pixels to graph coordinates */
  screenToGraph: (screenX: number, screenY: number) => { x: number; y: number };
  /** Handle zoom (centered on a point) */
  zoom: (factor: number, centerScreenX?: number, centerScreenY?: number) => void;
  /** Handle pan by delta in screen pixels */
  pan: (deltaScreenX: number, deltaScreenY: number) => void;
  /** Reset camera to fit the initial domain */
  resetCamera: () => void;
  /** Handlers to attach to the container element */
  handlers: {
    onWheel: (e: React.WheelEvent) => void;
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  /** Whether currently panning */
  isPanning: boolean;
}

/**
 * Hook for managing a Desmos-style camera-based graph viewport.
 * 
 * Provides:
 * - Camera state management (center position + scale)
 * - Coordinate conversion functions (graphToScreen, screenToGraph)
 * - Pan/zoom gesture handling
 * - Automatic grid scaling based on zoom level
 */
export function useGraphCamera({
  initialDomainX = [-10, 10],
  initialDomainY = [-10, 10],
  viewportWidth,
  viewportHeight,
  minScale = 0.2, // Min 0.2 units per 100px (max zoom in)
  maxScale = 20,  // Max 20 units per 100px (max zoom out)
  interactionEnabled = true,
  onCameraChange,
}: UseGraphCameraOptions): UseGraphCameraReturn {
  
  // Initialize camera to fit the initial domain
  const [camera, setCameraState] = useState<CameraState>(() => 
    createCameraFromDomain(initialDomainX, initialDomainY, viewportWidth || 400, viewportHeight || 400)
  );
  
  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; camera: CameraState } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  
  // Touch gesture state for pinch-to-zoom
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialPinchCenterRef = useRef<{ x: number; y: number } | null>(null);
  const initialPinchScaleRef = useRef<number | null>(null);
  
  // Update camera and notify
  const setCamera = useCallback((newCamera: CameraState) => {
    // Clamp scale to limits
    const clampedScale = Math.max(minScale, Math.min(maxScale, newCamera.scale));
    const finalCamera = { ...newCamera, scale: clampedScale };
    setCameraState(finalCamera);
    onCameraChange?.(finalCamera);
  }, [minScale, maxScale, onCameraChange]);
  
  // Recompute camera when viewport size changes significantly
  useEffect(() => {
    if (viewportWidth > 0 && viewportHeight > 0) {
      // Only reset if this is the first valid size
      setCameraState(prev => {
        if (prev.scale === 0) {
          return createCameraFromDomain(initialDomainX, initialDomainY, viewportWidth, viewportHeight);
        }
        return prev;
      });
    }
  }, [viewportWidth, viewportHeight, initialDomainX, initialDomainY]);
  
  // Calculate visible domain from camera
  const visibleDomain = useMemo(() => {
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return { domainX: initialDomainX, domainY: initialDomainY };
    }
    return getVisibleDomain(camera, viewportWidth, viewportHeight);
  }, [camera, viewportWidth, viewportHeight, initialDomainX, initialDomainY]);
  
  /**
   * Convert graph coordinates to screen pixels.
   * (0, 0) is top-left of the viewport.
   */
  const graphToScreen = useCallback((graphX: number, graphY: number): { x: number; y: number } => {
    // Guard against invalid camera state or viewport dimensions
    if (camera.scale <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
      return { x: NaN, y: NaN };
    }
    
    // camera.scale = graph units per 100 pixels
    // So 1 graph unit = 100 / camera.scale pixels
    const pixelsPerUnit = 100 / camera.scale;
    
    // Distance from center in graph units
    const deltaX = graphX - camera.centerX;
    const deltaY = graphY - camera.centerY;
    
    // Convert to pixels (Y is inverted in screen space)
    const screenX = viewportWidth / 2 + deltaX * pixelsPerUnit;
    const screenY = viewportHeight / 2 - deltaY * pixelsPerUnit;
    
    return { x: screenX, y: screenY };
  }, [camera, viewportWidth, viewportHeight]);
  
  /**
   * Convert screen pixels to graph coordinates.
   */
  const screenToGraph = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    // Guard against invalid camera state or viewport dimensions
    if (camera.scale <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
      return { x: NaN, y: NaN };
    }
    
    const pixelsPerUnit = 100 / camera.scale;
    
    // Distance from center in pixels
    const deltaPixelX = screenX - viewportWidth / 2;
    const deltaPixelY = screenY - viewportHeight / 2;
    
    // Convert to graph units (Y is inverted)
    const graphX = camera.centerX + deltaPixelX / pixelsPerUnit;
    const graphY = camera.centerY - deltaPixelY / pixelsPerUnit;
    
    return { x: graphX, y: graphY };
  }, [camera, viewportWidth, viewportHeight]);
  
  /**
   * Zoom the camera by a factor, centered on a screen position.
   * factor > 1 = zoom out, factor < 1 = zoom in
   */
  const zoom = useCallback((factor: number, centerScreenX?: number, centerScreenY?: number) => {
    // Guard against invalid camera or viewport state
    if (camera.scale <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }
    
    const cx = centerScreenX ?? viewportWidth / 2;
    const cy = centerScreenY ?? viewportHeight / 2;
    
    // Get the graph point under the cursor before zoom
    const graphPoint = screenToGraph(cx, cy);
    
    // Guard against NaN coordinates
    if (!Number.isFinite(graphPoint.x) || !Number.isFinite(graphPoint.y)) {
      return;
    }
    
    // Apply zoom factor to scale
    const newScale = Math.max(minScale, Math.min(maxScale, camera.scale * factor));
    
    // After zoom, we want the same graph point to be under the cursor
    // Calculate what the new center should be
    const pixelsPerUnit = 100 / newScale;
    const deltaPixelX = cx - viewportWidth / 2;
    const deltaPixelY = cy - viewportHeight / 2;
    
    const newCenterX = graphPoint.x - deltaPixelX / pixelsPerUnit;
    const newCenterY = graphPoint.y + deltaPixelY / pixelsPerUnit;
    
    // Final guard - ensure we don't set NaN values
    if (!Number.isFinite(newCenterX) || !Number.isFinite(newCenterY) || !Number.isFinite(newScale)) {
      return;
    }
    
    setCamera({
      centerX: newCenterX,
      centerY: newCenterY,
      scale: newScale,
    });
  }, [camera.scale, viewportWidth, viewportHeight, screenToGraph, setCamera, minScale, maxScale]);
  
  /**
   * Pan the camera by a delta in screen pixels.
   */
  const pan = useCallback((deltaScreenX: number, deltaScreenY: number) => {
    // Guard against invalid camera state
    if (camera.scale <= 0) return;
    
    const pixelsPerUnit = 100 / camera.scale;
    
    // Convert pixel delta to graph units (Y is inverted)
    const deltaGraphX = -deltaScreenX / pixelsPerUnit;
    const deltaGraphY = deltaScreenY / pixelsPerUnit;
    
    const newCenterX = camera.centerX + deltaGraphX;
    const newCenterY = camera.centerY + deltaGraphY;
    
    // Guard against NaN
    if (!Number.isFinite(newCenterX) || !Number.isFinite(newCenterY)) return;
    
    setCamera({
      ...camera,
      centerX: newCenterX,
      centerY: newCenterY,
    });
  }, [camera, setCamera]);
  
  /**
   * Reset camera to fit the initial domain.
   */
  const resetCamera = useCallback(() => {
    const newCamera = createCameraFromDomain(
      initialDomainX,
      initialDomainY,
      viewportWidth,
      viewportHeight
    );
    setCamera(newCamera);
  }, [initialDomainX, initialDomainY, viewportWidth, viewportHeight, setCamera]);
  
  // ===== Event Handlers =====
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!interactionEnabled) return;
    
    // Prevent page zoom - must stop propagation and prevent default
    e.preventDefault();
    e.stopPropagation();
    
    // Zoom factor based on wheel delta - REDUCED for smoother feel
    // Smaller values = finer control (was 1.1/0.9, now 1.03/0.97)
    const zoomFactor = e.deltaY > 0 ? 1.03 : 0.97;
    
    // Get cursor position relative to the container
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    
    zoom(zoomFactor, cursorX, cursorY);
  }, [interactionEnabled, zoom]);
  
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!interactionEnabled) return;
    
    // Track touch for pinch gesture
    if (e.pointerType === 'touch') {
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      
      if (touchesRef.current.size === 2) {
        // Start pinch gesture
        const touches = Array.from(touchesRef.current.values());
        const dx = touches[1].x - touches[0].x;
        const dy = touches[1].y - touches[0].y;
        initialPinchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
        initialPinchCenterRef.current = {
          x: (touches[0].x + touches[1].x) / 2,
          y: (touches[0].y + touches[1].y) / 2,
        };
        initialPinchScaleRef.current = camera.scale;
        return;
      }
    }
    
    // Single pointer pan
    if (pointerIdRef.current === null) {
      pointerIdRef.current = e.pointerId;
      panStartRef.current = { x: e.clientX, y: e.clientY, camera: { ...camera } };
      setIsPanning(true);
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }, [interactionEnabled, camera]);
  
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!interactionEnabled) return;
    
    // Update touch position
    if (e.pointerType === 'touch' && touchesRef.current.has(e.pointerId)) {
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      
      // Handle pinch gesture
      if (touchesRef.current.size === 2 && initialPinchDistanceRef.current !== null) {
        const touches = Array.from(touchesRef.current.values());
        const dx = touches[1].x - touches[0].x;
        const dy = touches[1].y - touches[0].y;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate zoom factor with damping for smoother pinch zoom
        // Raw ratio can be too sensitive, so we dampen it
        const rawRatio = initialPinchDistanceRef.current / currentDistance;
        // Apply damping: move 30% toward the raw ratio (was 100%)
        const zoomFactor = 1 + (rawRatio - 1) * 0.3;
        const newScale = Math.max(minScale, Math.min(maxScale, initialPinchScaleRef.current! * zoomFactor));
        
        // Zoom centered on pinch midpoint
        if (initialPinchCenterRef.current) {
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = initialPinchCenterRef.current.x - rect.left;
          const cy = initialPinchCenterRef.current.y - rect.top;
          
          // Use initial camera state for calculation
          const initialCamera = { ...camera, scale: initialPinchScaleRef.current! };
          const pixelsPerUnit = 100 / initialCamera.scale;
          const graphPoint = {
            x: initialCamera.centerX + (cx - viewportWidth / 2) / pixelsPerUnit,
            y: initialCamera.centerY - (cy - viewportHeight / 2) / pixelsPerUnit,
          };
          
          const newPixelsPerUnit = 100 / newScale;
          const deltaPixelX = cx - viewportWidth / 2;
          const deltaPixelY = cy - viewportHeight / 2;
          
          setCamera({
            centerX: graphPoint.x - deltaPixelX / newPixelsPerUnit,
            centerY: graphPoint.y + deltaPixelY / newPixelsPerUnit,
            scale: newScale,
          });
        }
        return;
      }
    }
    
    // Single pointer pan
    if (pointerIdRef.current === e.pointerId && panStartRef.current) {
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;
      
      const pixelsPerUnit = 100 / panStartRef.current.camera.scale;
      
      setCamera({
        ...panStartRef.current.camera,
        centerX: panStartRef.current.camera.centerX - deltaX / pixelsPerUnit,
        centerY: panStartRef.current.camera.centerY + deltaY / pixelsPerUnit,
      });
    }
  }, [interactionEnabled, camera, viewportWidth, viewportHeight, minScale, maxScale, setCamera]);
  
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Clean up touch tracking
    if (e.pointerType === 'touch') {
      touchesRef.current.delete(e.pointerId);
      if (touchesRef.current.size < 2) {
        initialPinchDistanceRef.current = null;
        initialPinchCenterRef.current = null;
        initialPinchScaleRef.current = null;
      }
    }
    
    // End pan
    if (pointerIdRef.current === e.pointerId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}
      pointerIdRef.current = null;
      panStartRef.current = null;
      setIsPanning(false);
    }
  }, []);
  
  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    handlePointerUp(e);
  }, [handlePointerUp]);
  
  return {
    camera,
    setCamera,
    visibleDomain,
    graphToScreen,
    screenToGraph,
    zoom,
    pan,
    resetCamera,
    handlers: {
      onWheel: handleWheel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
    isPanning,
  };
}
