import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ComposedChart,
  ZAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { Undo2, Redo2, Trash2, Eraser, Minus, Spline, Pencil, Ruler } from 'lucide-react';
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

interface GraphPlottingQuestionProps {
  config: GraphPlottingConfig;
  expectedAnswer?: GraphPlottingAnswer;
  studentPoints: GraphPoint[];
  onPointsChange: (points: GraphPoint[]) => void;
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: GraphPlottingMarkingResult;
  subjectColor?: string;
  joinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | null;
  onJoinModeChange?: (mode: 'straight' | 'curved' | 'freeform' | 'angle' | null) => void;
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
}

// History state for undo/redo
interface HistoryState {
  points: GraphPoint[];
  segments: LineSegment[];
  drawnPaths: DrawingPath[];
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

  // Selected points for creating segments (tap Point A, then Point B)
  const [selectedJoinPoints, setSelectedJoinPoints] = useState<GraphPoint[]>([]);

  // Double-tap detection for activating drag mode
  const lastTapRef = useRef<{ point: GraphPoint | null; time: number; x: number; y: number }>({
    point: null,
    time: 0,
    x: 0,
    y: 0
  });
  const DOUBLE_TAP_THRESHOLD = 350; // ms
  const DOUBLE_TAP_DISTANCE = 30; // px max movement
  
  // Track if pointer event started on a point (to prevent bubbling issues)
  const pointerStartedOnPointRef = useRef(false);
  
  // Track if pointer event started on a line segment (to prevent container from clearing selection)
  const pointerStartedOnLineRef = useRef(false);
  
  // Active draggable point (selected via double-tap for drag mode)
  const [activeDragPoint, setActiveDragPoint] = useState<GraphPoint | null>(null);
  
