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
import { Undo2, Trash2, Minus, Spline, Pencil, Ruler } from 'lucide-react';
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
  
  // History for undo
  const [pointsHistory, setPointsHistory] = useState<GraphPoint[][]>([]);
  
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

  // Double-tap detection for point REMOVAL (not selection)
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

  // Reset internal state when question changes (navigation/retry)
  useEffect(() => {
    setSelectedJoinPoints([]);
    lastTapRef.current = { point: null, time: 0, x: 0, y: 0 };
    pointerStartedOnPointRef.current = false;
    pointerStartedOnLineRef.current = false;
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
   * Snap a coordinate to the grid step.
   */
  const snapPoint = useCallback((x: number, y: number): GraphPoint => {
    const stepX = config.stepX ?? 1;
    const stepY = config.stepY ?? 1;
    const snappedX = Math.round(x / stepX) * stepX;
    const snappedY = Math.round(y / stepY) * stepY;
    return { 
      x: Math.round(snappedX * 1000) / 1000, 
      y: Math.round(snappedY * 1000) / 1000 
    };
  }, [config.stepX, config.stepY]);

  /**
   * Check if a point is currently selected for joining.
   */
  const isPointSelected = useCallback((point: GraphPoint): boolean => {
    return selectedJoinPoints.some(p => p.x === point.x && p.y === point.y);
  }, [selectedJoinPoints]);

  /**
   * Handle click on an existing point.
   * - If not in join mode: remove the point
   * - If in join mode: select/deselect for joining
   */
  /**
   * Handle pointer down on an existing point.
   * Uses SINGLE-TAP for selection (more reliable and intuitive).
   * - Single-tap on unselected point with no selection: SELECT it (show ring immediately)
   * - Single-tap on different point when one is selected: CREATE segment and clear selection
   * - Single-tap on already selected point: DESELECT it
   * - Double-tap in non-join mode: REMOVE point
   */
  const handlePointClick = useCallback((point: GraphPoint, e: React.PointerEvent | React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault(); // Prevent double-firing on touch
    
    // Mark that this pointer event started on a point (prevents container from clearing selection)
    pointerStartedOnPointRef.current = true;

    const now = Date.now();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    const lastTap = lastTapRef.current;
    
    // Check if this is a double-tap on the same point (only used for point removal in non-join mode)
    const timeDiff = now - lastTap.time;
    const isSamePoint = lastTap.point && lastTap.point.x === point.x && lastTap.point.y === point.y;
    const distanceMoved = Math.sqrt(
      Math.pow(clientX - lastTap.x, 2) + Math.pow(clientY - lastTap.y, 2)
    );
    const isDoubleTap = isSamePoint && timeDiff < DOUBLE_TAP_THRESHOLD && distanceMoved < DOUBLE_TAP_DISTANCE;

    // Update last tap reference
    lastTapRef.current = { point, time: now, x: clientX, y: clientY };

    if (!isJoinModeActive) {
      // Not in active join mode: double-tap removes point
      if (isDoubleTap) {
        setPointsHistory(prev => [...prev, studentPoints]);
        onPointsChange(studentPoints.filter(p => p.x !== point.x || p.y !== point.y));
        lastTapRef.current = { point: null, time: 0, x: 0, y: 0 };
      }
      // Single tap does nothing in non-join mode (prevents accidental removal)
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
  }, [readOnly, isJoinModeActive, selectedJoinPoints, isPointSelected, studentPoints, segments, currentJoinMode, onPointsChange, onSegmentsChange, axisScales]);

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
    setPointsHistory(prev => [...prev, studentPoints]);
    onPointsChange([...studentPoints, snapped]);
  }, [readOnly, config.maxPoints, studentPoints, snapPoint, onPointsChange]);

  /**
   * Remove a point by index.
   */
  const removePoint = useCallback((index: number) => {
    if (readOnly) return;
    
    const pointToRemove = studentPoints[index];
    
    // Save to history
    setPointsHistory(prev => [...prev, studentPoints]);
    
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
  }, [readOnly, studentPoints, segments, onPointsChange, onSegmentsChange]);

  /**
   * Remove a segment by id.
   */
  const removeSegment = useCallback((segmentId: string) => {
    if (readOnly) return;
    onSegmentsChange(segments.filter(s => s.id !== segmentId));
  }, [readOnly, segments, onSegmentsChange]);

  /**
   * Undo the last action.
   */
  const undo = useCallback(() => {
    if (pointsHistory.length === 0) return;
    const previousPoints = pointsHistory[pointsHistory.length - 1];
    setPointsHistory(prev => prev.slice(0, -1));
    onPointsChange(previousPoints);
  }, [pointsHistory, onPointsChange]);

  /**
   * Clear all points and segments.
   */
  const clearAll = useCallback(() => {
    if (readOnly) return;
    setPointsHistory(prev => [...prev, studentPoints]);
    onPointsChange([]);
    onSegmentsChange([]);
    onDrawnPathsChange?.([]);
    setSelectedJoinPoints([]);
  }, [readOnly, studentPoints, onPointsChange, onSegmentsChange, onDrawnPathsChange]);

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
   * Find the nearest point within a given pixel radius.
   * Returns the point if found, null otherwise.
   */
  const findNearestPoint = useCallback((clickPixelX: number, clickPixelY: number, maxDistancePx: number = 30): GraphPoint | null => {
    let nearestPoint: GraphPoint | null = null;
    let nearestDistance = maxDistancePx;
    
    for (const point of studentPoints) {
      const { px, py } = dataToPixel(point.x, point.y);
      const distance = Math.sqrt(Math.pow(clickPixelX - px, 2) + Math.pow(clickPixelY - py, 2));
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = point;
      }
    }
    
    return nearestPoint;
  }, [studentPoints, dataToPixel]);

  /**
   * Handle pointer up on the chart background to add a point.
   * Only adds points if NOT in "point selection" mode (no points selected for joining).
   * Also clears selection if clicking on empty space (but not if the click started on a point).
   * 
   * NEW: Also performs distance-based hit-testing to select points near edges that might
   * have their touch targets clipped.
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
        
        // Check for double-tap (for removal)
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
  }, [readOnly, selectedJoinPoints, chartContainerSize, chartMargins, domainX, domainY, addPoint, isJoinModeActive, findNearestPoint, isPointSelected, segments, currentJoinMode, onSegmentsChange]);

  /**
   * Custom dot renderer for points.
   */
  const renderDot = useCallback((props: any) => {
    const { cx, cy, payload } = props;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;

    const point = payload as GraphPoint;
    const status = getPointStatus(point);
    const isSelected = isPointSelected(point);
    
    // Determine fill color based on status
    let fillColor = subjectColor;
    if (showCorrectAnswers) {
      if (status === 'correct') fillColor = 'hsl(var(--success, 142 76% 36%))';
      else if (status === 'incorrect') fillColor = 'hsl(var(--destructive))';
    }

    // Larger touch target for mobile (24px radius for easier tapping on iPad/iPhone)
    const HIT_RADIUS = 24;
    const visualRadius = isSelected ? 10 : 8;

    return (
      <g 
        key={`point-${point.x}-${point.y}`}
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
      >
        {/* Invisible larger touch target for iPad/iPhone friendly tapping */}
        <circle
          cx={cx}
          cy={cy}
          r={HIT_RADIUS}
          fill="transparent"
          stroke="transparent"
          pointerEvents="all"
          onPointerDown={(e) => handlePointClick(point, e)}
        />
        
        {/* Selection ring */}
        {isSelected && (
          <circle
            cx={cx}
            cy={cy}
            r={visualRadius + 4}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}
        
        {/* Visible point */}
        <circle
          cx={cx}
          cy={cy}
          r={visualRadius}
          fill={fillColor}
          stroke="white"
          strokeWidth={2}
        />
        
        {/* Tooltip on hover */}
        <title>{`(${point.x}, ${point.y})`}</title>
      </g>
    );
  }, [subjectColor, showCorrectAnswers, getPointStatus, isPointSelected, readOnly, handlePointClick]);

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
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={pointsHistory.length === 0}
          >
            <Undo2 className="h-4 w-4 mr-1" />
            Undo
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={studentPoints.length === 0 && segments.length === 0 && drawnPaths.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
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
        {isAngleMode ? (
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
              `Point (${selectedJoinPoints[0].x}, ${selectedJoinPoints[0].y}) selected. Tap another point to connect.`
            ) : (
              'Creating segment...'
            )
          ) : (
            'Click on the graph to plot points. Double-tap a point to remove it.'
          )}
        </p>
      )}

      {/* Chart */}
      <div 
        ref={chartContainerRef}
        className="relative w-full aspect-[4/3] border rounded-lg bg-card"
        onPointerUp={handleChartContainerPointerUp}
        style={{ cursor: readOnly ? 'default' : 'crosshair', touchAction: 'none', overflow: 'visible' }}
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
              label={{ 
                value: config.xLabel || 'X', 
                position: 'insideBottom', 
                offset: -10,
                style: { fill: 'hsl(var(--foreground))' }
              }}
              stroke="hsl(var(--foreground))"
            />
            
            <YAxis
              type="number"
              dataKey="y"
              domain={domainY}
              tickCount={Math.min(11, domainY[1] - domainY[0] + 1)}
              label={{ 
                value: config.yLabel || 'Y', 
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
                  <div className="bg-popover text-popover-foreground border rounded px-2 py-1 text-sm shadow-md">
                    ({point.x}, {point.y})
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
            onSegmentSelect={isAngleMode ? (segId) => {
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
            onPointerStartedOnSegment={isAngleMode ? () => {
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
                  ({seg.from.x}, {seg.from.y}) → ({seg.to.x}, {seg.to.y})
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
                  <span>({point.x}, {point.y})</span>
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
