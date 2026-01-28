import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
  ComposedChart,
  ZAxis,
  Line,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { Undo2, Redo2, Trash2, Eraser, Minus, Spline, Pencil, Ruler, Minimize2, Check } from 'lucide-react';
import {
  GraphPlottingConfig,
  GraphPoint,
  GraphPlottingMarkingResult,
  LineSegment,
  DrawingPath,
  GraphSeries,
} from './types';
import { GraphSegmentsLayer } from './GraphSegmentsLayer';
import { GraphDrawingCanvas } from './GraphDrawingCanvas';
import { ProtractorOverlay, ProtractorState } from './ProtractorOverlay';
import { AngleMeasurementOverlay } from './AngleMeasurementOverlay';
import { AngleMeasurement } from './GraphPlottingQuestion';

interface ExpandedGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Pass through all GraphPlottingQuestion props
  config: GraphPlottingConfig;
  studentPoints: GraphPoint[];
  onPointsChange: (points: GraphPoint[]) => void;
  segments: LineSegment[];
  onSegmentsChange: (segments: LineSegment[]) => void;
  drawnPaths?: DrawingPath[];
  onDrawnPathsChange?: (paths: DrawingPath[]) => void;
  joinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | null;
  onJoinModeChange?: (mode: 'straight' | 'curved' | 'freeform' | 'angle' | null) => void;
  
  // Domain/scale (locked between views)
  domainX: [number, number];
  domainY: [number, number];
  
  // Review mode data
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: GraphPlottingMarkingResult;
  referenceSeries?: GraphSeries[];
  expectedCurveSeries?: GraphSeries[];
  
  // Styling
  subjectColor?: string;
  
  // Additional props
  questionId?: string;
  showProtractor?: boolean;
  protractorState?: ProtractorState;
  onProtractorStateChange?: (state: ProtractorState) => void;
  selectedSegmentIds?: string[];
  onSelectedSegmentIdsChange?: (ids: string[]) => void;
  angleMeasurements?: AngleMeasurement[];
  onAngleMeasurementsChange?: (measurements: AngleMeasurement[]) => void;
  
  // History functions passed from parent
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
}

/**
 * Generate a stable unique ID for a point.
 */
