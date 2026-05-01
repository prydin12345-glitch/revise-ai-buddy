import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GraphSeries } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { Undo2, Redo2, Trash2, Eraser, Minus, Spline, Pencil, Ruler, Maximize2 } from 'lucide-react';
import { 
  GraphPlottingConfig, 
  GraphPoint, 
  GraphPlottingAnswer,
  GraphPlottingMarkingResult,
  LineSegment,
  DrawingPath
} from './types';
import { GraphSegmentsLayer } from './GraphSegmentsLayer';
import { GraphDrawingCanvas } from './GraphDrawingCanvas';
import { ProtractorOverlay, ProtractorState } from './ProtractorOverlay';
import { AngleMeasurementOverlay } from './AngleMeasurementOverlay';
import { ExpandedGraphModal } from './ExpandedGraphModal';
import { GraphCanvasPlot } from './GraphCanvasPlot';

// Persisted angle measurement
export interface AngleMeasurement {
  id: string;
  segmentId1: string;
  segmentId2: string;
  angleDegrees: number;
  /** User-draggable label offset in pixels from the default position */
  labelOffset?: { x: number; y: number };
}

interface GraphPlottingQuestionProps {
  config: GraphPlottingConfig;
  expectedAnswer?: GraphPlottingAnswer;
  studentPoints: GraphPoint[];
  onPointsChange: (points: GraphPoint[]) => void;
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: GraphPlottingMarkingResult;
  subjectColor?: string;
  joinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null;
  onJoinModeChange?: (mode: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null) => void;
  segments: LineSegment[];
  onSegmentsChange: (segments: LineSegment[]) => void;
  drawnPaths?: DrawingPath[];
  onDrawnPathsChange?: (paths: DrawingPath[]) => void;
  /** Used to reset internal state when question changes */
  questionId?: string;
  /** Show protractor overlay */
  showProtractor?: boolean;
  /** Protractor state for position/rotation persistence */
  protractorState?: ProtractorState;
  /** Callback when protractor state changes */
  onProtractorStateChange?: (state: ProtractorState) => void;
  /** Callback when segment is selected for angle measurement */
  selectedSegmentIds?: string[];
  onSelectedSegmentIdsChange?: (ids: string[]) => void;
  /** Persisted angle measurements */
  angleMeasurements?: AngleMeasurement[];
  onAngleMeasurementsChange?: (measurements: AngleMeasurement[]) => void;
  /** Reference curves/series to display (from graphConfig.series) */
  referenceSeries?: GraphSeries[];
  /** Expected answer curve to display in review mode (dashed green) */
  expectedCurveSeries?: GraphSeries[];
  /** Question text to display in expanded graph modal */
  questionText?: string;
}

// History state for undo/redo
interface HistoryState {
  points: GraphPoint[];
  segments: LineSegment[];
  drawnPaths: DrawingPath[];
  angleMeasurements: AngleMeasurement[];
}

/**
 * Generate a stable unique ID for a point.
 */
