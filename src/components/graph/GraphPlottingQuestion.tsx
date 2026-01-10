// Graph Plotting Question Component
// Interactive scatter plot where students can add/drag/remove points
// With segment-based joining: select two points to join them
// Uses Pointer Events for cross-device compatibility (iPad Safari, mobile, desktop)

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
  ComposedChart,
  Scatter
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trash2, Undo2, TrendingUp, Spline, X } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type {
  GraphPlottingConfig,
  GraphPoint,
  GraphPlottingAnswer,
  GraphPlottingMarkingResult,
  LineSegment
} from './types';
import { GraphSegmentsLayer } from './GraphSegmentsLayer';

interface GraphPlottingQuestionProps {
  config: GraphPlottingConfig;
  expectedAnswer: GraphPlottingAnswer;
  studentPoints: GraphPoint[];
  onPointsChange: (points: GraphPoint[]) => void;
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: GraphPlottingMarkingResult;
  subjectColor?: string;
  // Join mode props
  joinMode?: 'straight' | 'curved';
  onJoinModeChange?: (mode?: 'straight' | 'curved') => void;
  // Segments state (for persistence)
  segments?: LineSegment[];
  onSegmentsChange?: (segments: LineSegment[]) => void;
}

// Status colors matching table logic
const statusColors = {
  correct: '#22c55e',
  incorrect: '#ef4444',
  missed: '#f97316',
  neutral: '#3b82f6'
};

