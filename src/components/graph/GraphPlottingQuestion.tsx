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
import { Undo2, Trash2, Minus, Spline, Pencil } from 'lucide-react';
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

interface GraphPlottingQuestionProps {
  config: GraphPlottingConfig;
  expectedAnswer?: GraphPlottingAnswer;
  studentPoints: GraphPoint[];
  onPointsChange: (points: GraphPoint[]) => void;
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: GraphPlottingMarkingResult;
  subjectColor?: string;
  joinMode?: 'straight' | 'curved' | 'freeform';
  onJoinModeChange?: (mode: 'straight' | 'curved' | 'freeform') => void;
  segments: LineSegment[];
  onSegmentsChange: (segments: LineSegment[]) => void;
  drawnPaths?: DrawingPath[];
  onDrawnPathsChange?: (paths: DrawingPath[]) => void;
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
  segments,
  onSegmentsChange,
  drawnPaths = [],
  onDrawnPathsChange,
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
  const isJoinModeEnabled = config.joinPointsMode?.enabled ?? false;
  const currentJoinMode = joinMode || config.joinPointsMode?.defaultMode || 'straight';

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
  const handlePointClick = useCallback((point: GraphPoint, e: React.PointerEvent | React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();

    if (!isJoinModeEnabled) {
      // Remove point
      setPointsHistory(prev => [...prev, studentPoints]);
      onPointsChange(studentPoints.filter(p => p.x !== point.x || p.y !== point.y));
      return;
    }

    // Join mode is enabled
    const isAlreadySelected = isPointSelected(point);

    if (isAlreadySelected) {
      // Deselect
      setSelectedJoinPoints(prev => prev.filter(p => p.x !== point.x || p.y !== point.y));
    } else {
      // Select
      if (selectedJoinPoints.length === 0) {
        // First point selected
        setSelectedJoinPoints([point]);
      } else if (selectedJoinPoints.length === 1) {
        // Second point selected - create segment
        const fromPoint = selectedJoinPoints[0];
        const toPoint = point;
        
        // Check if segment already exists (in either direction)
        const segmentExists = segments.some(s => 
          (s.from.x === fromPoint.x && s.from.y === fromPoint.y && s.to.x === toPoint.x && s.to.y === toPoint.y) ||
          (s.from.x === toPoint.x && s.from.y === toPoint.y && s.to.x === fromPoint.x && s.to.y === fromPoint.y)
        );

        if (!segmentExists && currentJoinMode !== 'freeform') {
          const newSegment: LineSegment = {
            id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            from: { x: fromPoint.x, y: fromPoint.y },
            to: { x: toPoint.x, y: toPoint.y },
            mode: currentJoinMode as 'straight' | 'curved',
          };
          onSegmentsChange([...segments, newSegment]);
        }

        // Clear selection
        setSelectedJoinPoints([]);
      }
    }
  }, [readOnly, isJoinModeEnabled, selectedJoinPoints, isPointSelected, studentPoints, segments, currentJoinMode, onPointsChange, onSegmentsChange]);

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
   * Handle click on the chart background to add a point.
   * Only adds points if NOT in "point selection" mode (no points selected for joining).
   */
  const handleChartContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    
    // Don't add points if we're selecting points for joining
    if (selectedJoinPoints.length > 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert pixel to data coordinates
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
  }, [readOnly, selectedJoinPoints, chartContainerSize, chartMargins, domainX, domainY, addPoint]);

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

    // Larger touch target for mobile
    const touchRadius = 20;
    const visualRadius = isSelected ? 10 : 8;

    return (
      <g 
        key={`point-${point.x}-${point.y}`}
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
      >
        {/* Invisible larger touch target */}
        <circle
          cx={cx}
          cy={cy}
          r={touchRadius}
          fill="transparent"
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
              value={currentJoinMode}
              onValueChange={(value) => {
                if (value === 'straight' || value === 'curved' || value === 'freeform') {
                  onJoinModeChange(value);
                  // Clear selection when switching modes
                  setSelectedJoinPoints([]);
                }
              }}
              className="ml-auto"
            >
              <ToggleGroupItem value="straight" aria-label="Straight lines">
                <Minus className="h-4 w-4 mr-1" />
                Straight
              </ToggleGroupItem>
              <ToggleGroupItem value="curved" aria-label="Curved lines">
                <Spline className="h-4 w-4 mr-1" />
                Curved
              </ToggleGroupItem>
              <ToggleGroupItem value="freeform" aria-label="Freeform drawing">
                <Pencil className="h-4 w-4 mr-1" />
                Freeform
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
      )}

      {/* Helper text */}
      {!readOnly && (
        <p className="text-sm text-muted-foreground">
          {isJoinModeEnabled ? (
            currentJoinMode === 'freeform' ? (
              'Click and drag on the graph to draw lines. Click on empty space to add points.'
            ) : selectedJoinPoints.length === 0 ? (
              `Click to add points. To connect points: tap first point, then tap second point to create a ${currentJoinMode} segment.`
            ) : selectedJoinPoints.length === 1 ? (
              `Point selected at (${selectedJoinPoints[0].x}, ${selectedJoinPoints[0].y}). Tap another point to connect, or tap the same point to cancel.`
            ) : (
              'Creating segment...'
            )
          ) : (
            'Click on the graph to plot points. Click a point to remove it.'
          )}
        </p>
      )}

      {/* Chart */}
      <div 
        ref={chartContainerRef}
        className="relative w-full aspect-[4/3] border rounded-lg bg-card overflow-hidden"
        onClick={handleChartContainerClick}
        style={{ cursor: readOnly ? 'default' : 'crosshair' }}
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
            stroke="hsl(var(--primary))"
            strokeWidth={2}
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
            active={currentJoinMode === 'freeform'}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
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