function generatePointId(): string {
  return `pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * ExpandedGraphModal - Full-screen modal for larger graph drawing canvas.
 * 
 * Shares state with the inline GraphPlottingQuestion - no data duplication.
 * All changes made in the modal immediately update the parent state via callbacks.
 */
export function ExpandedGraphModal({
  isOpen,
  onClose,
  config,
  studentPoints,
  onPointsChange,
  segments = [],
  onSegmentsChange,
  drawnPaths = [],
  onDrawnPathsChange,
  joinMode,
  onJoinModeChange,
  domainX,
  domainY,
  readOnly = false,
  showCorrectAnswers = false,
  markingData,
  referenceSeries = [],
  expectedCurveSeries = [],
  subjectColor = 'hsl(var(--primary))',
  questionId,
  showProtractor = false,
  protractorState,
  onProtractorStateChange,
  selectedSegmentIds = [],
  onSelectedSegmentIdsChange,
  angleMeasurements = [],
  onAngleMeasurementsChange,
  onUndo,
  onRedo,
  onClearAll,
  canUndo,
  canRedo,
  canClear,
}: ExpandedGraphModalProps) {
  const chartRef = useRef<any>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Chart size state
  const [chartContainerSize, setChartContainerSize] = useState({ width: 800, height: 600 });
  
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
  const lastTapRef = useRef<{ pointId: string | null; time: number; x: number; y: number }>({
    pointId: null,
    time: 0,
    x: 0,
    y: 0
  });
  const DOUBLE_TAP_THRESHOLD = 500;
  const DOUBLE_TAP_DISTANCE = 60;

  // Hit radius for touch targets
  const isCoarsePointer = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }, []);

  const POINT_HIT_RADIUS = useMemo(() => {
    if (!isCoarsePointer) return 32;
    if (chartContainerSize.width < 480) return 44;
    return 72;
  }, [isCoarsePointer, chartContainerSize.width]);
  
  // Track if pointer event started on a point
  const pointerStartedOnPointRef = useRef(false);
  const pointerStartedOnLineRef = useRef(false);
  
  // Active draggable point ID
  const [activeDragPointId, setActiveDragPointIdState] = useState<string | null>(null);
  const activeDragPointIdRef = useRef<string | null>(null);
  const setActiveDragPointId = useCallback((id: string | null) => {
    activeDragPointIdRef.current = id;
    setActiveDragPointIdState(id);
  }, []);
  
  // Dragging state for point repositioning
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [draggingPosition, setDraggingPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const isDraggingRef = useRef(false);
  const DRAG_THRESHOLD = 8;
  
  // Erase mode
  const [eraseMode, setEraseMode] = useState(false);

  // Helper: find point by ID
  const findPointById = useCallback((id: string | null): GraphPoint | undefined => {
    if (!id) return undefined;
    return studentPoints.find(p => p.id === id);
  }, [studentPoints]);

  // Reset internal state when modal opens
  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen, questionId]);

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

  // Mode helpers
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
   */
  const snapPoint = useCallback((x: number, y: number): { x: number; y: number } => {
    return { 
      x: round1dp(x), 
      y: round1dp(y) 
    };
  }, [round1dp]);

  /**
   * Check if a point is currently selected for joining.
   */
  const isPointSelected = useCallback((point: GraphPoint): boolean => {
    return selectedJoinPoints.some(p => p.id === point.id);
  }, [selectedJoinPoints]);

  /**
   * Convert data coordinates to pixel coordinates.
   */
  const dataToPixel = useCallback((dataX: number, dataY: number): { px: number; py: number } => {
    const plotWidth = chartContainerSize.width - chartMargins.left - chartMargins.right;
    const plotHeight = chartContainerSize.height - chartMargins.top - chartMargins.bottom;
    
    const px = chartMargins.left + ((dataX - domainX[0]) / (domainX[1] - domainX[0])) * plotWidth;
    const py = chartMargins.top + (1 - (dataY - domainY[0]) / (domainY[1] - domainY[0])) * plotHeight;
    
    return { px, py };
  }, [chartContainerSize, chartMargins, domainX, domainY]);

  /**
   * Convert pixel coordinates to data coordinates.
   */
  const pixelToData = useCallback((pixelX: number, pixelY: number): { x: number; y: number } => {
    const plotWidth = chartContainerSize.width - chartMargins.left - chartMargins.right;
    const plotHeight = chartContainerSize.height - chartMargins.top - chartMargins.bottom;
    
    const x = domainX[0] + ((pixelX - chartMargins.left) / plotWidth) * (domainX[1] - domainX[0]);
    const y = domainY[0] + (1 - (pixelY - chartMargins.top) / plotHeight) * (domainY[1] - domainY[0]);
    
    return { x: round1dp(x), y: round1dp(y) };
  }, [chartContainerSize, chartMargins, domainX, domainY, round1dp]);

  /**
   * Compute angle between two segments at their shared vertex.
   */
  const computeAngleBetweenSegments = useCallback((seg1: LineSegment, seg2: LineSegment): { angle: number; vertex: GraphPoint } | null => {
    const pointsMatch = (p1: GraphPoint, p2: GraphPoint): boolean => {
      if (p1.id && p2.id && p1.id === p2.id) return true;
      const tolerance = 0.01;
      return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
    };
    
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
    
    if (!sharedVertex) return null;
    
    const other1 = idx1 === 0 ? seg1.to : seg1.from;
    const other2 = idx2 === 0 ? seg2.to : seg2.from;
    
    const v1 = { x: other1.x - sharedVertex.x, y: other1.y - sharedVertex.y };
    const v2 = { x: other2.x - sharedVertex.x, y: other2.y - sharedVertex.y };
    
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
   * Add a new point to the graph.
   */
  const addPoint = useCallback((x: number, y: number) => {
    if (readOnly) return;
    
    const snapped = snapPoint(x, y);
    
    if (snapped.x < domainX[0] || snapped.x > domainX[1] || 
        snapped.y < domainY[0] || snapped.y > domainY[1]) {
      return;
    }
    
    const isDuplicate = studentPoints.some(
      p => Math.abs(p.x - snapped.x) < 0.05 && Math.abs(p.y - snapped.y) < 0.05
    );
    
    if (!isDuplicate) {
      const newPoint: GraphPoint = { 
        id: generatePointId(), 
        x: snapped.x, 
        y: snapped.y 
      };
      onPointsChange([...studentPoints, newPoint]);
    }
  }, [readOnly, snapPoint, domainX, domainY, studentPoints, onPointsChange]);

  /**
   * Remove a point by index.
   */
  const removePoint = useCallback((index: number) => {
    if (readOnly) return;
    onPointsChange(studentPoints.filter((_, i) => i !== index));
  }, [readOnly, studentPoints, onPointsChange]);

  /**
   * Remove a segment by ID.
   */
  const removeSegment = useCallback((segmentId: string) => {
    if (readOnly) return;
    onSegmentsChange(segments.filter(s => s.id !== segmentId));
  }, [readOnly, segments, onSegmentsChange]);

  /**
   * Find the nearest point to a pixel coordinate within a given radius.
   */
  const findNearestPoint = useCallback((pixelX: number, pixelY: number, radius: number): GraphPoint | null => {
    let nearestPoint: GraphPoint | null = null;
    let nearestDistance = Infinity;
    
    for (const point of studentPoints) {
      const { px, py } = dataToPixel(point.x, point.y);
      const distance = Math.sqrt(Math.pow(pixelX - px, 2) + Math.pow(pixelY - py, 2));
      
      if (distance <= radius && distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = point;
      }
    }
    
    return nearestPoint;
  }, [studentPoints, dataToPixel]);

  /**
   * Handle segment selection in angle mode.
   */
  const handleAngleSegmentSelect = useCallback((segId: string) => {
    if (!onSelectedSegmentIdsChange) return;
    
    if (selectedSegmentIds.includes(segId)) {
      const newSelection = selectedSegmentIds.filter(id => id !== segId);
      onSelectedSegmentIdsChange(newSelection);
      return;
    }
    
    const newSelection = [...selectedSegmentIds, segId];
    
    if (newSelection.length < 2) {
      onSelectedSegmentIdsChange(newSelection);
      return;
    }
    
    const seg1 = segments.find(s => s.id === newSelection[0]);
    const seg2 = segments.find(s => s.id === newSelection[1]);
    
    if (seg1 && seg2) {
      const result = computeAngleBetweenSegments(seg1, seg2);
      
      if (result !== null && onAngleMeasurementsChange) {
        const exists = angleMeasurements.some(m => 
          (m.segmentId1 === seg1.id && m.segmentId2 === seg2.id) ||
          (m.segmentId1 === seg2.id && m.segmentId2 === seg1.id)
        );
        
        if (!exists) {
          const newMeasurement: AngleMeasurement = {
            id: `angle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            segmentId1: seg1.id,
            segmentId2: seg2.id,
            angleDegrees: result.angle,
          };
          const newMeasurements = [...angleMeasurements, newMeasurement];
          onAngleMeasurementsChange(newMeasurements);
        }
        onSelectedSegmentIdsChange([]);
      } else {
        onSelectedSegmentIdsChange([segId]);
      }
    } else {
      onSelectedSegmentIdsChange([]);
    }
  }, [selectedSegmentIds, segments, angleMeasurements, onSelectedSegmentIdsChange, onAngleMeasurementsChange, computeAngleBetweenSegments]);

  /**
   * Handle erasing an angle measurement.
   */
  const handleAngleMeasurementErase = useCallback((measurementId: string) => {
    if (!eraseMode || readOnly || !onAngleMeasurementsChange) return;
    onAngleMeasurementsChange(angleMeasurements.filter(m => m.id !== measurementId));
  }, [eraseMode, readOnly, angleMeasurements, onAngleMeasurementsChange]);

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
   * Handle point pointer down event.
   */
  const handlePointPointerDown = useCallback((point: GraphPoint, e: React.PointerEvent) => {
    pointerStartedOnPointRef.current = true;
    
    if (eraseMode && !readOnly) {
      const idx = studentPoints.findIndex(p => p.id === point.id);
      if (idx !== -1) {
        removePoint(idx);
      }
      return;
    }
    
    if (isAngleMode) return;
    
    const isInDragMode = activeDragPointIdRef.current === point.id;
    
    if (isInDragMode && !readOnly) {
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {}
      
      dragStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      isDraggingRef.current = false;
      setDraggingPointId(point.id || null);
      setDraggingPosition({ x: point.x, y: point.y });
    }
  }, [eraseMode, readOnly, studentPoints, removePoint, isAngleMode]);

  /**
   * Handle point pointer move event.
   */
  const handlePointPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || !draggingPointId) return;
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > DRAG_THRESHOLD) {
      isDraggingRef.current = true;
    }
    
    if (isDraggingRef.current && chartContainerRef.current) {
      const rect = chartContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const newPos = pixelToData(clickX, clickY);
      
      const clampedX = Math.max(domainX[0], Math.min(domainX[1], newPos.x));
      const clampedY = Math.max(domainY[0], Math.min(domainY[1], newPos.y));
      
      setDraggingPosition({ x: clampedX, y: clampedY });
    }
  }, [draggingPointId, pixelToData, domainX, domainY]);

  /**
   * Handle point pointer up event.
   */
  const handlePointPointerUp = useCallback((point: GraphPoint, e: React.PointerEvent) => {
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {}
    
    const wasDragging = isDraggingRef.current;
    const draggedPointId = draggingPointId;
    
    isDraggingRef.current = false;
    dragStartRef.current = null;
    setDraggingPointId(null);
    
    if (wasDragging && draggedPointId && draggingPosition) {
      const updatedPoints = studentPoints.map(p => 
        p.id === draggedPointId 
          ? { ...p, x: draggingPosition.x, y: draggingPosition.y }
          : p
      );
      onPointsChange(updatedPoints);
      
      if (onAngleMeasurementsChange && angleMeasurements.length > 0) {
        const updatedMeasurements = angleMeasurements.map(m => {
          const seg1 = segments.find(s => s.id === m.segmentId1);
          const seg2 = segments.find(s => s.id === m.segmentId2);
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
      
      setDraggingPosition(null);
      pointerStartedOnPointRef.current = false;
      return;
    }
    
    setDraggingPosition(null);
    pointerStartedOnPointRef.current = false;
  }, [draggingPointId, draggingPosition, studentPoints, onPointsChange, segments, angleMeasurements, onAngleMeasurementsChange, computeAngleBetweenSegments]);

  /**
   * Handle point click (for joining).
   */
  const handlePointClick = useCallback((point: GraphPoint) => {
    if (eraseMode || readOnly || isAngleMode) return;
    
    if (isPointSelected(point)) {
      setSelectedJoinPoints([]);
      return;
    }
    
    if (selectedJoinPoints.length === 1) {
      const fromPoint = selectedJoinPoints[0];
      const toPoint = point;
      
      const segmentExists = segments.some(s => 
        (s.from.x === fromPoint.x && s.from.y === fromPoint.y && s.to.x === toPoint.x && s.to.y === toPoint.y) ||
        (s.from.x === toPoint.x && s.from.y === toPoint.y && s.to.x === fromPoint.x && s.to.y === fromPoint.y)
      );
      
      if (!segmentExists && (currentJoinMode === 'straight' || currentJoinMode === 'curved')) {
        const newSegment: LineSegment = {
          id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from: { x: fromPoint.x, y: fromPoint.y },
          to: { x: toPoint.x, y: toPoint.y },
          mode: currentJoinMode,
        };
        onSegmentsChange([...segments, newSegment]);
      }
      
      setSelectedJoinPoints([]);
      return;
    }
    
    setSelectedJoinPoints([point]);
  }, [eraseMode, readOnly, isAngleMode, isPointSelected, selectedJoinPoints, segments, currentJoinMode, onSegmentsChange]);

  /**
   * Handle chart container pointer down event.
   */
  const handleChartContainerPointerDown = useCallback((e: React.PointerEvent) => {
    if (readOnly) return;
    
    pointerStartedOnPointRef.current = false;
    pointerStartedOnLineRef.current = false;
    
    if (!chartContainerRef.current) return;
    
    const rect = chartContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    if (isAngleMode) return;
    
    if (isJoinModeActive && (currentJoinMode === 'straight' || currentJoinMode === 'curved')) {
      const nearestPoint = findNearestPoint(clickX, clickY, POINT_HIT_RADIUS);
      
      if (nearestPoint) {
        pointerStartedOnPointRef.current = true;
        
        if (eraseMode && !readOnly) {
          const idx = studentPoints.findIndex(p => p.id === nearestPoint.id);
          if (idx !== -1) {
            removePoint(idx);
          }
          return;
        }
        
        const isInDragMode = activeDragPointIdRef.current === nearestPoint.id;
        
        if (isInDragMode && !readOnly) {
          try {
            (e.target as Element).setPointerCapture(e.pointerId);
          } catch {}
          
          dragStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
          isDraggingRef.current = false;
          setDraggingPointId(nearestPoint.id || null);
          setDraggingPosition({ x: nearestPoint.x, y: nearestPoint.y });
          return;
        }
        
        const now = Date.now();
        const lastTap = lastTapRef.current;
        const timeDiff = now - lastTap.time;
        const isSamePoint = lastTap.pointId === nearestPoint.id;
        const distanceMoved = Math.sqrt(Math.pow(e.clientX - lastTap.x, 2) + Math.pow(e.clientY - lastTap.y, 2));
        
        lastTapRef.current = { pointId: nearestPoint.id || null, time: now, x: e.clientX, y: e.clientY };
        
        const isAlreadySelected = isPointSelected(nearestPoint);
        
        if (isAlreadySelected) {
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
          
          if (!segmentExists && (currentJoinMode === 'straight' || currentJoinMode === 'curved')) {
            const newSegment: LineSegment = {
              id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              from: { x: fromPoint.x, y: fromPoint.y },
              to: { x: toPoint.x, y: toPoint.y },
              mode: currentJoinMode,
            };
            onSegmentsChange([...segments, newSegment]);
          }
          
          setSelectedJoinPoints([]);
          lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
          return;
        }
        
        setSelectedJoinPoints([nearestPoint]);
        return;
      }
      
      if (selectedJoinPoints.length > 0) {
        setSelectedJoinPoints([]);
      }
      return;
    }
    
    if (selectedJoinPoints.length > 0) {
      setSelectedJoinPoints([]);
      return;
    }

    const plotWidth = chartContainerSize.width - chartMargins.left - chartMargins.right;
    const plotHeight = chartContainerSize.height - chartMargins.top - chartMargins.bottom;

    if (clickX < chartMargins.left || clickX > chartContainerSize.width - chartMargins.right ||
        clickY < chartMargins.top || clickY > chartContainerSize.height - chartMargins.bottom) {
      return;
    }

    const nearbyPoint = findNearestPoint(clickX, clickY, POINT_HIT_RADIUS);
    if (nearbyPoint) {
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
        }
        lastTapRef.current = { pointId: null, time: 0, x: 0, y: 0 };
      }
      return;
    }

    const dataX = domainX[0] + ((clickX - chartMargins.left) / plotWidth) * (domainX[1] - domainX[0]);
    const dataY = domainY[0] + ((1 - (clickY - chartMargins.top) / plotHeight)) * (domainY[1] - domainY[0]);

    addPoint(dataX, dataY);
  }, [readOnly, selectedJoinPoints, chartContainerSize, chartMargins, domainX, domainY, addPoint, isJoinModeActive, findNearestPoint, isPointSelected, segments, currentJoinMode, onSegmentsChange, activeDragPointId, eraseMode, isAngleMode, studentPoints, removePoint, POINT_HIT_RADIUS]);

  /**
   * Handle chart container pointer up event.
   */
  const handleChartContainerPointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerStartedOnPointRef.current || pointerStartedOnLineRef.current) {
      pointerStartedOnPointRef.current = false;
      pointerStartedOnLineRef.current = false;
      return;
    }
    
    // Click on empty space exits drag mode
    if (activeDragPointId && !draggingPointId) {
      setActiveDragPointId(null);
    }
  }, [activeDragPointId, draggingPointId]);

  /**
   * Handle chart container pointer cancel event.
   */
  const handleChartContainerPointerCancel = useCallback(() => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    setDraggingPointId(null);
    setDraggingPosition(null);
    pointerStartedOnPointRef.current = false;
    pointerStartedOnLineRef.current = false;
  }, []);

  /**
   * Handle segment erase.
   */
  const handleSegmentErase = useCallback((segmentId: string) => {
    if (!eraseMode || readOnly) return;
    onSegmentsChange(segments.filter(s => s.id !== segmentId));
  }, [eraseMode, readOnly, segments, onSegmentsChange]);

  /**
   * Get point marking status.
   */
  const getPointStatus = useCallback((point: GraphPoint): 'correct' | 'incorrect' | 'unmarked' => {
    if (!showCorrectAnswers || !markingData?.perPointResults) return 'unmarked';
    
    const result = markingData.perPointResults.find(
      r => r.studentPoint?.x === point.x && r.studentPoint?.y === point.y
    );
    
    return result?.matched ? 'correct' : 'incorrect';
  }, [showCorrectAnswers, markingData]);

  /**
   * Custom dot renderer for points.
   */
  const renderDot = useCallback((props: any) => {
    const { cx, cy, payload } = props;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;

    const point = payload as GraphPoint;
    const status = getPointStatus(point);
    const isSelected = isPointSelected(point);
    const isDragging = draggingPointId === point.id;
    const isInDragMode = activeDragPointId === point.id;
    
    let displayCx = cx;
    let displayCy = cy;
    if (isDragging && draggingPosition) {
      const { px, py } = dataToPixel(draggingPosition.x, draggingPosition.y);
      displayCx = px;
      displayCy = py;
    }
    
    let fillColor = subjectColor;
    if (showCorrectAnswers) {
      if (status === 'correct') fillColor = 'hsl(var(--success, 142 76% 36%))';
      else if (status === 'incorrect') fillColor = 'hsl(var(--destructive))';
    }

    const visualRadius = isSelected || isDragging || isInDragMode ? 10 : 8;
    const hitRadius = isInDragMode ? Math.max(POINT_HIT_RADIUS, 48) : 20;
    
    return (
      <g 
        key={`point-${point.id || `${point.x}-${point.y}`}`}
        style={{ 
          cursor: readOnly ? 'default' : eraseMode ? 'pointer' : isDragging ? 'grabbing' : isInDragMode ? 'grab' : 'pointer', 
          touchAction: 'none',
        }}
        pointerEvents="all"
      >
        <circle
          cx={displayCx}
          cy={displayCy}
          r={hitRadius}
          fill="hsl(var(--foreground))"
          fillOpacity={0.001}
          stroke="none"
          pointerEvents="all"
          style={{ touchAction: 'none', cursor: isInDragMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
          onPointerDown={(e) => handlePointPointerDown(point, e)}
          onPointerMove={handlePointPointerMove}
          onPointerUp={(e) => handlePointPointerUp(point, e)}
          onPointerCancel={(e) => {
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
        
        <circle
          cx={displayCx}
          cy={displayCy}
          r={visualRadius}
          fill={isDragging || isInDragMode ? 'hsl(var(--primary))' : fillColor}
          stroke="white"
          strokeWidth={2}
        />
        
        <title>{`(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`}</title>
      </g>
    );
  }, [subjectColor, showCorrectAnswers, getPointStatus, isPointSelected, readOnly, 
      handlePointPointerDown, handlePointPointerMove, handlePointPointerUp, 
      draggingPointId, draggingPosition, dataToPixel, activeDragPointId, eraseMode, POINT_HIT_RADIUS]);

  const activeDragPoint = findPointById(activeDragPointId);

  // Missed expected points for review mode
  const missedPoints = useMemo(() => {
    if (!showCorrectAnswers || !markingData?.perPointResults) return [];
    return markingData.perPointResults
      .filter(r => r.status === 'missed' && r.expectedPoint)
      .map(r => r.expectedPoint);
  }, [showCorrectAnswers, markingData]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-4 flex flex-col gap-3"
        hideCloseButton
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">Graph Focus Mode</DialogTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="gap-2"
          >
            <Minimize2 className="h-4 w-4" />
            Exit
          </Button>
        </DialogHeader>

        {/* Toolbar */}
        {!readOnly && (
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2 border-b pb-3">
            <Button
              variant="outline"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={onClearAll}
              disabled={!canClear}
              title="Clear all"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            
            <Button
              variant={eraseMode ? "default" : "outline"}
              size="icon"
              onClick={() => {
                setEraseMode(!eraseMode);
                setActiveDragPointId(null);
              }}
              title={eraseMode ? "Exit erase mode" : "Erase mode"}
              className={eraseMode ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              <Eraser className="h-4 w-4" />
            </Button>

            {isJoinModeEnabled && onJoinModeChange && (
              <ToggleGroup
                type="single"
                value={currentJoinMode || ''}
                onValueChange={(value) => {
                  setActiveDragPointId(null);
                  
                  if (value === '' || value === currentJoinMode) {
                    onJoinModeChange(null);
                    setSelectedJoinPoints([]);
                    if (onSelectedSegmentIdsChange) {
                      onSelectedSegmentIdsChange([]);
                    }
                  } else if (value === 'straight' || value === 'curved' || value === 'freeform' || value === 'angle') {
                    onJoinModeChange(value);
                    setSelectedJoinPoints([]);
                    if (onSelectedSegmentIdsChange) {
                      onSelectedSegmentIdsChange([]);
                    }
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
          <p className="flex-shrink-0 text-sm text-muted-foreground">
            {eraseMode ? (
              'Tap a point, line, or angle label to delete it. Tap the eraser icon again to exit.'
            ) : activeDragPoint ? (
              `Drag mode active for (${activeDragPoint.x.toFixed(1)}, ${activeDragPoint.y.toFixed(1)}). Drag to move, tap the point or empty space to exit.`
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
                `Point (${selectedJoinPoints[0].x.toFixed(1)}, ${selectedJoinPoints[0].y.toFixed(1)}) selected. Tap another point to connect.`
              ) : (
                'Creating segment...'
              )
            ) : (
              'Tap to plot points (1dp). Double-tap a point to enable drag mode.'
            )}
          </p>
        )}

        {/* Chart - takes remaining space */}
        <div 
          ref={chartContainerRef}
          className="flex-1 relative w-full border rounded-lg bg-card min-h-0"
          onPointerDown={handleChartContainerPointerDown}
          onPointerMove={handlePointPointerMove}
          onPointerUp={handleChartContainerPointerUp}
          onPointerCancel={handleChartContainerPointerCancel}
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
                tick={{ fill: 'hsl(var(--foreground))' }}
                stroke="hsl(var(--foreground))"
              />
              
              <ZAxis range={[100, 100]} />

              {/* Origin axes */}
              {domainX[0] <= 0 && domainX[1] >= 0 && (
                <ReferenceLine x={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
              )}
              {domainY[0] <= 0 && domainY[1] >= 0 && (
                <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
              )}

              {/* Reference series (given curves) */}
              {referenceSeries.map((series, idx) => {
                if (!series.data || series.data.length < 2) return null;
                const validData = series.data.filter(p => Number.isFinite(p.y));
                if (validData.length < 2) return null;
                
                return (
                  <Line
                    key={`ref-${series.id || idx}`}
                    type="monotone"
                    data={validData}
                    dataKey="y"
                    stroke={series.color || 'hsl(var(--muted-foreground))'}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name={series.label || `Reference ${idx + 1}`}
                    connectNulls={false}
                  />
                );
              })}

              <Scatter
                name="Points"
                data={studentPoints}
                fill={subjectColor}
                shape={renderDot}
                isAnimationActive={false}
              />

              {/* Missed expected points */}
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

              {/* Expected answer curve in review mode */}
              {showCorrectAnswers && expectedCurveSeries.map((series, idx) => {
                if (!series.data || series.data.length < 2) return null;
                const validData = series.data.filter(p => Number.isFinite(p.y));
                if (validData.length < 2) return null;
                
                return (
                  <Line
                    key={`expected-curve-${series.id || idx}`}
                    type="monotone"
                    data={validData}
                    dataKey="y"
                    stroke="hsl(var(--success, 142 76% 36%))"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                    name={`Expected: ${series.label || `Curve ${idx + 1}`}`}
                    connectNulls={false}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Segments overlay */}
          {segments.length > 0 && (() => {
            const measurementSegmentIds = new Set<string>();
            angleMeasurements.forEach(m => {
              measurementSegmentIds.add(m.segmentId1);
              measurementSegmentIds.add(m.segmentId2);
            });
            
            const allHighlightedSegmentIds = isAngleMode 
              ? [...new Set([...measurementSegmentIds, ...selectedSegmentIds])]
              : [];
            
            return (
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
                selectedSegmentIds={allHighlightedSegmentIds}
            onSegmentSelect={eraseMode ? handleSegmentErase : isAngleMode ? handleAngleSegmentSelect : undefined}
            onPointerStartedOnSegment={(eraseMode || isAngleMode) ? () => {
              pointerStartedOnLineRef.current = true;
            } : undefined}
          />
        );
      })()}

      {/* Freeform drawing canvas overlay */}
      {isJoinModeEnabled && onDrawnPathsChange && currentJoinMode === 'freeform' && (
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
              domainX={domainX}
              domainY={domainY}
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

          {/* Persisted angle measurements */}
          {angleMeasurements.map((measurement) => (
            <AngleMeasurementOverlay
              key={measurement.id}
              segments={segments}
              selectedSegmentIds={[measurement.segmentId1, measurement.segmentId2]}
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
              measurementId={measurement.id}
              onErase={eraseMode ? handleAngleMeasurementErase : undefined}
              labelOffset={measurement.labelOffset}
              onLabelOffsetChange={handleAngleLabelOffsetChange}
              readOnly={readOnly}
            />
          ))}

          {/* Current selection preview */}
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
              isPreview={true}
            />
          )}

          {/* Drag tooltip */}
          {draggingPointId && draggingPosition && (
            <div 
              className="absolute pointer-events-none z-50"
              style={{
                left: dataToPixel(draggingPosition.x, draggingPosition.y).px,
                top: dataToPixel(draggingPosition.x, draggingPosition.y).py - 40,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="bg-popover text-popover-foreground border rounded px-2 py-1 text-sm shadow-lg font-mono whitespace-nowrap">
                ({draggingPosition.x.toFixed(1)}, {draggingPosition.y.toFixed(1)})
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between border-t pt-3">
          <p className="text-sm text-muted-foreground">
            {studentPoints.length} point{studentPoints.length !== 1 ? 's' : ''} plotted
            {segments.length > 0 && ` • ${segments.length} segment${segments.length !== 1 ? 's' : ''}`}
          </p>
          <Button onClick={onClose} className="gap-2">
            <Check className="h-4 w-4" />
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ExpandedGraphModal;