function generatePointId(): string {
  return `pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * GraphPlottingQuestion - Interactive scatter plot for plotting points and creating segments.
 * 
 * Workflow:
 * 1. User plots points by clicking on the graph
 * 2. User selects a join mode (straight or curved)
 * 3. User taps Point A, then Point B to create a segment between them
 * 4. Segments are rendered using the selected mode
 * 
 * NO auto-joining: Lines/curves only appear when user explicitly creates segments.
 */
export function GraphPlottingQuestion({
  config,
  expectedAnswer,
  studentPoints,
  onPointsChange,
  readOnly = false,
  showCorrectAnswers = false,
  markingData,
  subjectColor = 'hsl(var(--primary))',
  joinMode,
  onJoinModeChange,
  segments = [],
  onSegmentsChange,
  drawnPaths = [],
  onDrawnPathsChange,
  questionId,
  showProtractor = false,
  protractorState,
  onProtractorStateChange,
  selectedSegmentIds = [],
  onSelectedSegmentIdsChange,
  angleMeasurements = [],
  onAngleMeasurementsChange,
  referenceSeries = [],
  expectedCurveSeries = [],
  questionText,
}: GraphPlottingQuestionProps) {
  const chartRef = useRef<any>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Chart size state
  const [chartContainerSize, setChartContainerSize] = useState({ width: 400, height: 300 });
  
  // History stacks for undo/redo (stores full state snapshots)
  const [undoStack, setUndoStack] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);
  
  // Recharts axis scales (captured from rendered chart)
  const [axisScales, setAxisScales] = useState<{ x?: any; y?: any }>({});
  
  // Chart margins (captured from rendered chart)
  const [chartMargins, setChartMargins] = useState({
    left: 60,
    right: 20,
    top: 20,
    bottom: 40,
  });
  
  // Store the screenToGraph function from camera renderer for coordinate conversion
  const screenToGraphRef = useRef<((x: number, y: number) => { x: number; y: number }) | null>(null);

  // Selected points for creating segments (tap Point A, then Point B)
  const [selectedJoinPoints, setSelectedJoinPoints] = useState<GraphPoint[]>([]);

  // Long-press detection for activating drag mode (replaces unreliable double-tap on touch)
  const LONG_PRESS_DURATION = 500; // ms
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPointIdRef = useRef<string | null>(null);
  const longPressTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_MOVE_CANCEL = 8; // px - cancel long-press if finger moves more than this

  // Drag hint (shown once per session, hidden after first drag activation)
  const [showDragHint, setShowDragHint] = useState(true);

  // Double-tap detection kept as fallback for mouse/desktop
  const lastTapRef = useRef<{ pointId: string | null; time: number; x: number; y: number }>({
    pointId: null,
    time: 0,
    x: 0,
    y: 0
  });
  const DOUBLE_TAP_THRESHOLD = 600;
  const DOUBLE_TAP_DISTANCE = 80;

  // Hit radius for touch targets (larger for all devices to fix "dead zone" issue)
  const isCoarsePointer = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }, []);

  // INCREASED hit radius for all devices - minimum 40px for mouse, 60px+ for touch
  const POINT_HIT_RADIUS = useMemo(() => {
    if (!isCoarsePointer) return 40; // Desktop: increased from 32 to 40
    // Touch devices: generous hit targets
    if (chartContainerSize.width < 480) return 60; // Phone: increased from 44 to 60
    return 80; // Tablet: increased from 72 to 80
  }, [isCoarsePointer, chartContainerSize.width]);
  
  // Track if pointer event started on a point (to prevent bubbling issues)
  const pointerStartedOnPointRef = useRef(false);
  
  // Track if pointer event started on a line segment (to prevent container from clearing selection)
  const pointerStartedOnLineRef = useRef(false);
  
  // Active draggable point ID (selected via double-tap for drag mode) - use ID not coordinates
  const [activeDragPointId, setActiveDragPointIdState] = useState<string | null>(null);
  // Keep a ref in sync for use in event handlers (avoids stale closure issues)
  const activeDragPointIdRef = useRef<string | null>(null);
  // Wrapper to sync ref immediately on set (not just after render)
  const setActiveDragPointId = useCallback((id: string | null) => {
    activeDragPointIdRef.current = id;
    setActiveDragPointIdState(id);
  }, []);
  
  // Dragging state for point repositioning - track by ID
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [draggingPosition, setDraggingPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const isDraggingRef = useRef(false);
  const DRAG_THRESHOLD = 8; // px - minimum movement to start drag
  
  // Jitter buffer: track pointer-down position for camera container handlers
  const cameraPointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const JITTER_THRESHOLD_PX = 5; // Max movement to count as a "clean tap"
  
  // Multi-touch guard: track active touch count
  const activeTouchCountRef = useRef(0);
  
  // Erase mode
  const [eraseMode, setEraseMode] = useState(false);
  
  // Expanded modal state
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Manual coordinate entry state
  const [manualX, setManualX] = useState('');
  const [manualY, setManualY] = useState('');
  
  // Curve mode: 'auto' uses Catmull-Rom spline, 'manual' shows Bézier handles
  const [curveMode, setCurveMode] = useState<'auto' | 'manual'>('auto');
  // Helper: find point by ID
  const findPointById = useCallback((id: string | null): GraphPoint | undefined => {
    if (!id) return undefined;
    return studentPoints.find(p => p.id === id);
  }, [studentPoints]);

  // Clear long-press timer helper
  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPointIdRef.current = null;
    longPressTouchStartRef.current = null;
  }, []);

  // Reset internal state when question changes (navigation/retry)
  useEffect(() => {
    setSelectedJoinPoints([]);
    lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
    pointerStartedOnPointRef.current = false;
    pointerStartedOnLineRef.current = false;
    setDraggingPointId(null);
    setDraggingPosition(null);
    setActiveDragPointId(null);
    isDraggingRef.current = false;
    dragStartRef.current = null;
    setEraseMode(false);
    setUndoStack([]);
    setRedoStack([]);
    clearLongPress();
  }, [questionId]);

  // Cleanup long-press timer on unmount
  useEffect(() => {
    return () => { clearLongPress(); };
  }, [clearLongPress]);

  // Observe container size changes
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Capture Recharts axis scales and margins
  useEffect(() => {
    if (!chartRef.current) return;
    
    const timer = setTimeout(() => {
      try {
        const chart = chartRef.current;
        if (chart?.state) {
          const { xAxisMap, yAxisMap } = chart.state;
          if (xAxisMap && yAxisMap) {
            const xAxis = Object.values(xAxisMap)[0] as any;
            const yAxis = Object.values(yAxisMap)[0] as any;
            if (xAxis?.scale && yAxis?.scale) {
              setAxisScales({ x: xAxis.scale, y: yAxis.scale });
              setChartMargins({
                left: xAxis.x || 60,
                right: chartContainerSize.width - (xAxis.x + xAxis.width) || 20,
                top: yAxis.y || 20,
                bottom: chartContainerSize.height - (yAxis.y + yAxis.height) || 40,
              });
            }
          }
        }
      } catch (e) {
        console.warn('Failed to capture axis scales:', e);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [chartContainerSize, studentPoints]);

  // Calculate domain from config
  const domainX: [number, number] = useMemo(() => {
    if (config.domainX) return config.domainX;
    return [0, 10];
  }, [config.domainX]);

  const domainY: [number, number] = useMemo(() => {
    if (config.domainY) return config.domainY;
    return [0, 10];
  }, [config.domainY]);

  // Determine current join mode
  // joinMode === null means "no mode selected" - user can add points normally
  // joinMode === 'angle' means angle measurement mode - no point adding/joining, only segment selection
  const isJoinModeEnabled = config.joinPointsMode?.enabled ?? false;
  const isAngleMode = joinMode === 'angle';
  const isDrawingMode = joinMode === 'straight' || joinMode === 'curved' || joinMode === 'freeform';
  const isJoinModeActive = isJoinModeEnabled && isDrawingMode;
  const currentJoinMode = joinMode;

  /**
   * Compute angle between two segments at their shared vertex.
   * Returns angle in degrees (0-180) or null if no shared vertex.
   * Uses ID-based matching when available, falls back to coordinate matching with tolerance.
   */
  const computeAngleBetweenSegments = useCallback((seg1: LineSegment, seg2: LineSegment): { angle: number; vertex: GraphPoint } | null => {
    // Helper to check if two points match (by ID or by coordinates with tolerance)
    const pointsMatch = (p1: GraphPoint, p2: GraphPoint): boolean => {
      // First try ID match (most reliable)
      if (p1.id && p2.id && p1.id === p2.id) return true;
      // Fall back to coordinate match with small tolerance (0.01 for floating point)
      const tolerance = 0.01;
      return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
    };
    
    // Find shared vertex by checking all combinations
    const endpoints1 = [seg1.from, seg1.to];
    const endpoints2 = [seg2.from, seg2.to];
    let sharedVertex: GraphPoint | null = null;
    let idx1 = -1, idx2 = -1;
    
    for (let i = 0; i < endpoints1.length && !sharedVertex; i++) {
      for (let j = 0; j < endpoints2.length; j++) {
        if (pointsMatch(endpoints1[i], endpoints2[j])) {
          sharedVertex = endpoints1[i];
          idx1 = i;
          idx2 = j;
          break;
        }
      }
    }
    
    if (!sharedVertex) {
      return null;
    }
    
    // Get the "other" endpoint from each segment (not the shared vertex)
    const other1 = idx1 === 0 ? seg1.to : seg1.from;
    const other2 = idx2 === 0 ? seg2.to : seg2.from;
    
    // Calculate vectors from shared vertex to other endpoints
    const v1 = { x: other1.x - sharedVertex.x, y: other1.y - sharedVertex.y };
    const v2 = { x: other2.x - sharedVertex.x, y: other2.y - sharedVertex.y };
    
    // Compute angle using dot product
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return { angle: 0, vertex: sharedVertex };
    
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angleRad = Math.acos(cosAngle);
    const angleDeg = Math.round((angleRad * 180) / Math.PI);
    
    return { angle: angleDeg, vertex: sharedVertex };
  }, []);

  /**
   * Round a value to 4 decimal places (prevents floating point noise).
   */
  const roundCoord = useCallback((value: number): number => {
    return Math.round(value * 10000) / 10000;
  }, []);

  /**
   * Format a coordinate for display: up to 4dp, trailing zeros trimmed.
   */
  const formatCoord = useCallback((n: number): string => {
    if (Number.isInteger(n)) return n.toString();
    const str = n.toFixed(4);
    return parseFloat(str).toString();
  }, []);

  /**
   * Snap a coordinate to the nearest grid intersection.
   * Uses stepX/stepY from config (default 0.5) for clean grid values.
   * Falls back to 4dp rounding if snapToGrid is not enabled.
   */
  const snapPoint = useCallback((x: number, y: number): { x: number; y: number } => {
    const snapEnabled = config.snapToGrid !== false; // default true
    const stepX = config.stepX || 0.5;
    const stepY = config.stepY || 0.5;
    
    if (snapEnabled) {
      return {
        x: Math.round(x / stepX) * stepX,
        y: Math.round(y / stepY) * stepY,
      };
    }
    
    return { 
      x: roundCoord(x), 
      y: roundCoord(y) 
    };
  }, [roundCoord, config.snapToGrid, config.stepX, config.stepY]);

  /**
   * Check if a point is currently selected for joining.
   */
  const isPointSelected = useCallback((point: GraphPoint): boolean => {
    return selectedJoinPoints.some(p => p.id === point.id);
  }, [selectedJoinPoints]);

  /**
   * Save current state to history (call before making changes)
   */
  const saveToHistory = useCallback(() => {
    const currentState: HistoryState = {
      points: [...studentPoints],
      segments: [...segments],
      drawnPaths: [...drawnPaths],
      angleMeasurements: [...angleMeasurements],
    };
    setUndoStack(prev => [...prev, currentState]);
    setRedoStack([]); // Clear redo stack on new action
  }, [studentPoints, segments, drawnPaths, angleMeasurements]);

  /**
   * Handle segment selection in angle mode - when 2 segments selected, create a persisted measurement.
   */
  const handleAngleSegmentSelect = useCallback((segId: string) => {
    if (!onSelectedSegmentIdsChange) return;
    
    if (!onSelectedSegmentIdsChange) return;
    
    // If segment is already in the transient selection, deselect it
    if (selectedSegmentIds.includes(segId)) {
      const newSelection = selectedSegmentIds.filter(id => id !== segId);
      onSelectedSegmentIdsChange(newSelection);
      return;
    }
    
    // Add to selection
    const newSelection = [...selectedSegmentIds, segId];
    
    if (newSelection.length < 2) {
      // First segment selected, just update selection
      onSelectedSegmentIdsChange(newSelection);
      return;
    }
    
    // Two segments selected - try to create a persisted angle measurement
    const seg1 = segments.find(s => s.id === newSelection[0]);
    const seg2 = segments.find(s => s.id === newSelection[1]);
    
    if (seg1 && seg2) {
      const result = computeAngleBetweenSegments(seg1, seg2);
      
      if (result !== null && onAngleMeasurementsChange) {
        // Check if this measurement already exists
        const exists = angleMeasurements.some(m => 
          (m.segmentId1 === seg1.id && m.segmentId2 === seg2.id) ||
          (m.segmentId1 === seg2.id && m.segmentId2 === seg1.id)
        );
        
        if (!exists) {
          saveToHistory();
          const newMeasurement: AngleMeasurement = {
            id: `angle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            segmentId1: seg1.id,
            segmentId2: seg2.id,
            angleDegrees: result.angle,
          };
          const newMeasurements = [...angleMeasurements, newMeasurement];
          onAngleMeasurementsChange(newMeasurements);
        }
        // Clear transient selection after successful measurement - segments stay orange via angleMeasurements
        onSelectedSegmentIdsChange([]);
      } else {
        // Segments don't share a vertex - clear first selection and keep the new one
        // This allows user to "start over" by tapping a different segment
        onSelectedSegmentIdsChange([segId]);
      }
    } else {
      // Segment not found - clear selection
      onSelectedSegmentIdsChange([]);
    }
  }, [selectedSegmentIds, segments, angleMeasurements, onSelectedSegmentIdsChange, onAngleMeasurementsChange, computeAngleBetweenSegments, saveToHistory, isAngleMode]);

  /**
   * Handle erasing an angle measurement.
   */
  const handleAngleMeasurementErase = useCallback((measurementId: string) => {
    if (!eraseMode || readOnly || !onAngleMeasurementsChange) return;
    saveToHistory();
    onAngleMeasurementsChange(angleMeasurements.filter(m => m.id !== measurementId));
  }, [eraseMode, readOnly, angleMeasurements, onAngleMeasurementsChange, saveToHistory]);

  /**
   * Handle updating the label offset for an angle measurement.
   */
  const handleAngleLabelOffsetChange = useCallback((measurementId: string, offset: { x: number; y: number }) => {
    if (readOnly || !onAngleMeasurementsChange) return;
    onAngleMeasurementsChange(angleMeasurements.map(m => 
      m.id === measurementId ? { ...m, labelOffset: offset } : m
    ));
  }, [readOnly, angleMeasurements, onAngleMeasurementsChange]);

  /**
   * Undo the last action.
   */
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    // Exit drag mode on undo
    setActiveDragPointId(null);
    
    // Save current state to redo stack
    const currentState: HistoryState = {
      points: [...studentPoints],
      segments: [...segments],
      drawnPaths: [...drawnPaths],
      angleMeasurements: [...angleMeasurements],
    };
    setRedoStack(prev => [...prev, currentState]);
    
    // Pop from undo stack and apply
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    
    onPointsChange(previousState.points);
    onSegmentsChange(previousState.segments);
    onDrawnPathsChange?.(previousState.drawnPaths);
    onAngleMeasurementsChange?.(previousState.angleMeasurements);
  }, [undoStack, studentPoints, segments, drawnPaths, angleMeasurements, onPointsChange, onSegmentsChange, onDrawnPathsChange, onAngleMeasurementsChange]);

  /**
   * Redo the last undone action.
   */
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    // Exit drag mode on redo
    setActiveDragPointId(null);
    
    // Save current state to undo stack
    const currentState: HistoryState = {
      points: [...studentPoints],
      segments: [...segments],
      drawnPaths: [...drawnPaths],
      angleMeasurements: [...angleMeasurements],
    };
    setUndoStack(prev => [...prev, currentState]);
    
    // Pop from redo stack and apply
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    
    onPointsChange(nextState.points);
    onSegmentsChange(nextState.segments);
    onDrawnPathsChange?.(nextState.drawnPaths);
    onAngleMeasurementsChange?.(nextState.angleMeasurements);
  }, [redoStack, studentPoints, segments, drawnPaths, angleMeasurements, onPointsChange, onSegmentsChange, onDrawnPathsChange, onAngleMeasurementsChange]);

  /**
   * Handle pointer down on an existing point.
   * - Double-tap: toggle drag mode for that point
   * - In erase mode: delete the point
   * - In join mode: select for segment creation
   */
  const handlePointClick = useCallback((point: GraphPoint, e: React.PointerEvent | React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    
    // Mark that this pointer event started on a point
    pointerStartedOnPointRef.current = true;

    // If erase mode is active, delete the point
    if (eraseMode) {
      saveToHistory();
      // Remove the point
      onPointsChange(studentPoints.filter(p => p.id !== point.id));
      // Also remove any segments that reference this point
      const newSegments = segments.filter(s => 
        !(s.from.x === point.x && s.from.y === point.y) &&
        !(s.to.x === point.x && s.to.y === point.y)
      );
      if (newSegments.length !== segments.length) {
        onSegmentsChange(newSegments);
      }
      return;
    }

    const now = Date.now();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    const lastTap = lastTapRef.current;
    
    // Check if this is a double-tap on the same point
    const timeDiff = now - lastTap.time;
    const isSamePoint = lastTap.pointId === point.id;
    const distanceMoved = Math.sqrt(
      Math.pow(clientX - lastTap.x, 2) + Math.pow(clientY - lastTap.y, 2)
    );
    const isDoubleTap = isSamePoint && timeDiff < DOUBLE_TAP_THRESHOLD && distanceMoved < DOUBLE_TAP_DISTANCE;
    
    // Debug logging for double-tap detection
    console.debug('[Point Tap]', {
      pointId: point.id,
      timeDiff,
      distanceMoved: distanceMoved.toFixed(1),
      isSamePoint,
      isDoubleTap,
      threshold: DOUBLE_TAP_THRESHOLD,
      maxDistance: DOUBLE_TAP_DISTANCE,
      activeDragPointId: activeDragPointIdRef.current,
    });

    // Update last tap reference
    lastTapRef.current = { pointId: point.id || null, time: now, x: clientX, y: clientY };

    if (!isJoinModeActive && !isAngleMode) {
      // Not in active join/angle mode
      
      // Check if this point is currently in drag mode (use ref for immediate value)
      const currentDragId = activeDragPointIdRef.current;
      const isThisPointInDragMode = currentDragId === point.id;
      
      if (isDoubleTap) {
        // Double-tap: toggle drag mode for this point
        console.debug('[Double-tap detected]', { pointId: point.id, wasInDragMode: isThisPointInDragMode });
        if (isThisPointInDragMode) {
          // Already in drag mode for this point - exit drag mode
          setActiveDragPointId(null);
        } else {
          // Enter drag mode for this point
          setActiveDragPointId(point.id || null);
        }
        lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
        return;
      }
      
      // Single tap behavior:
      // If this point is in drag mode, a single tap exits drag mode
      if (isThisPointInDragMode) {
        console.debug('[Single-tap exit drag mode]', { pointId: point.id });
        setActiveDragPointId(null);
        return;
      }
      
      // Single tap on other points does nothing (no accidental removal)
      return;
    }

    // ===== JOIN MODE ENABLED: Use single-tap for immediate selection =====
    const isAlreadySelected = isPointSelected(point);

    if (isAlreadySelected) {
      // Single-tap on already selected point: DESELECT
      setSelectedJoinPoints([]);
      return;
    }

    if (selectedJoinPoints.length === 1) {
      // One point already selected, single-tap on different point: CREATE SEGMENT
      const fromPoint = selectedJoinPoints[0];
      const toPoint = point;
      
      // Check if segment already exists (in either direction)
      const segmentExists = segments.some(s => 
        (s.from.x === fromPoint.x && s.from.y === fromPoint.y && s.to.x === toPoint.x && s.to.y === toPoint.y) ||
        (s.from.x === toPoint.x && s.from.y === toPoint.y && s.to.x === fromPoint.x && s.to.y === fromPoint.y)
      );

      if (!segmentExists && currentJoinMode && currentJoinMode !== 'freeform') {
        saveToHistory();
        // Calculate default control point for curved segments
        let controlPoint: GraphPoint | undefined;
        if ((currentJoinMode as string) === 'curved') {
          const midX = (fromPoint.x + toPoint.x) / 2;
          const midY = (fromPoint.y + toPoint.y) / 2;
          const dx = toPoint.x - fromPoint.x;
          const dy = toPoint.y - fromPoint.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const bulge = length * 0.2;
          const perpX = length > 0 ? -dy / length * bulge : 0;
          const perpY = length > 0 ? dx / length * bulge : 0;
          controlPoint = { x: midX + perpX, y: midY + perpY };
        }
        // Include point IDs in the segment for reliable vertex matching
        const newSegment: LineSegment = {
          id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from: { id: fromPoint.id, x: fromPoint.x, y: fromPoint.y },
          to: { id: toPoint.id, x: toPoint.x, y: toPoint.y },
          mode: currentJoinMode as 'straight' | 'curved',
          controlPoint,
        };
        const updatedSegments = [...segments, newSegment];
        console.debug('[Segment Created]', {
          from: newSegment.from,
          to: newSegment.to,
          mode: newSegment.mode,
          pointsCount: studentPoints.length,
          segmentsCount: updatedSegments.length,
          axisScalesAvailable: !!axisScales.x && !!axisScales.y,
        });
        onSegmentsChange(updatedSegments);
      }

      // Clear selection after creating segment
      setSelectedJoinPoints([]);
      lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
      return;
    }

    // No point selected yet: SELECT this point immediately
    setSelectedJoinPoints([point]);
  }, [readOnly, isJoinModeActive, isAngleMode, selectedJoinPoints, isPointSelected, studentPoints, segments, currentJoinMode, onPointsChange, onSegmentsChange, axisScales, eraseMode, activeDragPointId, saveToHistory]);

  /**
   * Add a new point to the graph.
   */
  const addPoint = useCallback((x: number, y: number, bypassSnap = false) => {
    if (readOnly) return;
    
    const maxPoints = config.maxPoints ?? 20;
    if (studentPoints.length >= maxPoints) return;

    const finalCoord = bypassSnap 
      ? { x: roundCoord(x), y: roundCoord(y) }
      : snapPoint(x, y);
    
    // Check if point already exists at this location
    const exists = studentPoints.some(p => 
      Math.abs(p.x - finalCoord.x) < 0.0001 && Math.abs(p.y - finalCoord.y) < 0.0001
    );
    if (exists) return;

    // Save to history and add point with stable ID
    saveToHistory();
    const newPoint: GraphPoint = {
      id: generatePointId(),
      x: finalCoord.x,
      y: finalCoord.y,
    };
    onPointsChange([...studentPoints, newPoint]);
  }, [readOnly, config.maxPoints, studentPoints, snapPoint, roundCoord, onPointsChange, saveToHistory]);

  /**
   * Remove a point by index.
   */
  const removePoint = useCallback((index: number) => {
    if (readOnly) return;
    
    const pointToRemove = studentPoints[index];
    
    // Save to history
    saveToHistory();
    
    // Remove the point
    const newPoints = studentPoints.filter((_, i) => i !== index);
    onPointsChange(newPoints);

    // Also remove any segments that reference this point
    const newSegments = segments.filter(s => 
      !(s.from.x === pointToRemove.x && s.from.y === pointToRemove.y) &&
      !(s.to.x === pointToRemove.x && s.to.y === pointToRemove.y)
    );
    if (newSegments.length !== segments.length) {
      onSegmentsChange(newSegments);
    }

    // Clear selection if this point was selected
    setSelectedJoinPoints(prev => prev.filter(p => p.id !== pointToRemove.id));
    
    // Clear drag mode if this was the active drag point
    if (activeDragPointId === pointToRemove.id) {
      setActiveDragPointId(null);
    }
  }, [readOnly, studentPoints, segments, onPointsChange, onSegmentsChange, activeDragPointId, saveToHistory]);

  /**
   * Remove a segment by id.
   */
  const removeSegment = useCallback((segmentId: string) => {
    if (readOnly) return;
    saveToHistory();
    onSegmentsChange(segments.filter(s => s.id !== segmentId));
  }, [readOnly, segments, onSegmentsChange, saveToHistory]);

  /**
   * Clear all points and segments.
   */
  const clearAll = useCallback(() => {
    if (readOnly) return;
    if (studentPoints.length === 0 && segments.length === 0 && drawnPaths.length === 0 && angleMeasurements.length === 0) return;
    
    saveToHistory();
    onPointsChange([]);
    onSegmentsChange([]);
    onDrawnPathsChange?.([]);
    onAngleMeasurementsChange?.([]);
    setSelectedJoinPoints([]);
    setActiveDragPointId(null);
  }, [readOnly, studentPoints, segments, drawnPaths, angleMeasurements, onPointsChange, onSegmentsChange, onDrawnPathsChange, onAngleMeasurementsChange, saveToHistory]);

  /**
   * Get the status of a point for display (correct, incorrect, etc.)
   */
  const getPointStatus = useCallback((point: GraphPoint): 'correct' | 'incorrect' | 'neutral' => {
    if (!showCorrectAnswers || !markingData?.perPointResults) return 'neutral';
    
    // Use tolerance-based matching to avoid floating point mismatch on reload (Bug 4 fix)
    const result = markingData.perPointResults.find(r => 
      r.studentPoint && 
      Math.abs(r.studentPoint.x - point.x) < 0.01 && 
      Math.abs(r.studentPoint.y - point.y) < 0.01
    );
    
    if (!result) return 'neutral';
    return result.status === 'correct' ? 'correct' : 'incorrect';
  }, [showCorrectAnswers, markingData]);

  /**
   * Get missed expected points (for showing correct answers).
   */
  const missedPoints = useMemo(() => {
    if (!showCorrectAnswers || !markingData?.perPointResults) return [];
    
    return markingData.perPointResults
      .filter(r => r.status === 'missed' && r.expectedPoint)
      .map(r => r.expectedPoint!);
  }, [showCorrectAnswers, markingData]);

  /**
   * Convert data coordinates to pixel coordinates (for hit testing).
   * Uses the same logic as Recharts for consistency.
   */
  const axisScaleOffsets = useMemo(() => {
    if (!axisScales.x || !axisScales.y) return { offsetX: 0, offsetY: 0 };

    // Recharts scale sometimes returns coordinates already including axis offsets,
    // and sometimes returns coordinates relative to the plot area.
    // Compute a stable offset by anchoring the domain edges to the plot edges.
    const expectedLeft = chartMargins.left;
    const expectedRight = chartContainerSize.width - chartMargins.right;
    const expectedTop = chartMargins.top;
    const expectedBottom = chartContainerSize.height - chartMargins.bottom;

    const xAtMin = axisScales.x(domainX[0]);
    const xAtMax = axisScales.x(domainX[1]);
    const yAtMax = axisScales.y(domainY[1]);
    const yAtMin = axisScales.y(domainY[0]);

    const approx = (a: number, b: number, tol = 2) => Math.abs(a - b) <= tol;

    const offsetX = approx(xAtMin, expectedLeft) || approx(xAtMax, expectedRight)
      ? 0
      : expectedLeft - xAtMin;

    const offsetY = approx(yAtMax, expectedTop) || approx(yAtMin, expectedBottom)
      ? 0
      : expectedTop - yAtMax;

    return { offsetX, offsetY };
  }, [axisScales, chartMargins, chartContainerSize, domainX, domainY]);

  const dataToPixel = useCallback((dataX: number, dataY: number): { px: number; py: number } => {
    const plotWidth = chartContainerSize.width - chartMargins.left - chartMargins.right;
    const plotHeight = chartContainerSize.height - chartMargins.top - chartMargins.bottom;
    
    // Use axis scales if available (most accurate)
    if (axisScales.x && axisScales.y) {
      const px = axisScales.x(dataX) + axisScaleOffsets.offsetX;
      const py = axisScales.y(dataY) + axisScaleOffsets.offsetY;
      return { px, py };
    }
    
    // Fallback: manual calculation
    const px = chartMargins.left + ((dataX - domainX[0]) / (domainX[1] - domainX[0])) * plotWidth;
    const py = chartMargins.top + (1 - (dataY - domainY[0]) / (domainY[1] - domainY[0])) * plotHeight;
    return { px, py };
  }, [chartContainerSize, chartMargins, axisScales, axisScaleOffsets, domainX, domainY]);

  /**
   * Convert pixel coordinates to data coordinates.
   * Used for drag operations.
   */
  const pixelToData = useCallback((pixelX: number, pixelY: number): { dataX: number; dataY: number } => {
    const plotWidth = chartContainerSize.width - chartMargins.left - chartMargins.right;
    const plotHeight = chartContainerSize.height - chartMargins.top - chartMargins.bottom;
    
    const dataX = domainX[0] + ((pixelX - chartMargins.left) / plotWidth) * (domainX[1] - domainX[0]);
    const dataY = domainY[0] + (1 - (pixelY - chartMargins.top) / plotHeight) * (domainY[1] - domainY[0]);
    
    return { dataX, dataY };
  }, [chartContainerSize, chartMargins, domainX, domainY]);

  /**
   * Find the nearest point within a given pixel radius.
   * Uses Recharts coordinate conversion.
   */
  const findNearestPoint = useCallback((pixelX: number, pixelY: number, maxRadius: number): GraphPoint | null => {
    let nearest: GraphPoint | null = null;
    let nearestDistance = maxRadius;

    for (const point of studentPoints) {
      const { px, py } = dataToPixel(point.x, point.y);
      const distance = Math.sqrt(Math.pow(pixelX - px, 2) + Math.pow(pixelY - py, 2));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = point;
      }
    }

    return nearest;
  }, [studentPoints, dataToPixel]);

  /**
   * Find the nearest point using camera-based coordinate conversion.
   * Takes a screenToGraph function from the camera renderer.
   */
  const findNearestPointCamera = useCallback((
    pixelX: number, 
    pixelY: number, 
    maxRadius: number,
    screenToGraph: (x: number, y: number) => { x: number; y: number },
    graphToScreen: (x: number, y: number) => { x: number; y: number }
  ): GraphPoint | null => {
    let nearest: GraphPoint | null = null;
    let nearestDistance = maxRadius;

    for (const point of studentPoints) {
      const screen = graphToScreen(point.x, point.y);
      const distance = Math.sqrt(Math.pow(pixelX - screen.x, 2) + Math.pow(pixelY - screen.y, 2));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = point;
      }
    }

    return nearest;
  }, [studentPoints]);

  /**
   * Handle pointer down on a point - start potential drag
   */
  const handlePointPointerDown = useCallback((point: GraphPoint, e: React.PointerEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    
    // Mark that pointer started on a point
    pointerStartedOnPointRef.current = true;
    
    // Use ref for current value (avoids stale closure)
    const currentDragPointId = activeDragPointIdRef.current;
    
    // Only allow dragging if this point is in drag mode (by ID)
    if (currentDragPointId && currentDragPointId === point.id) {
      // Set up for drag - store the pointer ID for filtering events
      dragStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      
      // Capture pointer for drag tracking
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }, [readOnly]); // Remove activeDragPointId from deps - use ref instead

  /**
   * Handle pointer move during drag.
   * Uses activeDragPointId to find the point and update position.
   */
  const handlePointPointerMove = useCallback((e: React.PointerEvent) => {
    // Cancel long-press if finger moved too far
    if (longPressTouchStartRef.current) {
      const dx = e.clientX - longPressTouchStartRef.current.x;
      const dy = e.clientY - longPressTouchStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_CANCEL) {
        clearLongPress();
      }
    }

    // Only process drag if we have an active drag start and correct pointer
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;
    const currentDragPointId = activeDragPointIdRef.current;
    if (readOnly || !currentDragPointId) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Start drag if threshold exceeded
    if (!isDraggingRef.current && distance >= DRAG_THRESHOLD) {
      isDraggingRef.current = true;
      setDraggingPointId(currentDragPointId);
      saveToHistory();
    }
    
    if (isDraggingRef.current) {
      const rect = chartContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const pixelX = e.clientX - rect.left;
      const pixelY = e.clientY - rect.top;
      
      let dataX: number, dataY: number;
      if (screenToGraphRef.current) {
        const coords = screenToGraphRef.current(pixelX, pixelY);
        dataX = coords.x;
        dataY = coords.y;
      } else {
        const coords = pixelToData(pixelX, pixelY);
        dataX = coords.dataX;
        dataY = coords.dataY;
      }
      
      const snapped = snapPoint(dataX, dataY);
      setDraggingPosition(snapped);
    }
  }, [readOnly, pixelToData, snapPoint, saveToHistory, clearLongPress]);

  /**
   * Handle pointer up - end drag or trigger click.
   */
  const handlePointPointerUp = useCallback((point: GraphPoint, e: React.PointerEvent) => {
    if (readOnly) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    // Release pointer capture
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture wasn't set
    }
    
    if (isDraggingRef.current && draggingPointId && draggingPosition) {
      // End drag - commit the new position
      const newPoints = studentPoints.map(p => {
        if (p.id === draggingPointId) {
          return { ...p, x: draggingPosition.x, y: draggingPosition.y };
        }
        return p;
      });
      
      // Find the original point to update segments
      const originalPoint = studentPoints.find(p => p.id === draggingPointId);
      
      // Update segments that reference this point
      const newSegments = segments.map(seg => {
        let updated = { ...seg };
        if (originalPoint) {
          if (seg.from.x === originalPoint.x && seg.from.y === originalPoint.y) {
            updated.from = { ...updated.from, x: draggingPosition.x, y: draggingPosition.y };
          }
          if (seg.to.x === originalPoint.x && seg.to.y === originalPoint.y) {
            updated.to = { ...updated.to, x: draggingPosition.x, y: draggingPosition.y };
          }
        }
        return updated;
      });
      
      onPointsChange(newPoints);
      
      const segmentsChanged = newSegments.some((seg, i) => 
        seg.from.x !== segments[i].from.x || seg.from.y !== segments[i].from.y ||
        seg.to.x !== segments[i].to.x || seg.to.y !== segments[i].to.y
      );
      
      if (segmentsChanged) {
        onSegmentsChange(newSegments);
        
        // Recalculate angles for any affected measurements
        if (angleMeasurements.length > 0 && onAngleMeasurementsChange) {
          const updatedMeasurements = angleMeasurements.map(m => {
            const seg1 = newSegments.find(s => s.id === m.segmentId1);
            const seg2 = newSegments.find(s => s.id === m.segmentId2);
            if (seg1 && seg2) {
              const result = computeAngleBetweenSegments(seg1, seg2);
              if (result) {
                return { ...m, angleDegrees: result.angle };
              }
            }
            return m;
          });
          onAngleMeasurementsChange(updatedMeasurements);
        }
      }
      
      // Update the active drag point ID (it stays the same, just position changed)
      // The point still has the same ID
      
      setDraggingPointId(null);
      setDraggingPosition(null);
      isDraggingRef.current = false;
      dragStartRef.current = null;
      
      // Keep guard ref set to prevent container from processing this
      return;
    }
    
    // Not a drag - treat as click
    isDraggingRef.current = false;
    dragStartRef.current = null;
    setDraggingPointId(null);
    setDraggingPosition(null);
    
    // Call original click handler
    handlePointClick(point, e);
  }, [readOnly, draggingPointId, draggingPosition, studentPoints, segments, onPointsChange, onSegmentsChange, handlePointClick]);

  /**
   * Container-level pointer down handler for reliable touch interactions.
   * Handles double-tap detection and drag initiation via distance-based hit testing.
   */
  const handleChartContainerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Use distance-based hit testing for all point interactions
    const nearestPoint = findNearestPoint(clickX, clickY, POINT_HIT_RADIUS);
    
    if (!nearestPoint) return; // No point nearby - let pointerUp handle adding points

    // Mark that pointer started on a point
    pointerStartedOnPointRef.current = true;
    e.stopPropagation();
    e.preventDefault();

    // Handle erase mode
    if (eraseMode) {
      // Erase is handled on pointerUp
      return;
    }

    // Handle join/angle modes - selection is handled on pointerUp via handlePointClick
    if (isJoinModeActive || isAngleMode) {
      return;
    }

    // Check for double-tap to activate drag mode
    const now = Date.now();
    const lastTap = lastTapRef.current;
    const timeDiff = now - lastTap.time;
    const isSamePoint = lastTap.pointId === nearestPoint.id;
    const distanceMoved = Math.sqrt(Math.pow(e.clientX - lastTap.x, 2) + Math.pow(e.clientY - lastTap.y, 2));
    const isDoubleTap = isSamePoint && timeDiff < DOUBLE_TAP_THRESHOLD && distanceMoved < DOUBLE_TAP_DISTANCE;

    // Update last tap reference
    lastTapRef.current = { pointId: nearestPoint.id || null, time: now, x: e.clientX, y: e.clientY };

    if (isDoubleTap) {
      // Toggle drag mode for this point
      const currentDragId = activeDragPointIdRef.current;
      if (currentDragId === nearestPoint.id) {
        setActiveDragPointId(null);
      } else {
        setActiveDragPointId(nearestPoint.id || null);
      }
      lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
      return;
    }

    // If this point is in drag mode, start potential drag
    const currentDragPointId = activeDragPointIdRef.current;
    if (currentDragPointId && currentDragPointId === nearestPoint.id) {
      dragStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      // Capture pointer for drag tracking on the container
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [readOnly, eraseMode, isJoinModeActive, isAngleMode, findNearestPoint, POINT_HIT_RADIUS, DOUBLE_TAP_THRESHOLD, DOUBLE_TAP_DISTANCE]);

  const handleChartContainerPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // If a drag started on the container, mirror the same cleanup as the dot hit target.
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    isDraggingRef.current = false;
    dragStartRef.current = null;
    setDraggingPointId(null);
    setDraggingPosition(null);
    pointerStartedOnPointRef.current = false;
  }, []);

  /**
   * Handle pointer up on the chart background to add a point.
   * Only adds points if NOT in "point selection" mode (no points selected for joining).
   * Also clears selection if clicking on empty space (but not if the click started on a point).
   */
  const handleChartContainerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;

    // If we were dragging (or attempted to) the active drag point via container pointer capture,
    // always route this pointerup through the point-up handler.
    const currentDragPointId = activeDragPointIdRef.current;
    if (dragStartRef.current && dragStartRef.current.pointerId === e.pointerId && currentDragPointId) {
      const activePoint = findPointById(currentDragPointId);
      if (activePoint) {
        handlePointPointerUp(activePoint, e);
      }
      pointerStartedOnPointRef.current = false;
      return;
    }
    
    // If the pointer event started on a point, route to handlePointClick for proper handling
    if (pointerStartedOnPointRef.current) {
      pointerStartedOnPointRef.current = false;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const nearestPoint = findNearestPoint(clickX, clickY, POINT_HIT_RADIUS);
      
      if (nearestPoint) {
        // In join mode or angle mode, route through handlePointClick
        if (isJoinModeActive || isAngleMode || eraseMode) {
          handlePointClick(nearestPoint, e);
          return;
        }
        
        // For normal mode, single tap on a point in drag mode exits drag mode
        const currentDragId = activeDragPointIdRef.current;
        if (currentDragId === nearestPoint.id) {
          setActiveDragPointId(null);
        }
      }
      return;
    }
    
    // If the pointer event started on a line segment, don't clear selection (already handled by segment)
    if (pointerStartedOnLineRef.current) {
      pointerStartedOnLineRef.current = false;
      return;
    }
    
    // Clear active drag point when tapping empty space
    if (activeDragPointId) {
      setActiveDragPointId(null);
      // Don't add a new point when exiting drag mode
      return;
    }
    
    // In erase mode, don't add points - just clear selections
    if (eraseMode) {
      // Also support distance-based erase so edge points are reliable on touch devices.
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const nearestPoint = findNearestPoint(clickX, clickY, POINT_HIT_RADIUS);
      if (nearestPoint) {
        handlePointClick(nearestPoint, e);
        pointerStartedOnPointRef.current = false;
        return;
      }

      if (selectedJoinPoints.length > 0) {
        setSelectedJoinPoints([]);
      }
      // In erase mode, we DO want to clear transient segment selection on background tap
      if (selectedSegmentIds.length > 0 && onSelectedSegmentIdsChange) {
        onSelectedSegmentIdsChange([]);
      }
      return;
    }
    
    // In angle mode, clear ONLY transient selection when clicking empty space
    // Persisted measurements stay (they're in angleMeasurements, not selectedSegmentIds)
    if (isAngleMode) {
      if (selectedSegmentIds.length > 0 && onSelectedSegmentIdsChange) {
        onSelectedSegmentIdsChange([]);
      }
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // In join mode, check if click is near any point (distance-based hit testing for edges)
    if (isJoinModeActive) {
      const HIT_RADIUS = 30; // Generous hit radius for touch devices
      const nearestPoint = findNearestPoint(clickX, clickY, HIT_RADIUS);
      
      if (nearestPoint) {
        // Simulate point click using the same logic
        const now = Date.now();
        const lastTap = lastTapRef.current;
        
        // Check for double-tap (for drag mode activation)
        const timeDiff = now - lastTap.time;
        const isSamePoint = lastTap.pointId === nearestPoint.id;
        const distanceMoved = Math.sqrt(Math.pow(e.clientX - lastTap.x, 2) + Math.pow(e.clientY - lastTap.y, 2));
        
        // Update last tap
        lastTapRef.current = { pointId: nearestPoint.id || null, time: now, x: e.clientX, y: e.clientY };
        
        const isAlreadySelected = isPointSelected(nearestPoint);
        
        if (isAlreadySelected) {
          setSelectedJoinPoints([]);
          return;
        }
        
        if (selectedJoinPoints.length === 1) {
          // Create segment
          const fromPoint = selectedJoinPoints[0];
          const toPoint = nearestPoint;
          
          const segmentExists = segments.some(s => 
            (s.from.x === fromPoint.x && s.from.y === fromPoint.y && s.to.x === toPoint.x && s.to.y === toPoint.y) ||
            (s.from.x === toPoint.x && s.from.y === toPoint.y && s.to.x === fromPoint.x && s.to.y === fromPoint.y)
          );
          
          if (!segmentExists && currentJoinMode && currentJoinMode !== 'freeform') {
            saveToHistory();
            const newSegment: LineSegment = {
              id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              from: { x: fromPoint.x, y: fromPoint.y },
              to: { x: toPoint.x, y: toPoint.y },
              mode: currentJoinMode as 'straight' | 'curved',
            };
            console.debug('[Segment Created via distance hit-test]', {
              from: newSegment.from,
              to: newSegment.to,
              mode: newSegment.mode,
            });
            onSegmentsChange([...segments, newSegment]);
          }
          
          setSelectedJoinPoints([]);
          lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
          return;
        }
        
        // Select this point
        setSelectedJoinPoints([nearestPoint]);
        return;
      }
      
      // No point nearby and in join mode - clear selection
      if (selectedJoinPoints.length > 0) {
        setSelectedJoinPoints([]);
      }
      return;
    }
    
    // If we have a point selected and user clicks empty space, clear selection
    if (selectedJoinPoints.length > 0) {
      setSelectedJoinPoints([]);
      return;
    }

    // Convert pixel to data coordinates for adding new point
    const plotWidth = chartContainerSize.width - chartMargins.left - chartMargins.right;
    const plotHeight = chartContainerSize.height - chartMargins.top - chartMargins.bottom;

    // Check if click is within the plot area
    if (clickX < chartMargins.left || clickX > chartContainerSize.width - chartMargins.right ||
        clickY < chartMargins.top || clickY > chartContainerSize.height - chartMargins.bottom) {
      return;
    }

    // CRITICAL: Before adding a new point, check if tap is near any existing point
    // This prevents accidental point creation when trying to tap an existing point
    const nearbyPoint = findNearestPoint(clickX, clickY, POINT_HIT_RADIUS);
    if (nearbyPoint) {
      // Tap is near an existing point - don't add a new point
      // Instead, treat it as if the user tapped that point (activate drag mode on double-tap)
      const now = Date.now();
      const lastTap = lastTapRef.current;
      const timeDiff = now - lastTap.time;
      const isSamePoint = lastTap.pointId === nearbyPoint.id;
      const distanceMoved = Math.sqrt(Math.pow(e.clientX - lastTap.x, 2) + Math.pow(e.clientY - lastTap.y, 2));
      const isDoubleTap = isSamePoint && timeDiff < DOUBLE_TAP_THRESHOLD && distanceMoved < DOUBLE_TAP_DISTANCE;
      
      lastTapRef.current = { pointId: nearbyPoint.id || null, time: now, x: e.clientX, y: e.clientY };
      
      if (isDoubleTap) {
        // Toggle drag mode for this point
        if (activeDragPointId === nearbyPoint.id) {
          setActiveDragPointId(null);
        } else {
          setActiveDragPointId(nearbyPoint.id || null);
        }
        lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
      }
      return; // Don't add a new point
    }

    const dataX = domainX[0] + ((clickX - chartMargins.left) / plotWidth) * (domainX[1] - domainX[0]);
    const dataY = domainY[0] + ((1 - (clickY - chartMargins.top) / plotHeight)) * (domainY[1] - domainY[0]);

    addPoint(dataX, dataY);
  }, [readOnly, selectedJoinPoints, chartContainerSize, chartMargins, domainX, domainY, addPoint, isJoinModeActive, findNearestPoint, isPointSelected, segments, currentJoinMode, onSegmentsChange, activeDragPointId, eraseMode, isAngleMode, selectedSegmentIds, onSelectedSegmentIdsChange, saveToHistory, angleMeasurements, findPointById, handlePointPointerUp, handlePointClick, POINT_HIT_RADIUS]);

  /**
   * Handle segment click in erase mode
   */
  const handleSegmentErase = useCallback((segmentId: string) => {
    if (!eraseMode || readOnly) return;
    saveToHistory();
    onSegmentsChange(segments.filter(s => s.id !== segmentId));
  }, [eraseMode, readOnly, segments, onSegmentsChange, saveToHistory]);

  /**
   * Camera-aware container pointer down handler.
   * Receives screenToGraph from the camera renderer for coordinate conversion.
   */
  const handleCameraContainerPointerDown = useCallback((
    e: React.PointerEvent,
    screenToGraph: (x: number, y: number) => { x: number; y: number }
  ) => {
    if (readOnly) return;
    
    // Palm rejection
    if (e.pointerType === 'touch') {
      if (e.width > 30 || e.height > 30) return;
      activeTouchCountRef.current++;
      if (activeTouchCountRef.current > 1) return;
    }
    
    cameraPointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    screenToGraphRef.current = screenToGraph;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const graphToScreen = (gx: number, gy: number): { x: number; y: number } => {
      const width = rect.width;
      const height = rect.height;
      const topLeft = screenToGraph(0, 0);
      const bottomRight = screenToGraph(width, height);
      const scaleX = width / (bottomRight.x - topLeft.x);
      const scaleY = height / (topLeft.y - bottomRight.y);
      return { x: (gx - topLeft.x) * scaleX, y: (topLeft.y - gy) * scaleY };
    };
    
    const nearestPoint = findNearestPointCamera(clickX, clickY, POINT_HIT_RADIUS, screenToGraph, graphToScreen);
    
    if (!nearestPoint) return;
    
    pointerStartedOnPointRef.current = true;
    e.stopPropagation();
    
    if (eraseMode) return;
    if (isJoinModeActive || isAngleMode) return;
    
    // If this point is already in drag mode, start potential drag immediately
    const currentDragPointId = activeDragPointIdRef.current;
    if (currentDragPointId && currentDragPointId === nearestPoint.id) {
      dragStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      return;
    }
    
    // --- Long-press detection (touch) OR double-tap fallback (mouse) ---
    if (e.pointerType === 'touch') {
      // Start long-press timer
      clearLongPress();
      longPressTouchStartRef.current = { x: e.clientX, y: e.clientY };
      longPressPointIdRef.current = nearestPoint.id || null;
      longPressTimerRef.current = setTimeout(() => {
        // Long press confirmed — enter drag mode
        const pointId = longPressPointIdRef.current;
        if (pointId) {
          setActiveDragPointId(pointId);
          setShowDragHint(false);
          // Haptic feedback
          if (navigator.vibrate) navigator.vibrate(50);
        }
        longPressTimerRef.current = null;
        longPressPointIdRef.current = null;
        longPressTouchStartRef.current = null;
      }, LONG_PRESS_DURATION);
    } else {
      // Mouse/pen: use double-tap detection
      const now = Date.now();
      const lastTap = lastTapRef.current;
      const timeDiff = now - lastTap.time;
      const isSamePoint = lastTap.pointId === nearestPoint.id;
      const distanceMoved = Math.sqrt(Math.pow(e.clientX - lastTap.x, 2) + Math.pow(e.clientY - lastTap.y, 2));
      const isDoubleTap = isSamePoint && timeDiff < DOUBLE_TAP_THRESHOLD && distanceMoved < DOUBLE_TAP_DISTANCE;
      
      lastTapRef.current = { pointId: nearestPoint.id || null, time: now, x: e.clientX, y: e.clientY };
      
      if (isDoubleTap) {
        const currentDragId = activeDragPointIdRef.current;
        if (currentDragId === nearestPoint.id) {
          setActiveDragPointId(null);
        } else {
          setActiveDragPointId(nearestPoint.id || null);
          setShowDragHint(false);
        }
        lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
      }
    }
  }, [readOnly, eraseMode, isJoinModeActive, isAngleMode, findNearestPointCamera, POINT_HIT_RADIUS, DOUBLE_TAP_THRESHOLD, DOUBLE_TAP_DISTANCE, domainX, domainY, clearLongPress]);

  /**
   * Camera-aware container pointer up handler.
   * Handles adding points, selecting for join mode, and other interactions.
   */
  const handleCameraContainerPointerUp = useCallback((
    e: React.PointerEvent,
    screenToGraph: (x: number, y: number) => { x: number; y: number }
  ) => {
    if (readOnly) return;
    
    // Clear long-press timer
    clearLongPress();
    
    // Decrement touch counter
    if (e.pointerType === 'touch') {
      activeTouchCountRef.current = Math.max(0, activeTouchCountRef.current - 1);
    }
    
    // Jitter buffer: check if pointer moved too far to be a clean tap
    const pointerStart = cameraPointerDownRef.current;
    cameraPointerDownRef.current = null;
    const wasCleanTap = pointerStart
      ? (Math.abs(e.clientX - pointerStart.x) <= JITTER_THRESHOLD_PX &&
         Math.abs(e.clientY - pointerStart.y) <= JITTER_THRESHOLD_PX)
      : false;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Create graphToScreen for hit testing
    const width = rect.width;
    const height = rect.height;
    const topLeft = screenToGraph(0, 0);
    const bottomRight = screenToGraph(width, height);
    const graphToScreen = (gx: number, gy: number): { x: number; y: number } => {
      const scaleX = width / (bottomRight.x - topLeft.x);
      const scaleY = height / (topLeft.y - bottomRight.y);
      const screenX = (gx - topLeft.x) * scaleX;
      const screenY = (topLeft.y - gy) * scaleY;
      return { x: screenX, y: screenY };
    };
    
    // If we were dragging, handle drag commit
    const currentDragPointId = activeDragPointIdRef.current;
    if (dragStartRef.current && dragStartRef.current.pointerId === e.pointerId && currentDragPointId) {
      const activePoint = findPointById(currentDragPointId);
      if (activePoint) {
        handlePointPointerUp(activePoint, e);
      }
      pointerStartedOnPointRef.current = false;
      dragStartRef.current = null;
      return;
    }
    
    // If pointer started on a point, handle point click
    if (pointerStartedOnPointRef.current) {
      pointerStartedOnPointRef.current = false;
      
      const nearestPoint = findNearestPointCamera(clickX, clickY, POINT_HIT_RADIUS, screenToGraph, graphToScreen);
      
      if (nearestPoint) {
        if (isJoinModeActive || isAngleMode || eraseMode) {
          handlePointClick(nearestPoint, e);
          return;
        }
        
        // Single tap on a point in drag mode exits drag mode
        const currentDragId = activeDragPointIdRef.current;
        if (currentDragId === nearestPoint.id) {
          setActiveDragPointId(null);
        }
      }
      return;
    }
    
    // If pointer started on a segment, don't process further
    if (pointerStartedOnLineRef.current) {
      pointerStartedOnLineRef.current = false;
      return;
    }
    
    // Clear active drag point when tapping empty space
    if (activeDragPointId) {
      setActiveDragPointId(null);
      return;
    }
    
    // In erase mode, don't add points
    if (eraseMode) {
      const nearestPoint = findNearestPointCamera(clickX, clickY, POINT_HIT_RADIUS, screenToGraph, graphToScreen);
      if (nearestPoint) {
        handlePointClick(nearestPoint, e);
      }
      if (selectedJoinPoints.length > 0) setSelectedJoinPoints([]);
      if (selectedSegmentIds.length > 0 && onSelectedSegmentIdsChange) onSelectedSegmentIdsChange([]);
      return;
    }
    
    // In angle mode, clear transient selection
    if (isAngleMode) {
      if (selectedSegmentIds.length > 0 && onSelectedSegmentIdsChange) onSelectedSegmentIdsChange([]);
      return;
    }
    
    // In join mode, handle point selection for segment creation
    if (isJoinModeActive) {
      const nearestPoint = findNearestPointCamera(clickX, clickY, 30, screenToGraph, graphToScreen);
      
      if (nearestPoint) {
        if (isPointSelected(nearestPoint)) {
          setSelectedJoinPoints([]);
          return;
        }
        
        if (selectedJoinPoints.length === 1) {
          const fromPoint = selectedJoinPoints[0];
          const toPoint = nearestPoint;
          
          const segmentExists = segments.some(s => 
            (s.from.x === fromPoint.x && s.from.y === fromPoint.y && s.to.x === toPoint.x && s.to.y === toPoint.y) ||
            (s.from.x === toPoint.x && s.from.y === toPoint.y && s.to.x === fromPoint.x && s.to.y === fromPoint.y)
          );
          
          if (!segmentExists && currentJoinMode && currentJoinMode !== 'freeform') {
            saveToHistory();
            const newSegment: LineSegment = {
              id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              from: { x: fromPoint.x, y: fromPoint.y },
              to: { x: toPoint.x, y: toPoint.y },
              mode: currentJoinMode as 'straight' | 'curved',
            };
            onSegmentsChange([...segments, newSegment]);
          }
          
          setSelectedJoinPoints([]);
          return;
        }
        
        setSelectedJoinPoints([nearestPoint]);
        return;
      }
      
      if (selectedJoinPoints.length > 0) setSelectedJoinPoints([]);
      return;
    }
    
    // If we have a point selected, clear selection
    if (selectedJoinPoints.length > 0) {
      setSelectedJoinPoints([]);
      return;
    }
    
    // Check if tap is near an existing point
    const nearbyPoint = findNearestPointCamera(clickX, clickY, POINT_HIT_RADIUS, screenToGraph, graphToScreen);
    if (nearbyPoint) {
      // For mouse: handle double-tap for drag mode (touch uses long-press instead)
      if (e.pointerType !== 'touch') {
        const now = Date.now();
        const lastTap = lastTapRef.current;
        const timeDiff = now - lastTap.time;
        const isSamePoint = lastTap.pointId === nearbyPoint.id;
        const distanceMoved = Math.sqrt(Math.pow(e.clientX - lastTap.x, 2) + Math.pow(e.clientY - lastTap.y, 2));
        const isDoubleTap = isSamePoint && timeDiff < DOUBLE_TAP_THRESHOLD && distanceMoved < DOUBLE_TAP_DISTANCE;
        
        lastTapRef.current = { pointId: nearbyPoint.id || null, time: now, x: e.clientX, y: e.clientY };
        
        if (isDoubleTap) {
          if (activeDragPointId === nearbyPoint.id) {
            setActiveDragPointId(null);
          } else {
            setActiveDragPointId(nearbyPoint.id || null);
            setShowDragHint(false);
          }
          lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
        }
      }
      return;
    }
    
    // Add a new point at the tap location - ONLY if it was a clean tap (jitter buffer)
    if (!wasCleanTap) return; // Pointer moved too far - this was a drag, not a tap
    
    const graphCoords = screenToGraph(clickX, clickY);
    
    addPoint(graphCoords.x, graphCoords.y);
  }, [
    readOnly, selectedJoinPoints, domainX, domainY, addPoint, isJoinModeActive, 
    findNearestPointCamera, isPointSelected, segments, currentJoinMode, onSegmentsChange, 
    activeDragPointId, eraseMode, isAngleMode, selectedSegmentIds, onSelectedSegmentIdsChange, 
    saveToHistory, findPointById, handlePointPointerUp, handlePointClick, POINT_HIT_RADIUS,
    DOUBLE_TAP_THRESHOLD, DOUBLE_TAP_DISTANCE
  ]);

  /**
   * Custom dot renderer for points.
   * Supports dragging for repositioning with live tooltip.
   */
  const renderDot = useCallback((props: any) => {
    const { cx, cy, payload } = props;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;

    const point = payload as GraphPoint;
    const status = getPointStatus(point);
    const isSelected = isPointSelected(point);
    
    // Check if this point is being dragged (by ID)
    const isDragging = draggingPointId === point.id;
    
    // Check if this point is in drag mode (active for dragging, by ID)
    const isInDragMode = activeDragPointId === point.id;
    
    // If dragging, use the dragged position for display
    let displayCx = cx;
    let displayCy = cy;
    if (isDragging && draggingPosition) {
      const { px, py } = dataToPixel(draggingPosition.x, draggingPosition.y);
      displayCx = px;
      displayCy = py;
    }
    
    // Determine fill color based on status
    let fillColor = subjectColor;
    if (showCorrectAnswers) {
      if (status === 'correct') fillColor = 'hsl(var(--success, 142 76% 36%))';
      else if (status === 'incorrect') fillColor = 'hsl(var(--destructive))';
    }

    // Use the constant HIT_RADIUS for touch targets (44px for iPad-friendly tapping)
    const visualRadius = isSelected || isDragging || isInDragMode ? 10 : 8;

    // Hit radius for point interaction:
    // - Active drag point gets large hit target for reliable dragging
    // - All points get a reasonable hit target centered on the point for mouse users
    // The key fix: ensure the hit circle is large enough AND centered properly
    const hitRadius = isInDragMode ? Math.max(POINT_HIT_RADIUS, 48) : Math.max(visualRadius + 12, 24);
    
    return (
      <g 
        key={`point-${point.id || `${point.x}-${point.y}`}`}
        style={{ 
          cursor: readOnly ? 'default' : eraseMode ? 'pointer' : isDragging ? 'grabbing' : isInDragMode ? 'grab' : 'pointer', 
          touchAction: 'none',
          // Prevent text selection on the SVG group
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        pointerEvents="all"
      >
        {/* Invisible hit target - centered on point for reliable mouse double-click */}
        <circle
          cx={displayCx}
          cy={displayCy}
          r={hitRadius}
          // iOS Safari can be flaky with fully transparent SVG hit targets; use near-transparent paint.
          fill="hsl(var(--foreground))"
          fillOpacity={0.001}
          stroke="none"
          pointerEvents="all"
          style={{ 
            touchAction: 'none', 
            cursor: isInDragMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
            // Ensure no text selection interference
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onPointerDown={(e) => handlePointPointerDown(point, e)}
          onPointerMove={handlePointPointerMove}
          onPointerUp={(e) => handlePointPointerUp(point, e)}
          onPointerCancel={(e) => {
            // Handle cancel (e.g., finger left screen) - reset drag state
            try {
              (e.target as Element).releasePointerCapture(e.pointerId);
            } catch {}
            isDraggingRef.current = false;
            dragStartRef.current = null;
            setDraggingPointId(null);
            setDraggingPosition(null);
            pointerStartedOnPointRef.current = false;
          }}
        />
        
        {/* Drag mode indicator ring (pulsing halo when point is in drag mode) */}
        {isInDragMode && !isDragging && (
          <circle
            cx={displayCx}
            cy={displayCy}
            r={visualRadius + 8}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            opacity={0.6}
            className="animate-pulse"
          />
        )}
        
        {/* Drag indicator ring when actively dragging */}
        {isDragging && (
          <circle
            cx={displayCx}
            cy={displayCy}
            r={visualRadius + 6}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            opacity={0.5}
          />
        )}
        
        {/* Selection ring (for join mode) */}
        {isSelected && !isDragging && !isInDragMode && (
          <circle
            cx={displayCx}
            cy={displayCy}
            r={visualRadius + 4}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}
        
        {/* Visible point */}
        <circle
          cx={displayCx}
          cy={displayCy}
          r={visualRadius}
          fill={isDragging || isInDragMode ? 'hsl(var(--primary))' : fillColor}
          stroke="white"
          strokeWidth={2}
        />
        
        {/* Tooltip on hover */}
        <title>{`(${formatCoord(point.x)}, ${formatCoord(point.y)})`}</title>
      </g>
    );
  }, [subjectColor, showCorrectAnswers, getPointStatus, isPointSelected, readOnly, 
      handlePointPointerDown, handlePointPointerMove, handlePointPointerUp, 
      draggingPointId, draggingPosition, dataToPixel, activeDragPointId, eraseMode]);

  // Get the active drag point for display
  const activeDragPoint = findPointById(activeDragPointId);

  // Error state if no config
  if (!config) {
    return (
      <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
        <p className="text-destructive">Error: No graph configuration provided</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Undo/Redo/Clear buttons */}
          <Button
            variant="outline"
            size="icon"
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={clearAll}
            disabled={studentPoints.length === 0 && segments.length === 0 && drawnPaths.length === 0}
            title="Clear all"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          {/* Erase tool */}
          <Button
            variant={eraseMode ? "default" : "outline"}
            size="icon"
            onClick={() => {
              setEraseMode(!eraseMode);
              // Exit drag mode when entering erase mode
              setActiveDragPointId(null);
            }}
            title={eraseMode ? "Exit erase mode" : "Erase mode"}
            className={eraseMode ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            <Eraser className="h-4 w-4" />
          </Button>
          
          {/* Expand button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsExpanded(true)}
            title="Expand graph"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          {/* Join mode toggle */}
          {isJoinModeEnabled && onJoinModeChange && (
            <ToggleGroup
              type="single"
              value={currentJoinMode || ''}
              onValueChange={(value) => {
                // Exit drag mode when changing tools
                setActiveDragPointId(null);
                
                // If user clicks the already-selected mode, toggle it OFF (set to null)
                if (value === '' || value === currentJoinMode) {
                  onJoinModeChange(null);
                  setSelectedJoinPoints([]);
                  // Clear segment selection when exiting angle mode
                  if (onSelectedSegmentIdsChange) {
                    onSelectedSegmentIdsChange([]);
                  }
                } else if (value === 'straight' || value === 'curved' || value === 'freeform' || value === 'angle') {
                  onJoinModeChange(value);
                  setSelectedJoinPoints([]);
                  // Clear segment selection when switching modes
                  if (onSelectedSegmentIdsChange) {
                    onSelectedSegmentIdsChange([]);
                  }
                  // Exit erase mode when entering a drawing mode
                  setEraseMode(false);
                }
              }}
              className="ml-auto flex-wrap"
            >
              <ToggleGroupItem value="straight" aria-label="Straight lines" disabled={isAngleMode}>
                <Minus className="h-4 w-4 mr-1" />
                Straight
              </ToggleGroupItem>
              <ToggleGroupItem value="curved" aria-label="Curved lines" disabled={isAngleMode}>
                <Spline className="h-4 w-4 mr-1" />
                Curved
              </ToggleGroupItem>
              <ToggleGroupItem value="freeform" aria-label="Freeform drawing" disabled={isAngleMode}>
                <Pencil className="h-4 w-4 mr-1" />
                Freeform
              </ToggleGroupItem>
              <ToggleGroupItem value="angle" aria-label="Angle measurement">
                <Ruler className="h-4 w-4 mr-1" />
                Angle
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          
          {/* Auto/Manual curve mode switch toggle - centered above Curved tool */}
          {currentJoinMode === 'curved' && !readOnly && (
            <div className="flex items-center gap-2 ml-2">
              <span className={cn(
                "text-xs font-medium transition-colors",
                curveMode === 'auto' ? "text-foreground" : "text-muted-foreground"
              )}>Auto</span>
              <Switch
                checked={curveMode === 'manual'}
                onCheckedChange={(checked) => {
                  const newMode = checked ? 'manual' : 'auto';
                  if (newMode === 'manual') {
                    // Freeze auto-generated control points into segments
                    saveToHistory();
                    const updatedSegments = segments.map(seg => {
                      if (seg.mode === 'curved' && !seg.controlPoint) {
                        const midX = (seg.from.x + seg.to.x) / 2;
                        const midY = (seg.from.y + seg.to.y) / 2;
                        const dx = seg.to.x - seg.from.x;
                        const dy = seg.to.y - seg.from.y;
                        const length = Math.sqrt(dx * dx + dy * dy);
                        const bulge = length * 0.2;
                        const perpX = length > 0 ? -dy / length * bulge : 0;
                        const perpY = length > 0 ? dx / length * bulge : 0;
                        return { ...seg, controlPoint: { x: midX + perpX, y: midY + perpY } };
                      }
                      return seg;
                    });
                    onSegmentsChange(updatedSegments);
                  }
                  setCurveMode(newMode);
                }}
              />
              <span className={cn(
                "text-xs font-medium transition-colors",
                curveMode === 'manual' ? "text-foreground" : "text-muted-foreground"
              )}>Manual</span>
            </div>
          )}
        </div>
      )}

      {/* Helper text */}
      {!readOnly && (
        <p className="text-sm text-muted-foreground">
          {eraseMode ? (
            'Tap a point, line, or angle label to delete it. Tap the eraser icon again to exit.'
          ) : activeDragPoint ? (
            `Drag mode active for (${formatCoord(activeDragPoint.x)}, ${formatCoord(activeDragPoint.y)}). Drag to move, tap the point or empty space to exit.`
          ) : isAngleMode ? (
            selectedSegmentIds.length === 0 ? (
              angleMeasurements.length > 0
                ? `${angleMeasurements.length} angle(s) saved. Tap two connected lines to add another.`
                : 'Tap two connected lines to measure the angle between them.'
            ) : selectedSegmentIds.length === 1 ? (
              'Tap another connected line to complete the measurement.'
            ) : (
              'Angle saved! Tap another pair of lines to add more.'
            )
          ) : isJoinModeActive ? (
            currentJoinMode === 'freeform' ? (
              'Click and drag on the graph to draw lines.'
            ) : selectedJoinPoints.length === 0 ? (
              `Tap a point to select it for joining. Deselect the mode to add points.`
            ) : selectedJoinPoints.length === 1 ? (
              `Point (${formatCoord(selectedJoinPoints[0].x)}, ${formatCoord(selectedJoinPoints[0].y)}) selected. Tap another point to connect.`
            ) : (
              'Creating segment...'
            )
          ) : (
            'Tap to plot points. Hold a point to drag it.'
          )}
        </p>
      )}

      {/* Camera-based graph renderer with pan/zoom support */}
      <div 
        ref={chartContainerRef}
        className="relative w-full aspect-square border rounded-lg bg-card select-none"
        style={{ 
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        {chartContainerSize.width > 0 && chartContainerSize.height > 0 && (
          <GraphCanvasPlot
            key={`canvas-${questionId}`}
            width={chartContainerSize.width}
            height={chartContainerSize.height}
            config={config}
            domainX={domainX}
            domainY={domainY}
            studentPoints={studentPoints}
            segments={segments}
            drawnPaths={drawnPaths}
            joinMode={joinMode}
            referenceSeries={referenceSeries}
            expectedCurveSeries={expectedCurveSeries}
            markingData={markingData}
            subjectColor={subjectColor}
            readOnly={readOnly}
            showCorrectAnswers={showCorrectAnswers}
            panZoomEnabled={true}
            eraseMode={eraseMode}
            angleMeasurements={angleMeasurements}
            selectedSegmentIds={selectedSegmentIds}
            activeDragPointId={activeDragPointId}
            draggingPointId={draggingPointId}
            draggingPosition={draggingPosition}
            selectedJoinPoints={selectedJoinPoints}
            curveMode={curveMode}
            onCurveModeChange={setCurveMode}
            onSegmentsChange={onSegmentsChange}
            onPointPointerDown={handlePointPointerDown}
            onPointPointerMove={handlePointPointerMove}
            onPointPointerUp={handlePointPointerUp}
            onContainerPointerDown={handleCameraContainerPointerDown}
            onContainerPointerMove={handlePointPointerMove}
            onContainerPointerUp={handleCameraContainerPointerUp}
            onContainerPointerCancel={handleChartContainerPointerCancel}
            onDrawnPathsChange={onDrawnPathsChange}
            onSegmentClick={eraseMode ? handleSegmentErase : isAngleMode ? handleAngleSegmentSelect : undefined}
            cursor={readOnly ? 'default' : eraseMode ? 'pointer' : 'crosshair'}
          />
        )}
      </div>

      {/* Segments list */}
      {segments.length > 0 && !readOnly && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="text-sm font-medium mb-2">Line segments ({segments.length})</div>
          <div className="flex flex-wrap gap-2">
            {segments.map((seg) => (
              <div 
                key={seg.id}
                className="flex items-center gap-1 bg-background px-2 py-1 rounded text-sm border"
              >
                <span>
                  ({formatCoord(seg.from.x)}, {formatCoord(seg.from.y)}) → ({formatCoord(seg.to.x)}, {formatCoord(seg.to.y)})
                </span>
                <span className="text-muted-foreground text-xs">
                  [{seg.mode}]
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-1"
                  onClick={() => removeSegment(seg.id)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawn paths list */}
      {drawnPaths.length > 0 && !readOnly && onDrawnPathsChange && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="text-sm font-medium mb-2">Drawn lines ({drawnPaths.length})</div>
          <div className="flex flex-wrap gap-2">
            {drawnPaths.map((path, idx) => (
              <div 
                key={path.id}
                className="flex items-center gap-1 bg-background px-2 py-1 rounded text-sm border"
              >
                <span>Path {idx + 1}</span>
                <span className="text-muted-foreground text-xs">
                  ({(path.dataPoints?.length ?? path.points?.length ?? 0)} pts)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-1"
                  onClick={() => onDrawnPathsChange(drawnPaths.filter(p => p.id !== path.id))}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points table with manual coordinate entry */}
      <div className="border rounded-lg p-3 bg-muted/30">
        <div className="text-sm font-medium mb-2">Plotted points ({studentPoints.length})</div>
        
        {/* Manual coordinate entry */}
        {!readOnly && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">(</span>
            <Input
              type="number"
              step="any"
              placeholder="x"
              value={manualX}
              onChange={(e) => setManualX(e.target.value)}
              className="w-20 h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const x = parseFloat(manualX);
                  const y = parseFloat(manualY);
                  if (!isNaN(x) && !isNaN(y)) {
                    addPoint(x, y, true);
                    setManualX('');
                    setManualY('');
                  }
                }
              }}
            />
            <span className="text-sm text-muted-foreground">,</span>
            <Input
              type="number"
              step="any"
              placeholder="y"
              value={manualY}
              onChange={(e) => setManualY(e.target.value)}
              className="w-20 h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const x = parseFloat(manualX);
                  const y = parseFloat(manualY);
                  if (!isNaN(x) && !isNaN(y)) {
                    addPoint(x, y, true);
                    setManualX('');
                    setManualY('');
                  }
                }
              }}
            />
            <span className="text-sm text-muted-foreground">)</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                const x = parseFloat(manualX);
                const y = parseFloat(manualY);
                if (!isNaN(x) && !isNaN(y)) {
                  addPoint(x, y, true);
                  setManualX('');
                  setManualY('');
                }
              }}
              disabled={isNaN(parseFloat(manualX)) || isNaN(parseFloat(manualY))}
            >
              Add
            </Button>
          </div>
        )}

        {studentPoints.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {studentPoints.map((point, idx) => {
              const status = getPointStatus(point);
              return (
                <div 
                  key={point.id || `${point.x}-${point.y}-${idx}`}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-sm border",
                    showCorrectAnswers && status === 'correct' && "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700",
                    showCorrectAnswers && status === 'incorrect' && "bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700",
                    !showCorrectAnswers && "bg-background"
                  )}
                >
                  <span>({formatCoord(point.x)}, {formatCoord(point.y)})</span>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-1"
                      onClick={() => removePoint(idx)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Score summary when showing correct answers */}
      {showCorrectAnswers && markingData && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="text-sm font-medium">
            Score: {markingData.totalScore} / {markingData.totalMarks} marks
          </div>
        </div>
      )}

      {/* Expanded Graph Modal */}
      <ExpandedGraphModal
        key={`expanded-${questionId}`}
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        config={config}
        studentPoints={studentPoints}
        onPointsChange={onPointsChange}
        segments={segments}
        onSegmentsChange={onSegmentsChange}
        drawnPaths={drawnPaths}
        onDrawnPathsChange={onDrawnPathsChange}
        joinMode={joinMode}
        onJoinModeChange={onJoinModeChange}
        domainX={domainX}
        domainY={domainY}
        readOnly={readOnly}
        showCorrectAnswers={showCorrectAnswers}
        markingData={markingData}
        referenceSeries={referenceSeries}
        expectedCurveSeries={expectedCurveSeries}
        subjectColor={subjectColor}
        questionId={questionId}
        showProtractor={showProtractor}
        protractorState={protractorState}
        onProtractorStateChange={onProtractorStateChange}
        selectedSegmentIds={selectedSegmentIds}
        onSelectedSegmentIdsChange={onSelectedSegmentIdsChange}
        angleMeasurements={angleMeasurements}
        onAngleMeasurementsChange={onAngleMeasurementsChange}
        onUndo={undo}
        onRedo={redo}
        onClearAll={clearAll}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        canClear={studentPoints.length > 0 || segments.length > 0 || drawnPaths.length > 0}
        questionText={questionText}
      />
    </div>
  );
}

export default GraphPlottingQuestion;