  // Dragging state for point repositioning
  const [draggingPoint, setDraggingPoint] = useState<{ original: GraphPoint; current: GraphPoint } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);
  const DRAG_THRESHOLD = 8; // px - minimum movement to start drag
  
  // Erase mode
  const [eraseMode, setEraseMode] = useState(false);

  // Reset internal state when question changes (navigation/retry)
  useEffect(() => {
    setSelectedJoinPoints([]);
    lastTapRef.current = { point: null, time: 0, x: 0, y: 0 };
    pointerStartedOnPointRef.current = false;
    pointerStartedOnLineRef.current = false;
    setDraggingPoint(null);
    setActiveDragPoint(null);
    isDraggingRef.current = false;
    dragStartRef.current = null;
    setEraseMode(false);
    setUndoStack([]);
    setRedoStack([]);
  }, [questionId]);

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
   * Round a value to 1 decimal place.
   */
  const round1dp = useCallback((value: number): number => {
    return Math.round(value * 10) / 10;
  }, []);

  /**
   * Snap a coordinate to 1 decimal place precision.
   * This allows non-integer coordinates like 4.2, 4.5, 4.7 etc.
   */
  const snapPoint = useCallback((x: number, y: number): GraphPoint => {
    return { 
      x: round1dp(x), 
      y: round1dp(y) 
    };
  }, [round1dp]);

  /**
   * Check if a point is currently selected for joining.
   */
  const isPointSelected = useCallback((point: GraphPoint): boolean => {
    return selectedJoinPoints.some(p => p.x === point.x && p.y === point.y);
  }, [selectedJoinPoints]);

  /**
   * Save current state to history (call before making changes)
   */
  const saveToHistory = useCallback(() => {
    const currentState: HistoryState = {
      points: [...studentPoints],
      segments: [...segments],
      drawnPaths: [...drawnPaths],
    };
    setUndoStack(prev => [...prev, currentState]);
    setRedoStack([]); // Clear redo stack on new action
  }, [studentPoints, segments, drawnPaths]);

  /**
   * Undo the last action.
   */
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    // Save current state to redo stack
    const currentState: HistoryState = {
      points: [...studentPoints],
      segments: [...segments],
      drawnPaths: [...drawnPaths],
    };
    setRedoStack(prev => [...prev, currentState]);
    
    // Pop from undo stack and apply
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    
    onPointsChange(previousState.points);
    onSegmentsChange(previousState.segments);
    onDrawnPathsChange?.(previousState.drawnPaths);
  }, [undoStack, studentPoints, segments, drawnPaths, onPointsChange, onSegmentsChange, onDrawnPathsChange]);

  /**
   * Redo the last undone action.
   */
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    // Save current state to undo stack
    const currentState: HistoryState = {
      points: [...studentPoints],
      segments: [...segments],
      drawnPaths: [...drawnPaths],
    };
    setUndoStack(prev => [...prev, currentState]);
    
    // Pop from redo stack and apply
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    
    onPointsChange(nextState.points);
    onSegmentsChange(nextState.segments);
    onDrawnPathsChange?.(nextState.drawnPaths);
  }, [redoStack, studentPoints, segments, drawnPaths, onPointsChange, onSegmentsChange, onDrawnPathsChange]);

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
      onPointsChange(studentPoints.filter(p => p.x !== point.x || p.y !== point.y));
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
    const isSamePoint = lastTap.point && lastTap.point.x === point.x && lastTap.point.y === point.y;
    const distanceMoved = Math.sqrt(
      Math.pow(clientX - lastTap.x, 2) + Math.pow(clientY - lastTap.y, 2)
    );
    const isDoubleTap = isSamePoint && timeDiff < DOUBLE_TAP_THRESHOLD && distanceMoved < DOUBLE_TAP_DISTANCE;

    // Update last tap reference
    lastTapRef.current = { point, time: now, x: clientX, y: clientY };

    if (!isJoinModeActive && !isAngleMode) {
      // Not in active join/angle mode
      if (isDoubleTap) {
        // Double-tap: toggle drag mode for this point
        if (activeDragPoint && activeDragPoint.x === point.x && activeDragPoint.y === point.y) {
          // Already in drag mode for this point - exit drag mode
          setActiveDragPoint(null);
        } else {
          // Enter drag mode for this point
          setActiveDragPoint(point);
        }
        lastTapRef.current = { point: null, time: 0, x: 0, y: 0 };
      }
      // Single tap does nothing in non-join mode (no accidental removal)
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
        const newSegment: LineSegment = {
          id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from: { x: fromPoint.x, y: fromPoint.y },
          to: { x: toPoint.x, y: toPoint.y },
          mode: currentJoinMode as 'straight' | 'curved',
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
      lastTapRef.current = { point: null, time: 0, x: 0, y: 0 };
      return;
    }

    // No point selected yet: SELECT this point immediately
    setSelectedJoinPoints([point]);
  }, [readOnly, isJoinModeActive, isAngleMode, selectedJoinPoints, isPointSelected, studentPoints, segments, currentJoinMode, onPointsChange, onSegmentsChange, axisScales, eraseMode, activeDragPoint, saveToHistory]);

  /**
   * Add a new point to the graph.
   */
  const addPoint = useCallback((x: number, y: number) => {
    if (readOnly) return;
    
    const maxPoints = config.maxPoints ?? 20;
    if (studentPoints.length >= maxPoints) return;

    const snapped = snapPoint(x, y);
    
    // Check if point already exists
    const exists = studentPoints.some(p => p.x === snapped.x && p.y === snapped.y);
    if (exists) return;

    // Save to history and add point
    saveToHistory();
    onPointsChange([...studentPoints, snapped]);
  }, [readOnly, config.maxPoints, studentPoints, snapPoint, onPointsChange, saveToHistory]);

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
    setSelectedJoinPoints(prev => prev.filter(p => p.x !== pointToRemove.x || p.y !== pointToRemove.y));
    
    // Clear drag mode if this was the active drag point
    if (activeDragPoint && activeDragPoint.x === pointToRemove.x && activeDragPoint.y === pointToRemove.y) {
      setActiveDragPoint(null);
    }
  }, [readOnly, studentPoints, segments, onPointsChange, onSegmentsChange, activeDragPoint, saveToHistory]);

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
    if (studentPoints.length === 0 && segments.length === 0 && drawnPaths.length === 0) return;
    
    saveToHistory();
    onPointsChange([]);
    onSegmentsChange([]);
    onDrawnPathsChange?.([]);
    setSelectedJoinPoints([]);
    setActiveDragPoint(null);
  }, [readOnly, studentPoints, segments, drawnPaths, onPointsChange, onSegmentsChange, onDrawnPathsChange, saveToHistory]);

  /**
   * Get the status of a point for display (correct, incorrect, etc.)
   */
  const getPointStatus = useCallback((point: GraphPoint): 'correct' | 'incorrect' | 'neutral' => {
    if (!showCorrectAnswers || !markingData?.perPointResults) return 'neutral';
    
    const result = markingData.perPointResults.find(r => 
      r.studentPoint?.x === point.x && r.studentPoint?.y === point.y
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
  const dataToPixel = useCallback((dataX: number, dataY: number): { px: number; py: number } => {
    const plotWidth = chartContainerSize.width - chartMargins.left - chartMargins.right;
    const plotHeight = chartContainerSize.height - chartMargins.top - chartMargins.bottom;
    
    // Use axis scales if available (most accurate)
    if (axisScales.x && axisScales.y) {
      let px = axisScales.x(dataX);
      let py = axisScales.y(dataY);
      // Check if scales need offset adjustment
      if (px < chartMargins.left) px += chartMargins.left;
      if (py < chartMargins.top) py += chartMargins.top;
      return { px, py };
    }
    
    // Fallback: manual calculation
    const px = chartMargins.left + ((dataX - domainX[0]) / (domainX[1] - domainX[0])) * plotWidth;
    const py = chartMargins.top + (1 - (dataY - domainY[0]) / (domainY[1] - domainY[0])) * plotHeight;
    return { px, py };
  }, [chartContainerSize, chartMargins, axisScales, domainX, domainY]);

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
   * Handle pointer down on a point - start potential drag
   */
  const handlePointPointerDown = useCallback((point: GraphPoint, e: React.PointerEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    
    // Mark that pointer started on a point
    pointerStartedOnPointRef.current = true;
    
    // Only allow dragging if this point is in drag mode
    if (activeDragPoint && activeDragPoint.x === point.x && activeDragPoint.y === point.y) {
      // Set up for drag
      dragStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      
      // Capture pointer for drag tracking
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }, [readOnly, activeDragPoint]);

  /**
   * Handle pointer move during drag
   */
  const handlePointPointerMove = useCallback((point: GraphPoint, e: React.PointerEvent) => {
    if (readOnly || !dragStartRef.current) return;
    
    // Only allow dragging if this point is the active drag point
    if (!activeDragPoint || activeDragPoint.x !== point.x || activeDragPoint.y !== point.y) return;
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Start drag if threshold exceeded
    if (!isDraggingRef.current && distance >= DRAG_THRESHOLD) {
      isDraggingRef.current = true;
      // Save history when drag starts
      saveToHistory();
    }
    
    if (isDraggingRef.current) {
      const rect = chartContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const pixelX = e.clientX - rect.left;
      const pixelY = e.clientY - rect.top;
      
      // Convert to data coordinates and snap to 1dp
      const { dataX, dataY } = pixelToData(pixelX, pixelY);
      
      // Clamp to domain
      const clampedX = Math.max(domainX[0], Math.min(domainX[1], dataX));
      const clampedY = Math.max(domainY[0], Math.min(domainY[1], dataY));
      
      const snapped = snapPoint(clampedX, clampedY);
      
      setDraggingPoint({
        original: point,
        current: snapped
      });
    }
  }, [readOnly, activeDragPoint, pixelToData, snapPoint, domainX, domainY, saveToHistory]);

  /**
   * Handle pointer up - end drag or trigger click
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
    
    if (isDraggingRef.current && draggingPoint) {
      // End drag - commit the new position
      const newPoints = studentPoints.map(p => 
        p.x === draggingPoint.original.x && p.y === draggingPoint.original.y
          ? draggingPoint.current
          : p
      );
      
      // Update segments that reference this point
      const newSegments = segments.map(seg => {
        let updated = { ...seg };
        if (seg.from.x === draggingPoint.original.x && seg.from.y === draggingPoint.original.y) {
          updated.from = draggingPoint.current;
        }
        if (seg.to.x === draggingPoint.original.x && seg.to.y === draggingPoint.original.y) {
          updated.to = draggingPoint.current;
        }
        return updated;
      });
      
      onPointsChange(newPoints);
      if (newSegments.some((seg, i) => 
        seg.from.x !== segments[i].from.x || seg.from.y !== segments[i].from.y ||
        seg.to.x !== segments[i].to.x || seg.to.y !== segments[i].to.y
      )) {
        onSegmentsChange(newSegments);
      }
      
      // Update the active drag point to the new position
      setActiveDragPoint(draggingPoint.current);
      
      setDraggingPoint(null);
      isDraggingRef.current = false;
      dragStartRef.current = null;
      
      // Keep guard ref set to prevent container from processing this
      return;
    }
    
    // Not a drag - treat as click
    isDraggingRef.current = false;
    dragStartRef.current = null;
    
    // Call original click handler
    handlePointClick(point, e);
  }, [readOnly, draggingPoint, studentPoints, segments, onPointsChange, onSegmentsChange, handlePointClick]);

  /**
   * Handle pointer up on the chart background to add a point.
   * Only adds points if NOT in "point selection" mode (no points selected for joining).
   * Also clears selection if clicking on empty space (but not if the click started on a point).
   */
  const handleChartContainerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    
    // If the pointer event started on a point, don't process it here (already handled by point)
    if (pointerStartedOnPointRef.current) {
      pointerStartedOnPointRef.current = false;
      return;
    }
    
    // If the pointer event started on a line segment, don't clear selection (already handled by segment)
    if (pointerStartedOnLineRef.current) {
      pointerStartedOnLineRef.current = false;
      return;
    }
    
    // Clear active drag point when tapping empty space
    if (activeDragPoint) {
      setActiveDragPoint(null);
      // Don't add a new point when exiting drag mode
      return;
    }
    
    // In erase mode, don't add points - just clear selections
    if (eraseMode) {
      if (selectedJoinPoints.length > 0) {
        setSelectedJoinPoints([]);
      }
      if (selectedSegmentIds.length > 0 && onSelectedSegmentIdsChange) {
        onSelectedSegmentIdsChange([]);
      }
      return;
    }
    
    // In angle mode, only clear segment selection when clicking empty space - don't add points
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
        const isSamePoint = lastTap.point && lastTap.point.x === nearestPoint.x && lastTap.point.y === nearestPoint.y;
        const distanceMoved = Math.sqrt(Math.pow(e.clientX - lastTap.x, 2) + Math.pow(e.clientY - lastTap.y, 2));
        
        // Update last tap
        lastTapRef.current = { point: nearestPoint, time: now, x: e.clientX, y: e.clientY };
        
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
          lastTapRef.current = { point: null, time: 0, x: 0, y: 0 };
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
      // Clear segment selection when clicking empty space (angle measurement tool)
      if (selectedSegmentIds.length > 0 && onSelectedSegmentIdsChange) {
        onSelectedSegmentIdsChange([]);
      }
      return;
    }
    
    // If we have a point selected and user clicks empty space, clear selection
    if (selectedJoinPoints.length > 0) {
      setSelectedJoinPoints([]);
      // Also clear segment selection
      if (selectedSegmentIds.length > 0 && onSelectedSegmentIdsChange) {
        onSelectedSegmentIdsChange([]);
      }
      return;
    }
    
    // Clear segment selection when clicking empty space (angle measurement tool)
    if (selectedSegmentIds.length > 0 && onSelectedSegmentIdsChange) {
      onSelectedSegmentIdsChange([]);
    }

    // Convert pixel to data coordinates for adding new point
    const plotWidth = chartContainerSize.width - chartMargins.left - chartMargins.right;
    const plotHeight = chartContainerSize.height - chartMargins.top - chartMargins.bottom;

    // Check if click is within the plot area
    if (clickX < chartMargins.left || clickX > chartContainerSize.width - chartMargins.right ||
        clickY < chartMargins.top || clickY > chartContainerSize.height - chartMargins.bottom) {
      return;
    }

    const dataX = domainX[0] + ((clickX - chartMargins.left) / plotWidth) * (domainX[1] - domainX[0]);
    const dataY = domainY[0] + ((1 - (clickY - chartMargins.top) / plotHeight)) * (domainY[1] - domainY[0]);

    addPoint(dataX, dataY);
  }, [readOnly, selectedJoinPoints, chartContainerSize, chartMargins, domainX, domainY, addPoint, isJoinModeActive, findNearestPoint, isPointSelected, segments, currentJoinMode, onSegmentsChange, activeDragPoint, eraseMode, isAngleMode, selectedSegmentIds, onSelectedSegmentIdsChange, saveToHistory]);

  /**
   * Handle segment click in erase mode
   */
  const handleSegmentErase = useCallback((segmentId: string) => {
    if (!eraseMode || readOnly) return;
    saveToHistory();
    onSegmentsChange(segments.filter(s => s.id !== segmentId));
  }, [eraseMode, readOnly, segments, onSegmentsChange, saveToHistory]);

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
    
    // Check if this point is being dragged
    const isDragging = draggingPoint?.original.x === point.x && draggingPoint?.original.y === point.y;
    
    // Check if this point is in drag mode (active for dragging)
    const isInDragMode = activeDragPoint?.x === point.x && activeDragPoint?.y === point.y;
    
    // If dragging, use the dragged position for display
    let displayCx = cx;
    let displayCy = cy;
    if (isDragging && draggingPoint) {
      const { px, py } = dataToPixel(draggingPoint.current.x, draggingPoint.current.y);
      displayCx = px;
      displayCy = py;
    }
    
    // Determine fill color based on status
    let fillColor = subjectColor;
    if (showCorrectAnswers) {
      if (status === 'correct') fillColor = 'hsl(var(--success, 142 76% 36%))';
      else if (status === 'incorrect') fillColor = 'hsl(var(--destructive))';
    }

    // Larger touch target for mobile (30px radius for easier tapping and dragging)
    const HIT_RADIUS = 30;
    const visualRadius = isSelected || isDragging || isInDragMode ? 10 : 8;

    return (
      <g 
        key={`point-${point.x}-${point.y}`}
        style={{ cursor: readOnly ? 'default' : eraseMode ? 'pointer' : isDragging ? 'grabbing' : isInDragMode ? 'grab' : 'pointer', touchAction: 'none' }}
      >
        {/* Invisible larger touch target for iPad/iPhone friendly tapping and dragging */}
        <circle
          cx={displayCx}
          cy={displayCy}
          r={HIT_RADIUS}
          fill="transparent"
          stroke="transparent"
          pointerEvents="all"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => handlePointPointerDown(point, e)}
          onPointerMove={(e) => handlePointPointerMove(point, e)}
          onPointerUp={(e) => handlePointPointerUp(point, e)}
          onPointerCancel={(e) => {
            // Handle cancel (e.g., finger left screen) - reset drag state
            isDraggingRef.current = false;
            dragStartRef.current = null;
            setDraggingPoint(null);
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
        <title>{`(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`}</title>
      </g>
    );
  }, [subjectColor, showCorrectAnswers, getPointStatus, isPointSelected, readOnly, 
      handlePointPointerDown, handlePointPointerMove, handlePointPointerUp, 
      draggingPoint, dataToPixel, activeDragPoint, eraseMode]);

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
            onClick={() => setEraseMode(!eraseMode)}
            title={eraseMode ? "Exit erase mode" : "Erase mode"}
            className={eraseMode ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            <Eraser className="h-4 w-4" />
          </Button>

          {/* Join mode toggle */}
          {isJoinModeEnabled && onJoinModeChange && (
            <ToggleGroup
              type="single"
              value={currentJoinMode || ''}
              onValueChange={(value) => {
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
        </div>
      )}

      {/* Helper text */}
      {!readOnly && (
        <p className="text-sm text-muted-foreground">
          {eraseMode ? (
            'Tap a point or line to delete it. Tap the eraser icon again to exit.'
          ) : activeDragPoint ? (
            `Drag mode active for (${activeDragPoint.x.toFixed(1)}, ${activeDragPoint.y.toFixed(1)}). Drag to move, or tap empty space to exit.`
          ) : isAngleMode ? (
            selectedSegmentIds.length === 0 ? (
              'Tap two connected lines to measure the angle between them.'
            ) : selectedSegmentIds.length === 1 ? (
              'Tap another connected line to see the angle.'
            ) : (
              'Angle displayed. Tap empty space to clear, or tap another line to start a new measurement.'
            )
          ) : isJoinModeActive ? (
            currentJoinMode === 'freeform' ? (
              'Click and drag on the graph to draw lines.'
            ) : selectedJoinPoints.length === 0 ? (
              `Tap a point to select it for joining. Deselect the mode to add points.`
            ) : selectedJoinPoints.length === 1 ? (
              `Point (${selectedJoinPoints[0].x.toFixed(1)}, ${selectedJoinPoints[0].y.toFixed(1)}) selected. Tap another point to connect.`
            ) : (
              'Creating segment...'
            )
          ) : (
            'Tap to plot points (1dp). Double-tap a point to enable drag mode.'
          )}
        </p>
      )}

      {/* Chart */}
      <div 
        ref={chartContainerRef}
        className="relative w-full aspect-[4/3] border rounded-lg bg-card"
        onPointerUp={handleChartContainerPointerUp}
        style={{ cursor: readOnly ? 'default' : eraseMode ? 'pointer' : 'crosshair', touchAction: 'none', overflow: 'visible' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            ref={chartRef}
            margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            
            <XAxis
              type="number"
              dataKey="x"
              domain={domainX}
              tickCount={Math.min(11, domainX[1] - domainX[0] + 1)}
              allowDecimals={true}
              label={{ 
                value: 'x', 
                position: 'bottom', 
                offset: 5,
                style: { fill: 'hsl(var(--foreground))' }
              }}
              tick={{ fill: 'hsl(var(--foreground))' }}
              stroke="hsl(var(--foreground))"
            />
            
            <YAxis
              type="number"
              dataKey="y"
              domain={domainY}
              tickCount={Math.min(11, domainY[1] - domainY[0] + 1)}
              allowDecimals={true}
              label={{ 
                value: 'y', 
                angle: -90, 
                position: 'insideLeft',
                style: { fill: 'hsl(var(--foreground))' }
              }}
              stroke="hsl(var(--foreground))"
            />
            
            <ZAxis range={[100, 100]} />
            
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as GraphPoint;
                return (
                  <div className="bg-popover text-popover-foreground border rounded px-2 py-1 text-sm shadow-md font-mono">
                    ({point.x.toFixed(1)}, {point.y.toFixed(1)})
                  </div>
                );
              }}
            />

            {/* Reference lines at 0 if in domain */}
            {domainX[0] <= 0 && domainX[1] >= 0 && (
              <ReferenceLine x={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
            )}
            {domainY[0] <= 0 && domainY[1] >= 0 && (
              <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
            )}

            {/* Student points */}
            <Scatter
              name="Points"
              data={studentPoints}
              fill={subjectColor}
              shape={renderDot}
              isAnimationActive={false}
            />

            {/* Missed expected points (when showing correct answers) */}
            {showCorrectAnswers && missedPoints.map((point, idx) => (
              <ReferenceDot
                key={`missed-${idx}`}
                x={point.x}
                y={point.y}
                r={8}
                fill="transparent"
                stroke="hsl(var(--success, 142 76% 36%))"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Segments overlay - ONLY renders explicitly created segments */}
        {segments.length > 0 && (
          <GraphSegmentsLayer
            segments={segments}
            onSegmentsChange={readOnly ? undefined : onSegmentsChange}
            stroke="#3b82f6"
            strokeWidth={4}
            containerWidth={chartContainerSize.width}
            containerHeight={chartContainerSize.height}
            domainX={domainX}
            domainY={domainY}
            xScale={axisScales.x}
            yScale={axisScales.y}
            marginLeft={chartMargins.left}
            marginRight={chartMargins.right}
            marginTop={chartMargins.top}
            marginBottom={chartMargins.bottom}
            readOnly={readOnly}
            debug={false}
            selectedSegmentIds={isAngleMode ? selectedSegmentIds : []}
            onSegmentSelect={eraseMode ? handleSegmentErase : isAngleMode ? (segId) => {
              if (!onSelectedSegmentIdsChange) return;
              // Toggle selection: if already selected, deselect; otherwise add to selection (max 2)
              if (selectedSegmentIds.includes(segId)) {
                onSelectedSegmentIdsChange(selectedSegmentIds.filter(id => id !== segId));
              } else if (selectedSegmentIds.length < 2) {
                onSelectedSegmentIdsChange([...selectedSegmentIds, segId]);
              } else {
                // Start new selection (clear and select this one)
                onSelectedSegmentIdsChange([segId]);
              }
            } : undefined}
            onPointerStartedOnSegment={(eraseMode || isAngleMode) ? () => {
              pointerStartedOnLineRef.current = true;
            } : undefined}
          />
        )}

        {/* Freeform drawing canvas overlay */}
        {isJoinModeEnabled && onDrawnPathsChange && (
          <GraphDrawingCanvas
            containerWidth={chartContainerSize.width}
            containerHeight={chartContainerSize.height}
            marginLeft={chartMargins.left}
            marginTop={chartMargins.top}
            marginRight={chartMargins.right}
            marginBottom={chartMargins.bottom}
            paths={drawnPaths}
            onPathsChange={onDrawnPathsChange}
            readOnly={readOnly}
            active={isJoinModeActive && currentJoinMode === 'freeform'}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
          />
        )}

        {/* Protractor overlay */}
        {showProtractor && (
          <ProtractorOverlay
            containerWidth={chartContainerSize.width}
            containerHeight={chartContainerSize.height}
            marginLeft={chartMargins.left}
            marginRight={chartMargins.right}
            marginTop={chartMargins.top}
            marginBottom={chartMargins.bottom}
            protractorState={protractorState}
            onProtractorStateChange={onProtractorStateChange}
            readOnly={readOnly}
          />
        )}

        {/* Angle measurement overlay */}
        {selectedSegmentIds.length === 2 && (
          <AngleMeasurementOverlay
            segments={segments}
            selectedSegmentIds={selectedSegmentIds}
            containerWidth={chartContainerSize.width}
            containerHeight={chartContainerSize.height}
            marginLeft={chartMargins.left}
            marginRight={chartMargins.right}
            marginTop={chartMargins.top}
            marginBottom={chartMargins.bottom}
            domainX={domainX}
            domainY={domainY}
            xScale={axisScales.x}
            yScale={axisScales.y}
          />
        )}

        {/* Drag tooltip - shows live coordinates while dragging a point */}
        {draggingPoint && (
          <div 
            className="absolute pointer-events-none z-50"
            style={{
              left: dataToPixel(draggingPoint.current.x, draggingPoint.current.y).px,
              top: dataToPixel(draggingPoint.current.x, draggingPoint.current.y).py - 40,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="bg-popover text-popover-foreground border rounded px-2 py-1 text-sm shadow-lg font-mono whitespace-nowrap">
              ({draggingPoint.current.x.toFixed(1)}, {draggingPoint.current.y.toFixed(1)})
            </div>
          </div>
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
                  ({seg.from.x.toFixed(1)}, {seg.from.y.toFixed(1)}) → ({seg.to.x.toFixed(1)}, {seg.to.y.toFixed(1)})
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
                  ({path.points.length} pts)
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

      {/* Points table */}
      {studentPoints.length > 0 && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="text-sm font-medium mb-2">Plotted points ({studentPoints.length})</div>
          <div className="flex flex-wrap gap-2">
            {studentPoints.map((point, idx) => {
              const status = getPointStatus(point);
              return (
                <div 
                  key={`${point.x}-${point.y}-${idx}`}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-sm border",
                    showCorrectAnswers && status === 'correct' && "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700",
                    showCorrectAnswers && status === 'incorrect' && "bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700",
                    !showCorrectAnswers && "bg-background"
                  )}
                >
                  <span>({point.x.toFixed(1)}, {point.y.toFixed(1)})</span>
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
        </div>
      )}

      {/* Score summary when showing correct answers */}
      {showCorrectAnswers && markingData && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="text-sm font-medium">
            Score: {markingData.totalScore} / {markingData.totalMarks} marks
          </div>
        </div>
      )}
    </div>
  );
}

export default GraphPlottingQuestion;