export function GraphPlottingQuestion({
  config,
  expectedAnswer,
  studentPoints,
  onPointsChange,
  readOnly = false,
  showCorrectAnswers = false,
  markingData,
  subjectColor = '#3B82F6',
  joinMode,
  onJoinModeChange,
  segments: externalSegments,
  onSegmentsChange
}: GraphPlottingQuestionProps) {
  const chartRef = useRef<any>(null);
  const [history, setHistory] = useState<GraphPoint[][]>([]);
  // Timestamp of the last pointer interaction; used to ignore iPad Safari synthetic clicks
  const lastPointerTimeRef = useRef<number>(0);
  const POINTER_GUARD_MS = 500;
  
  // Internal segment state (single source of truth for rendering)
  const [segments, setSegmentsState] = useState<LineSegment[]>(externalSegments ?? []);

  useEffect(() => {
    // Hydrate/rehydrate from parent when provided (e.g., navigation, drafts)
    if (externalSegments) {
      setSegmentsState(externalSegments);
    }
  }, [externalSegments]);

  const setSegments = useCallback(
    (next: LineSegment[]) => {
      setSegmentsState(next);
      onSegmentsChange?.(next);
    },
    [onSegmentsChange]
  );
  
  // Selected points for joining (max 2)
  const [selectedJoinPoints, setSelectedJoinPoints] = useState<GraphPoint[]>([]);

  const {
    xLabel,
    yLabel,
    domainX = [-10, 10],
    domainY = [-10, 10],
    snapToGrid = true,
    stepX = 1,
    stepY = 1,
    maxPoints,
    joinPointsMode
  } = config;

  // Determine if join mode is enabled - default to "none" (no mode selected initially)
  const isJoinModeEnabled = joinPointsMode?.enabled ?? false;
  // Current join mode: 'none' | 'straight' | 'curved'
  const currentJoinMode = joinMode ?? 'none';

  // Sort points by x for display
  const sortedPoints = useMemo(() => {
    return [...studentPoints].sort((a, b) => a.x - b.x);
  }, [studentPoints]);

  // Snap point to grid if enabled
  const snapPoint = useCallback((x: number, y: number): GraphPoint => {
    if (!snapToGrid) return { x, y };
    return {
      x: Math.round(x / stepX) * stepX,
      y: Math.round(y / stepY) * stepY
    };
  }, [snapToGrid, stepX, stepY]);

  // Check if a point is in the selected join points list
  const isPointSelected = useCallback((point: GraphPoint): boolean => {
    return selectedJoinPoints.some(p => p.x === point.x && p.y === point.y);
  }, [selectedJoinPoints]);

  // Handle point click - either toggle plot/unplot OR select for joining
  const handlePointClick = useCallback((point: GraphPoint, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    
    // If join mode is active (straight or curved), select points for joining
    if (currentJoinMode !== 'none') {
      // Check if point is already selected
      const alreadySelected = selectedJoinPoints.findIndex(p => p.x === point.x && p.y === point.y);
      
      if (alreadySelected !== -1) {
        // Deselect the point
        setSelectedJoinPoints(prev => prev.filter((_, i) => i !== alreadySelected));
      } else if (selectedJoinPoints.length < 2) {
        // Add to selection
        const newSelection = [...selectedJoinPoints, point];
        setSelectedJoinPoints(newSelection);
        
        // If we now have 2 points, create a segment
        if (newSelection.length === 2) {
          const newSegment: LineSegment = {
            id: `seg-${Date.now()}`,
            from: newSelection[0],
            to: newSelection[1],
            mode: currentJoinMode as 'straight' | 'curved'
          };
          setSegments([...segments, newSegment]);

          // Keep the second point selected so the student can keep joining in a chain
          setSelectedJoinPoints([newSelection[1]]);
        }
      }
    } else {
      // No join mode - toggle point (remove it)
      const existingIndex = studentPoints.findIndex(p => p.x === point.x && p.y === point.y);
      if (existingIndex !== -1) {
        setHistory(prev => [...prev, studentPoints]);
        const newPoints = studentPoints.filter((_, i) => i !== existingIndex);
        onPointsChange(newPoints);
        
        // Remove any segments that reference this point
        const newSegments = segments.filter(
          seg => !(seg.from.x === point.x && seg.from.y === point.y) &&
                 !(seg.to.x === point.x && seg.to.y === point.y)
        );
        if (newSegments.length !== segments.length) {
          setSegments(newSegments);
        }
        
        // If points become empty, clear selected join points too
        if (newPoints.length === 0) {
          setSelectedJoinPoints([]);
        }
      }
    }
  }, [readOnly, currentJoinMode, selectedJoinPoints, studentPoints, segments, onPointsChange, setSegments]);

  // Add a point (only called when clicking empty space)
  const addPoint = useCallback((x: number, y: number) => {
    if (readOnly) return;

    const snapped = snapPoint(x, y);
    
    // Check if point already exists at this position
    const existingIndex = studentPoints.findIndex(p => p.x === snapped.x && p.y === snapped.y);
    if (existingIndex !== -1) {
      // Point exists - if no join mode, remove it (toggle behavior)
      if (currentJoinMode === 'none') {
        setHistory(prev => [...prev, studentPoints]);
        const newPoints = studentPoints.filter((_, i) => i !== existingIndex);
        onPointsChange(newPoints);
        
        // Remove segments referencing this point
        const newSegments = segments.filter(
          seg => !(seg.from.x === snapped.x && seg.from.y === snapped.y) &&
                 !(seg.to.x === snapped.x && seg.to.y === snapped.y)
        );
        if (newSegments.length !== segments.length) {
          setSegments(newSegments);
        }
        
        if (newPoints.length === 0) {
          setSelectedJoinPoints([]);
        }
      }
      return;
    }
    
    // Check max points limit (only when adding new point)
    if (maxPoints && studentPoints.length >= maxPoints) return;

    setHistory(prev => [...prev, studentPoints]);
    onPointsChange([...studentPoints, snapped]);
  }, [readOnly, maxPoints, studentPoints, snapPoint, onPointsChange, currentJoinMode, segments, setSegments]);

  // Remove a point by index
  const removePoint = useCallback((index: number) => {
    if (readOnly) return;
    const point = studentPoints[index];
    setHistory(prev => [...prev, studentPoints]);
    const newPoints = studentPoints.filter((_, i) => i !== index);
    onPointsChange(newPoints);
    
    // Remove segments referencing this point
    const newSegments = segments.filter(
      seg => !(seg.from.x === point.x && seg.from.y === point.y) &&
             !(seg.to.x === point.x && seg.to.y === point.y)
    );
    if (newSegments.length !== segments.length) {
      setSegments(newSegments);
    }
    
    // Clear all if empty
    if (newPoints.length === 0) {
      setSelectedJoinPoints([]);
    }
  }, [readOnly, studentPoints, onPointsChange, segments, setSegments]);

  // Undo last action
  const undo = useCallback(() => {
    if (history.length === 0 || readOnly) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    onPointsChange(previous);
  }, [history, readOnly, onPointsChange]);

  // Clear all points and segments
  const clearAll = useCallback(() => {
    if (readOnly || studentPoints.length === 0) return;
    setHistory(prev => [...prev, studentPoints]);
    onPointsChange([]);
    setSegments([]);
    setSelectedJoinPoints([]);
  }, [readOnly, studentPoints, onPointsChange, setSegments]);

  // Get point status from marking data
  const getPointStatus = (point: GraphPoint): 'correct' | 'incorrect' | null => {
    if (!showCorrectAnswers || !markingData) return null;
    
    const result = markingData.perPointResults.find(
      r => r.studentPoint?.x === point.x && r.studentPoint?.y === point.y
    );
    
    return result?.matched ? 'correct' : 'incorrect';
  };

  // Get missed expected points (not matched by any student point)
  const missedPoints = useMemo(() => {
    if (!showCorrectAnswers || !markingData) return [];
    return markingData.perPointResults
      .filter(r => r.status === 'missed')
      .map(r => r.expectedPoint);
  }, [showCorrectAnswers, markingData]);

  // Handle chart click for adding points (only when NOT in join mode or clicking empty space)
  const handleChartContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (readOnly) return;
    
    // In join mode, only allow clicking on existing points (handled by dot click)
    // Container clicks in join mode should be ignored
    if (currentJoinMode !== 'none') {
      return;
    }
    
    // Get click/touch position
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    let clientX: number;
    let clientY: number;
    
    if ('touches' in e) {
      if (e.touches.length === 0) {
        // For touchend, use changedTouches
        const touchEvent = e as React.TouchEvent;
        if (touchEvent.changedTouches && touchEvent.changedTouches.length > 0) {
          clientX = touchEvent.changedTouches[0].clientX;
          clientY = touchEvent.changedTouches[0].clientY;
        } else {
          return;
        }
      } else {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Calculate position relative to container
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    
    // Chart area margins (approximate for recharts)
    const marginLeft = 65;
    const marginRight = 30;
    const marginTop = 30;
    const marginBottom = 50;
    
    const chartWidth = rect.width - marginLeft - marginRight;
    const chartHeight = rect.height - marginTop - marginBottom;
    
    // Check if click is within chart area
    if (relativeX < marginLeft || relativeX > rect.width - marginRight ||
        relativeY < marginTop || relativeY > rect.height - marginBottom) {
      return;
    }
    
    // Calculate data coordinates
    const xRange = domainX[1] - domainX[0];
    const yRange = domainY[1] - domainY[0];
    
    const xFraction = (relativeX - marginLeft) / chartWidth;
    const yFraction = 1 - ((relativeY - marginTop) / chartHeight);
    
    const x = domainX[0] + xFraction * xRange;
    const y = domainY[0] + yFraction * yRange;
    
    addPoint(x, y);
  }, [readOnly, domainX, domainY, addPoint, currentJoinMode]);

  // Custom dot renderer with status colors and selection highlighting
  // Uses onPointerUp ONLY for cross-device compatibility (iPad Safari, mobile, desktop)
  const renderDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (!payload) return null;
    
    const status = getPointStatus(payload);
    const isSelected = isPointSelected(payload);
    const color = status ? statusColors[status] : subjectColor;
    
    // Unified pointer handler - works on touch and mouse
    const handlePointerUp = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Record pointer time so we can ignore the synthetic click that iPad Safari emits after touch
      lastPointerTimeRef.current = Date.now();

      if (!readOnly) {
        handlePointClick(payload, e as unknown as React.MouseEvent);
      }
    };

    const handleClickCapture = (e: React.MouseEvent) => {
      // Ignore synthetic click that can follow a touch/pointer interaction
      if (Date.now() - lastPointerTimeRef.current < POINTER_GUARD_MS) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    return (
      <g key={`dot-${index}`} style={{ pointerEvents: 'auto' }}>
        {/* Selection ring */}
        {isSelected && (
          <circle
            cx={cx}
            cy={cy}
            r={18}
            fill="none"
            stroke={subjectColor}
            strokeWidth={3}
            strokeDasharray="4 2"
          />
        )}
        {/* Larger invisible touch target for mobile - pointer events only */}
        <circle
          cx={cx}
          cy={cy}
          r={24}
          fill="transparent"
          style={{ cursor: readOnly ? 'default' : 'pointer', touchAction: 'none' }}
          onPointerUp={handlePointerUp}
          onClickCapture={handleClickCapture}
        />
        {/* Visible dot */}
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill={color}
          stroke={isSelected ? subjectColor : '#fff'}
          strokeWidth={isSelected ? 3 : 2}
          style={{ pointerEvents: 'none' }}
        />
        {!readOnly && (
          <title>
            {currentJoinMode !== 'none' 
              ? `Tap to ${isSelected ? 'deselect' : 'select'} point (${payload.x}, ${payload.y})`
              : `Tap to remove point (${payload.x}, ${payload.y})`
            }
          </title>
        )}
      </g>
    );
  };

  // Validate config exists
  const hasValidConfig = config && config.xLabel && config.yLabel;

  if (!hasValidConfig) {
    return (
      <div className="border rounded-lg p-6 bg-destructive/10 text-destructive">
        <p className="font-medium">Graph data missing</p>
        <p className="text-sm mt-1">This question was generated without coordinate grid data. Please regenerate the question or contact support.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center justify-between text-sm flex-wrap gap-2">
          <span className="text-muted-foreground">
            Click on the grid to plot points
            {maxPoints && ` (${studentPoints.length}/${maxPoints})`}
          </span>
          <div className="flex gap-2">
            {/* Join Mode Toggle */}
            {isJoinModeEnabled && (
              <ToggleGroup
                type="single"
                value={currentJoinMode === 'none' ? '' : currentJoinMode}
                onValueChange={(val) => {
                  // Allow tapping the active option again to exit join mode (back to plotting)
                  if (!val) {
                    onJoinModeChange?.(undefined);
                    setSelectedJoinPoints([]);
                    return;
                  }

                  onJoinModeChange?.(val as 'straight' | 'curved');
                  // Clear selection when changing mode
                  setSelectedJoinPoints([]);
                }}
                className="border rounded-md"
              >
                <ToggleGroupItem value="straight" aria-label="Straight line" className="gap-1 px-3">
                  <TrendingUp className="w-4 h-4" />
                  Straight
                </ToggleGroupItem>
                <ToggleGroupItem value="curved" aria-label="Curved line" className="gap-1 px-3">
                  <Spline className="w-4 h-4" />
                  Curved
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={history.length === 0}
            >
              <Undo2 className="w-4 h-4 mr-1" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={studentPoints.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Helper text for joining */}
      {!readOnly && isJoinModeEnabled && studentPoints.length >= 2 && currentJoinMode !== 'none' && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          {selectedJoinPoints.length === 1 ? (
            <span>
              Selected ({selectedJoinPoints[0].x}, {selectedJoinPoints[0].y}). Now tap another point to draw a{' '}
              {currentJoinMode} segment (tap the selected point again to cancel).
            </span>
          ) : segments.length > 0 ? (
            <span>
              Tap a plotted point to start another {currentJoinMode} segment. ({segments.length} created so far.)
            </span>
          ) : (
            <span>
              Tap a plotted point to start joining with {currentJoinMode} segments.
            </span>
          )}
        </div>
      )}

      {/* Chart - uses pointer events for cross-device compatibility */}
      <div 
        className="rounded-lg bg-card overflow-hidden"
        style={{ 
          touchAction: readOnly ? 'auto' : 'none',
          cursor: readOnly ? 'default' : (currentJoinMode !== 'none' ? 'pointer' : 'crosshair')
        }}
        onPointerUp={readOnly ? undefined : (e) => {
          // Record pointer time so we can ignore the synthetic click that iPad Safari emits after touch
          lastPointerTimeRef.current = Date.now();
          handleChartContainerClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }}
        onClickCapture={readOnly ? undefined : (e) => {
          if (Date.now() - lastPointerTimeRef.current < POINTER_GUARD_MS) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <ResponsiveContainer width="100%" aspect={1.2}>
          <ComposedChart
            ref={chartRef}
            data={sortedPoints}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="x"
              type="number"
              domain={domainX}
              ticks={Array.from(
                { length: Math.floor((domainX[1] - domainX[0]) / stepX) + 1 },
                (_, i) => domainX[0] + i * stepX
              )}
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
              label={{ value: xLabel, position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={domainY}
              ticks={Array.from(
                { length: Math.floor((domainY[1] - domainY[0]) / stepY) + 1 },
                (_, i) => domainY[0] + i * stepY
              )}
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
              label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
            />
            
            {/* Reference lines at origin */}
            <ReferenceLine x={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
            <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
            
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number) => value.toFixed(1)}
            />
            
            {/* Legend in top-right */}
            {studentPoints.length > 0 && (
              <defs>
                <marker id="dot" markerWidth="4" markerHeight="4" refX="2" refY="2">
                  <circle cx="2" cy="2" r="2" fill={subjectColor} />
                </marker>
              </defs>
            )}
            
            {/* Render line segments as a custom SVG layer so they always draw */}
            <GraphSegmentsLayer segments={segments} stroke={subjectColor} />
            
            {/* Student points */}
            <Scatter
              name="Your points"
              data={studentPoints}
              fill={subjectColor}
              shape={renderDot}
              isAnimationActive={false}
            />
            
            {/* Show expected points in review mode (missed ones) */}
            {showCorrectAnswers && missedPoints.map((point, idx) => (
              <ReferenceDot
                key={`missed-${idx}`}
                x={point.x}
                y={point.y}
                r={8}
                fill="transparent"
                stroke={statusColors.missed}
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Segments list (if any) */}
      {segments.length > 0 && !readOnly && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="text-sm font-medium mb-2">Line segments ({segments.length})</div>
          <div className="flex flex-wrap gap-2">
            {segments.map((seg, idx) => (
              <div 
                key={seg.id}
                className="inline-flex items-center gap-1 bg-background border rounded-full px-2 py-1 text-xs"
              >
                <span>({seg.from.x}, {seg.from.y}) → ({seg.to.x}, {seg.to.y})</span>
                <span className="text-muted-foreground">{seg.mode}</span>
                <button
                  onClick={() => setSegments(segments.filter((_, i) => i !== idx))}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plotted points list */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-16">#</th>
              <th className="px-3 py-2 text-left font-medium">{xLabel}</th>
              <th className="px-3 py-2 text-left font-medium">{yLabel}</th>
              {showCorrectAnswers && <th className="px-3 py-2 text-left font-medium">Status</th>}
              {!readOnly && <th className="px-3 py-2 text-right font-medium w-20">Action</th>}
            </tr>
          </thead>
          <tbody>
            {studentPoints.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="px-3 py-4 text-center text-muted-foreground">
                  No points plotted yet
                </td>
              </tr>
            ) : (
              studentPoints.map((point, idx) => {
                const status = getPointStatus(point);
                return (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{point.x}</td>
                    <td className="px-3 py-2">{point.y}</td>
                    {showCorrectAnswers && (
                      <td className={cn(
                        'px-3 py-2 font-medium',
                        status === 'correct' && 'text-green-600',
                        status === 'incorrect' && 'text-red-600'
                      )}>
                        {status === 'correct' ? '✓ Correct' : '✗ Incorrect'}
                      </td>
                    )}
                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePoint(idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
            {/* Show missed expected points in review mode */}
            {showCorrectAnswers && missedPoints.map((point, idx) => (
              <tr key={`missed-${idx}`} className="border-t bg-orange-50 dark:bg-orange-900/20">
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2">{point.x}</td>
                <td className="px-3 py-2">{point.y}</td>
                <td className="px-3 py-2 font-medium text-orange-600">
                  ○ Missed
                </td>
                {!readOnly && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Score summary in review mode */}
      {showCorrectAnswers && markingData && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <span className="text-sm font-medium">
            Score: {markingData.totalScore} / {markingData.totalMarks} marks
          </span>
        </div>
      )}
    </div>
  );
}
