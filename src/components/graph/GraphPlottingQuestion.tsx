// Graph Plotting Question Component
// Interactive scatter plot where students can add/drag/remove points
// With optional Join Points Mode (straight vs curved lines)

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
  Line,
  ComposedChart
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trash2, Undo2, TrendingUp, Spline } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type {
  GraphPlottingConfig,
  GraphPoint,
  GraphPlottingAnswer,
  GraphPlottingMarkingResult
} from './types';

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
  onJoinModeChange?: (mode: 'straight' | 'curved') => void;
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
  onJoinModeChange
}: GraphPlottingQuestionProps) {
  const chartRef = useRef<any>(null);
  const [history, setHistory] = useState<GraphPoint[][]>([]);

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

  // Determine if join mode is enabled and get current mode
  const isJoinModeEnabled = joinPointsMode?.enabled ?? false;
  const currentJoinMode = joinMode ?? joinPointsMode?.defaultMode ?? 'straight';

  // Sort points by x for line drawing
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

  // Add a point
  const addPoint = useCallback((x: number, y: number) => {
    if (readOnly) return;
    if (maxPoints && studentPoints.length >= maxPoints) return;

    const snapped = snapPoint(x, y);
    
    // Don't add duplicate points
    if (studentPoints.some(p => p.x === snapped.x && p.y === snapped.y)) return;

    setHistory(prev => [...prev, studentPoints]);
    onPointsChange([...studentPoints, snapped]);
  }, [readOnly, maxPoints, studentPoints, snapPoint, onPointsChange]);

  // Remove a point by index
  const removePoint = useCallback((index: number) => {
    if (readOnly) return;
    setHistory(prev => [...prev, studentPoints]);
    onPointsChange(studentPoints.filter((_, i) => i !== index));
  }, [readOnly, studentPoints, onPointsChange]);

  // Undo last action
  const undo = useCallback(() => {
    if (history.length === 0 || readOnly) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    onPointsChange(previous);
  }, [history, readOnly, onPointsChange]);

  // Clear all points
  const clearAll = useCallback(() => {
    if (readOnly || studentPoints.length === 0) return;
    setHistory(prev => [...prev, studentPoints]);
    onPointsChange([]);
  }, [readOnly, studentPoints, onPointsChange]);

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

  // Handle chart click for adding points
  const handleChartClick = (event: any) => {
    if (readOnly || !event?.xValue || !event?.yValue) return;
    addPoint(event.xValue, event.yValue);
  };

  // Custom dot renderer with status colors
  const renderDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (!payload) return null;
    
    const status = getPointStatus(payload);
    const color = status ? statusColors[status] : subjectColor;
    
    return (
      <g key={`dot-${index}`}>
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
          style={{ cursor: readOnly ? 'default' : 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            if (!readOnly) removePoint(index);
          }}
        />
        {!readOnly && (
          <title>Click to remove point ({payload.x}, {payload.y})</title>
        )}
      </g>
    );
  };

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
                value={currentJoinMode}
                onValueChange={(val) => {
                  if (val && onJoinModeChange) {
                    onJoinModeChange(val as 'straight' | 'curved');
                  }
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

      {/* Chart */}
      <div className="border rounded-lg p-4 bg-card">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            ref={chartRef}
            onClick={handleChartClick}
            style={{ cursor: readOnly ? 'default' : 'crosshair' }}
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
            
            {/* Connecting line through points (if join mode enabled and has 2+ points) */}
            {isJoinModeEnabled && sortedPoints.length >= 2 && (
              <Line
                type={currentJoinMode === 'curved' ? 'monotone' : 'linear'}
                dataKey="y"
                stroke={subjectColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
            
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
